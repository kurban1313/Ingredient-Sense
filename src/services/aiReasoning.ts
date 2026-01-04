import { extractContent, type ScanMode } from "./visionService";
import { analyzeHealthWithPro, findProductDetails } from "./analysisService";
import { getProductData, searchProductByName } from "./productRepository";

export type RiskLevel = 'safe' | 'caution' | 'danger';

export interface AnalysisCard {
    id: string;
    type: 'health' | 'alert' | 'info';
    title: string;
    description: string;
    icon?: string;
}

export interface IngredientAnalysis {
    name: string;
    commonName?: string; // e.g. "E300" -> "Vitamin C"
    explanation: string; // What it is
    healthImpact: string; // Effect on body
    risk: RiskLevel;
}

export interface AnalysisResult {
    riskLevel: RiskLevel;
    safetyScore?: number; // 0-100
    productName: string;
    summary: string;
    warningSummary?: string[]; // Bullet points for end summary
    ingredients: string[];
    detailedIngredients: IngredientAnalysis[];
    cards: AnalysisCard[];
}

export type PipelineStage = 'idle' | 'identifying' | 'looking_up' | 'extracting' | 'analyzing' | 'complete';

export const analyzeIngredients = async (imageSrc: string | null, mode: ScanMode, onStageChange?: (stage: PipelineStage) => void, initialBarcode?: string): Promise<AnalysisResult> => {
    if (!imageSrc && !initialBarcode) throw new Error("No image or barcode provided");

    try {
        let ingredientsList: string[] = [];
        let productName = "Unknown Product";

        // MODE 1: BARCODE SCAN
        if (mode === 'barcode') {
            onStageChange?.('identifying');

            let classification: { type: 'barcode' | 'ingredients' | 'none', content: string };

            if (initialBarcode) {
                // Bypass visual extraction if we already scanned it natively
                classification = { type: 'barcode', content: initialBarcode };
            } else {
                // User removed AI fallback for barcodes. Must be scanned natively.
                classification = { type: 'none', content: '' };
            }

            if (classification.type === 'barcode' && classification.content) {
                onStageChange?.('looking_up');
                const productData = await getProductData(classification.content);

                // Check if we got valid data (OFF source + ingredients)
                if (productData.source === 'OFF' && productData.ingredientsText) {
                    ingredientsList = productData.ingredientsText.split(',').map(s => s.trim());
                    if (productData.name) productName = productData.name;
                } else {
                    console.log("OFF Incomplete/Failed. Initiating AI Deep Search...");

                    // Fallback Strategy 1: Search by Name (if OFF gave us a name)
                    if (productData.name) {
                        try {
                            const aiSearch = await findProductDetails(undefined, productData.name);
                            if (aiSearch && aiSearch.ingredients.length > 0) {
                                console.log("AI Name Search Success");
                                ingredientsList = aiSearch.ingredients;
                                productName = aiSearch.name;
                            }
                        } catch (e) { console.warn("AI Name Search Failed", e); }
                    }

                    // Fallback Strategy 2: Search by Barcode (Direct Lookup)
                    if (ingredientsList.length === 0) {
                        try {
                            console.log("Attempting Direct Barcode Search...");
                            const aiSearch = await findProductDetails(classification.content);
                            if (aiSearch && aiSearch.ingredients.length > 0) {
                                console.log("AI Barcode Search Success");
                                ingredientsList = aiSearch.ingredients;
                                productName = aiSearch.name;
                            }
                        } catch (e) { console.warn("AI Barcode Search Failed", e); }
                    }

                    // Fallback Strategy 3: Visual Extraction (Last Resort)
                    if (ingredientsList.length === 0) {
                        console.log("Search failed. Trying visual extraction...");
                        // Only try if we have an image
                        if (imageSrc) {
                            onStageChange?.('extracting');
                            const extraction = await extractContent(imageSrc, 'ingredients');
                            if (extraction.content) {
                                ingredientsList = extraction.content.split(',').map(s => s.trim());
                                if (extraction.name) productName = extraction.name;
                            }
                        } else {
                            throw new Error(`Product found ("${productName}"), but ingredients could not be retrieved. Try scanning the ingredient list directly.`);
                        }
                    }
                }
            } else {
                throw new Error("No barcode detected. Try scanning the front of the package.");
            }
        }

        // MODE 2: INGREDIENTS SCAN (Direct + Hybrid Search)
        else {
            onStageChange?.('extracting');
            const extraction = await extractContent(imageSrc, 'ingredients');

            if (extraction.type === 'ingredients' && extraction.content) {
                ingredientsList = extraction.content.split(',').map(s => s.trim());
                if (extraction.name) productName = extraction.name;

                // Hybrid Logic: Check if we can upgrade to Official Data
                if (extraction.name && extraction.name.length > 2) {
                    onStageChange?.('looking_up');
                    try {
                        const onlineMatch = await searchProductByName(extraction.name);
                        if (onlineMatch && onlineMatch.ingredientsText) {
                            console.log("Hybrid Match Found!", onlineMatch.name);
                            // Upgrade to official, clean data
                            ingredientsList = onlineMatch.ingredientsText.split(',').map(s => s.trim());
                            if (onlineMatch.name) productName = onlineMatch.name;
                        }
                    } catch (ignore) {
                        console.log("Hybrid search failed, sticking to OCR");
                    }
                }
            } else {
                throw new Error("Could not read text from image.");
            }
        }

        // Stage 2: Reasoning (Pro)
        if (ingredientsList.length === 0) throw new Error("No ingredients found.");

        onStageChange?.('analyzing');
        const analysis = await analyzeHealthWithPro(ingredientsList, productName);

        const result: AnalysisResult = {
            ...analysis,
            productName: productName,
            ingredients: ingredientsList,
            detailedIngredients: analysis.detailedIngredients || [] // Ensure fallback
        };

        onStageChange?.('complete');
        return result;

    } catch (error: any) {
        console.error("Pipeline Failed", error);
        onStageChange?.('idle');
        // If we want to return a "Failure" result instead of throwing:
        return {
            riskLevel: 'danger',
            summary: `Analysis Error: ${error.message || "Unknown error occurred."}`,
            productName: "Error",
            ingredients: [],
            detailedIngredients: [],
            cards: []
        };
    }
};
