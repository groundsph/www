import type { OcrMenuItem } from "@/utils/ai/menu-ocr"
import type { MenuItemSubmission } from "@/utils/types/extra"

/**
 * Map an OCR-extracted menu item into the shape the cafe submission form
 * stages in `CafeSubmission.menu_items`.
 *
 * The OCR model occasionally returns the price as a string, so coerce it and
 * fall back to 0 instead of letting NaN reach the submit payload.
 */
export function ocrItemToMenuItem(item: OcrMenuItem): MenuItemSubmission {
    const price = typeof item.price === "string" ? parseFloat(item.price) : item.price

    return {
        id: crypto.randomUUID(),
        name: item.name.trim(),
        category: item.category,
        price: Number.isFinite(price) ? price : 0,
        description: item.description?.trim() ?? "",
        imageFile: null,
        imagePreview: null,
        ...(item.is_food && { isFood: true }),
        ...(item.is_hot && { isHot: true }),
        ...(item.is_cold && { isCold: true }),
        ...(item.is_vegan && { isVegan: true }),
        ...(item.is_vegetarian && { isVegetarian: true }),
        ...(item.calories != null && { calories: Number(item.calories) }),
        sizeOptions: [],
    }
}
