export interface OFFProduct {
    code: string;
    product: {
        product_name: string;
        ingredients_text: string;
        nutriments?: any;
        additives_tags?: string[];
        image_url?: string;
    };
    status: number;
}

const OFF_API_URL = "https://uk.openfoodfacts.org/api/v2/product";

export const getOFFProduct = async (barcode: string): Promise<OFFProduct | null> => {
    try {
        const response = await fetch(`${OFF_API_URL}/${barcode}.json`, {
            method: "GET",
            headers: {
                "User-Agent": "HealthCopilot - Android - Version 1.0 - www.healthcopilot.com",
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            console.warn("OFF API request failed:", response.status);
            return null;
        }

        const data = await response.json();

        // Check strict status from OFF (1 = found)
        if (data.status === 1 && data.product) {
            return data as OFFProduct;
        }

        return null;
    } catch (error) {
        console.error("Error fetching OFF product:", error);
        return null;
    }
};
