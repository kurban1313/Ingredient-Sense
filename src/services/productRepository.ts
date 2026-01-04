import { getOFFProduct } from "./openFoodFacts";

export type ProductSource = 'OFF' | 'OCR_FALLBACK';

export interface ProductData {
    source: ProductSource;
    name?: string;
    ingredientsText?: string;
    barcode?: string;
}

export const getProductData = async (barcode: string): Promise<ProductData> => {
    // Step A: Call OFF API
    const offProduct = await getOFFProduct(barcode);

    // Step B: Success Check
    if (offProduct && offProduct.product.ingredients_text) {
        return {
            source: 'OFF',
            barcode: barcode,
            name: offProduct.product.product_name,
            ingredientsText: offProduct.product.ingredients_text
        };
    }

    // Step C: Fallback (Not found or no ingredients listed)
    return {
        source: 'OCR_FALLBACK',
        barcode: barcode
    };
};

// Search OFF by Product Name
export const searchProductByName = async (productName: string): Promise<ProductData | null> => {
    try {
        const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(productName)}&search_simple=1&action=process&json=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.products && data.products.length > 0) {
            const bestMatch = data.products[0]; // Take top result
            if (bestMatch.ingredients_text) {
                return {
                    source: 'OFF',
                    barcode: bestMatch.code,
                    name: bestMatch.product_name,
                    ingredientsText: bestMatch.ingredients_text
                };
            }
        }
        return null;
    } catch (e) {
        console.warn("Product Search Failed", e);
        return null;
    }
};
