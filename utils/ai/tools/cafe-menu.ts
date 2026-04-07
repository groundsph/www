import { db } from "@/db"
import { cafes, cafeMenuItems } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"

export interface MenuItem {
    id: string
    name: string
    description: string | null
    category: string
    price: number
    imageUrl: string | null
    isAvailable: boolean
    isSignature: boolean
}

export interface CafeMenuResult {
    cafeName: string
    cafeSlug: string
    items: MenuItem[]
    totalItems: number
    categories: string[]
}

export async function getCafeMenu(
    cafeSlug: string,
    category?: string
): Promise<CafeMenuResult | { error: string }> {
    try {
        const cafe = await db
            .select({ id: cafes.id, name: cafes.name, slug: cafes.slug })
            .from(cafes)
            .where(eq(cafes.slug, cafeSlug))
            .limit(1)

        if (!cafe[0]) {
            return { error: `Cafe with slug "${cafeSlug}" not found` }
        }

        const conditions = [eq(cafeMenuItems.cafeId, cafe[0].id)]
        if (category) {
            conditions.push(eq(cafeMenuItems.category, category))
        }

        const items = await db
            .select({
                id: cafeMenuItems.id,
                name: cafeMenuItems.name,
                description: cafeMenuItems.description,
                category: cafeMenuItems.category,
                price: cafeMenuItems.price,
                imageUrl: cafeMenuItems.imageUrl,
                isAvailable: cafeMenuItems.isAvailable,
                isSignature: cafeMenuItems.isSignature,
            })
            .from(cafeMenuItems)
            .where(and(...conditions))
            .orderBy(asc(cafeMenuItems.sortOrder), asc(cafeMenuItems.name))

        const categories = [...new Set(items.map((i) => i.category))]

        return {
            cafeName: cafe[0].name,
            cafeSlug: cafe[0].slug,
            items: items.map((i) => ({
                ...i,
                isAvailable: i.isAvailable ?? true,
                isSignature: i.isSignature ?? false,
            })),
            totalItems: items.length,
            categories,
        }
    } catch (error) {
        console.error("getCafeMenu error:", error)
        return { error: "Failed to fetch cafe menu" }
    }
}
