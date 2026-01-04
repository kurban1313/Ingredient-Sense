import OpenAI from "openai";

export type ContentType = 'barcode' | 'ingredients' | 'none';

export interface RouterResult {
    type: ContentType;
    content: string; // barcode digits or ingredient text
    name?: string; // Product name if visible (for ingredients mode)
}

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true,
    timeout: 30000 // 30 seconds timeout
});

export type ScanMode = 'auto' | 'barcode' | 'ingredients';

export const extractContent = async (imageSrc: string | null, mode: ScanMode = 'auto'): Promise<RouterResult> => { // Allow null type in signature
    // Basic validation
    if (!imageSrc || !imageSrc.startsWith("data:image")) {
        console.warn("Invalid image source for AI Router");
        return { type: 'none', content: '' };
    }

    try {
        // User requested: Gemini 2.0 Flash Lite
        const modelMatch = "google/gemini-2.0-flash-lite-001";

        let promptText = "";

        if (mode === 'ingredients') {
            promptText = `
                Analyze this image. Extract:
                1. The full Ingredient List text.
                2. The Product Name (if visible on the package).
                
                Return ONLY valid JSON:
                { 
                    "type": "ingredients", 
                    "content": "full_text_string",
                    "name": "product_name_guess_or_null"
                }
                If no text is clear, return { "type": "none", "content": "" }
             `;
        } else {
            // Default Fallback
            promptText = `
                Analyze this image. determine if it shows an Ingredient List text.
                Return ONLY valid JSON:
                { "type": "ingredients" | "none", "content": "string" }
             `;
        }

        const performRequest = async (model: string) => {
            return await openai.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: promptText },
                            { type: "image_url", image_url: { url: imageSrc } }
                        ]
                    }
                ],
                temperature: 0.6
            });
        };

        try {
            // Primary: Gemma 3
            const response = await performRequest(modelMatch);
            const text = response.choices[0].message.content || "{}";

            // Robust JSON Extraction
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error(`No JSON found in response: ${text.substring(0, 50)}...`);

            try {
                return JSON.parse(jsonMatch[0]) as RouterResult;
            } catch (parseError) {
                throw new Error(`JSON Parse Error: ${parseError}`);
            }

        } catch (error) {
            console.warn("Primary Visual Model failed, trying fallback...", error);
            try {
                // Fallback: Llama 3.2 Vision
                const fallbackResponse = await performRequest("llama/llama-3.2-11b-vision-instruct:free");
                const text = fallbackResponse.choices[0].message.content || "{}";
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("No JSON found in fallback");
                return JSON.parse(jsonMatch[0]) as RouterResult;
            } catch (fallbackError) {
                console.error("All AI Routers Failed", fallbackError);
                throw new Error("Visual analysis timed out. Please try again or switch modes.");
            }
        }
    } catch (error) {
        console.error("AI Router Logic Error", error);
        throw error;
    }
};
