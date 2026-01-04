import OpenAI from "openai";
import type { AnalysisResult } from "./aiReasoning";

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true,
    timeout: 30000 // 30 seconds for deep reasoning
});

// We return the analysis part only; ingredients and productName are attached by the caller (aiReasoning)
export const analyzeHealthWithPro = async (ingredients: string[], productName: string): Promise<Omit<AnalysisResult, 'ingredients' | 'productName'>> => {
    try {
        const primaryModel = "openai/gpt-oss-120b:free";
        const fallbackModel = "openai/gpt-oss-20b:free";


        const prompt = `
      Role: You are "IngredientSense," an expert Food Scientist and Toxicologist. Your goal is to provide a balanced, scientific analysis of food ingredients.
      LANGUAGE RULE: You must ALWAYS output in English. If ingredients are in another language, translate them for the reasoning and explanation.
      
      Product: "${productName}"
      Ingredients: ${ingredients.join(", ")}.

      1. The Reasoning Phase (The "Thinking" Score):
      Before generating the final JSON, you must internally reason about the ingredients.
      Ask yourself:
      "Is this ingredient actually harmful, or just a chemical name for a vitamin?" (e.g., Ascorbic Acid is Vitamin C = Safe).
      "Is the dosage likely high?" (First 3 ingredients = High, Last 3 = Trace).
      "Are there synergistic risks?" (e.g., Caffeine + High Sugar = Crash).

      2. The "Anti-Alarmist" Rule (Calibration):
      STOP & CHECK: Do not mark ingredients as "Dangerous" just because they sound chemical.
      
      CRITICAL SCORING RULES:
      - GREEN (SAFE): Natural ingredients, Vitamins, Standard Additives (Citric Acid, Pectins, Lecithins), Sugar/Salt (in normal amounts). **DEFAULT TO SAFE** for standard food items.
      - YELLOW (CAUTION): ONLY for controversial items: High Fructose Corn Syrup (high position), Artificial Colors (Red 40, Yellow 5), Hydrogenated Oils, excess Preservatives.
      - RED (DANGER): Known Carcinogens, Banned Substances, Trans Fats.

      **If in doubt, mark as SAFE.** Do not be overly cautious. A standard cookie or chip is usually "Safe" or at worst "Caution" if very unhealthy. Healthy/Organic foods MUST be "Safe".

      3. Output Format:
      Return a JSON object with a "detailedIngredients" array covering ALL detected ingredients.
      For each ingredient:
      - "name": Raw name (e.g. "E300").
      - "commonName": Common/Easy name (e.g. "Vitamin C") or null if same.
      - "explanation": Brief "What is it?" (e.g. "Preservative").
      - "healthImpact": "Why does it matter?" (e.g. "Harmless antioxidant", "Can cause hyperactivity").
      - "risk": "safe" | "caution" | "danger".

      And a "warning_bullets" list of concise critical warnings.

      {
        "riskLevel": "safe" | "caution" | "danger",
        "summary": "Max 15 words. One short sentence.",
        "warning_bullets": [
            "Contains high levels of sodium.",
            "Contains artificial color Red 40."
        ],
        "detailedIngredients": [
           { 
             "name": "E300", 
             "commonName": "Vitamin C",
             "explanation": "Antioxidant preservative",
             "healthImpact": "Boosts immune system, harmless",
             "risk": "safe" 
           }
        ]
      }
    `;

        const callModel = async (modelName: string) => {
            return await openai.chat.completions.create({
                model: modelName,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.6 // Balanced: Stable but natural
            });
        };

        let response;
        try {
            response = await callModel(primaryModel);
        } catch (e: any) {
            console.warn(`Primary model ${primaryModel} failed. Using fallback ${fallbackModel}`, e);
            response = await callModel(fallbackModel);
        }

        const text = response.choices[0].message.content || "{}";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");

        const data = JSON.parse(jsonMatch[0]);

        // MAP TO INTERNAL STRUCTURE

        let risk: 'safe' | 'caution' | 'danger' = 'safe';
        if (data.riskLevel) risk = data.riskLevel;
        // Support legacy/HealthLens fallback
        if (data.danger_level === 'MODERATE') risk = 'caution';
        if (data.danger_level === 'AVOID') risk = 'danger';

        const detailedIngredients: any[] = [];
        const detected = data.detailedIngredients || [];

        // If AI returned detailed list, use it.
        if (Array.isArray(detected) && detected.length > 0) {
            detected.forEach((ing: any) => {
                detailedIngredients.push({
                    name: ing.name,
                    commonName: ing.commonName,
                    explanation: ing.explanation || "No details provided.",
                    healthImpact: ing.healthImpact || "Unknown impact.",
                    risk: ing.risk || 'safe'
                });
            });
        } else {
            // Fallback if AI failed to list them
            ingredients.forEach(i => detailedIngredients.push({ name: i, explanation: "Detected", healthImpact: "No details available.", risk: 'safe' }));
        }

        return {
            riskLevel: risk,
            safetyScore: 0,
            summary: data.summary || data.safety_summary || "Analysis complete.",
            warningSummary: data.warning_bullets || [],
            detailedIngredients: detailedIngredients,
            cards: [] // Removed Cards/Warnings as requested
        } as Omit<AnalysisResult, 'ingredients' | 'productName'>;

    } catch (error) {
        console.error("Pro Analysis Failed", error);
        return {
            riskLevel: 'danger',
            safetyScore: 0,
            summary: "Analysis failed due to network or AI error.",
            detailedIngredients: [],
            cards: []
        };
    }
};

export const findProductDetails = async (barcode?: string, productName?: string): Promise<{ name: string; ingredients: string[] } | null> => {
    try {
        const query = barcode
            ? `I have a product with barcode "${barcode}". Identify the exact product name and list its full ingredients.`
            : `I have a product named "${productName}". List its full ingredients.`;

        // User requested Xiaomi Mimo / Mistral Devstral for research.
        // We will try Primary then Fallback, similar to the analysis function.
        // User requested: OpenAI OSS models (GPT-OSS-120B Primary, GPT-OSS-20B Fallback)
        const primaryModel = "openai/gpt-oss-120b:free";
        const fallbackModel = "openai/gpt-oss-20b:free";

        const callModel = async (modelName: string) => {
            return await openai.chat.completions.create({
                model: modelName,
                messages: [{
                    role: "system",
                    content: "You are a product database assistant. Your ONLY job is to return the Product Name and Ingredients List in JSON format. If you cannot find it, return null. OUTPUT MUST BE IN ENGLISH."
                }, {
                    role: "user",
                    content: `${query}
                
                Return JSON:
                {
                    "name": "Exact Product Name",
                    "ingredients": ["Ingredient 1", "Ingredient 2", ...]
                }`
                }],
                response_format: { type: "json_object" },
                temperature: 0.6
            });
        };

        let response;
        try {
            response = await callModel(primaryModel);
        } catch (e) {
            console.warn(`Primary search model ${primaryModel} failed. Using fallback ${fallbackModel}`, e);
            response = await callModel(fallbackModel);
        }

        const text = response.choices[0].message.content || "{}";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const data = JSON.parse(jsonMatch[0]);
        if (!data.ingredients || data.ingredients.length === 0) return null;

        return {
            name: data.name || productName || "Unknown Product",
            ingredients: data.ingredients
        };

    } catch (e) {
        console.warn("Product Detail Search Failed", e);
        return null;
    }
};
