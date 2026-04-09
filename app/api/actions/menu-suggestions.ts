"use server"

import { db } from "@/db"
import { menuItemSuggestions, cafeMenuItems, cafes } from "@/db/schema/tables"
import { getCurrentUser } from "@/lib/auth"
import { eq, and, count } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface MenuItemSuggestionData {
    name: string
    description?: string
    category: string
    price: number
    is_food?: boolean
    is_hot?: boolean
    is_cold?: boolean
    is_signature?: boolean
    calories?: number | null
    is_vegan?: boolean
    is_vegetarian?: boolean
    size_options?: Array<{ label: string; price: number }> | null
}

export async function submitMenuItemSuggestion(
    cafeId: string,
    type: "add" | "edit" | "remove",
    data: MenuItemSuggestionData,
    targetItemId?: string
) {
    const user = await getCurrentUser()
    if (!user) return { error: "Authentication required" }

    if (type === "add") {
        if (!data.name?.trim() || !data.category || data.price === undefined) {
            return { error: "Name, category, and price are required" }
        }
        // Strip imageUrl from community submissions
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { imageUrl, ...safeData } = data as MenuItemSuggestionData & { imageUrl?: string }
        data = safeData
    }

    if ((type === "edit" || type === "remove") && !targetItemId) {
        return { error: "Target item ID is required for edit/remove suggestions" }
    }

    try {
        const [suggestion] = await db
            .insert(menuItemSuggestions)
            .values({
                cafeId,
                userId: user.id,
                type,
                targetItemId: targetItemId || null,
                suggestedData: data as unknown as Record<string, unknown>,
                status: "pending",
            })
            .returning({ id: menuItemSuggestions.id })

        revalidatePath(`/cafes/`)
        return { success: true, suggestionId: suggestion.id }
    } catch (error) {
        console.error("Failed to submit menu item suggestion:", error)
        return { error: "Failed to submit suggestion" }
    }
}

export async function getMenuItemSuggestionsForCafe(cafeId: string) {
    const user = await getCurrentUser()
    if (!user) return []

    return db
        .select()
        .from(menuItemSuggestions)
        .where(eq(menuItemSuggestions.cafeId, cafeId))
        .orderBy(menuItemSuggestions.createdAt)
}

export interface MenuItemSuggestion {
    id: string
    cafeId: string
    userId: string
    type: string
    targetItemId: string | null
    suggestedData: MenuItemSuggestionData
    status: string | null
    adminNotes: string | null
    reviewedBy: string | null
    reviewedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
}

export async function getPendingMenuItemSuggestions(): Promise<MenuItemSuggestion[]> {
    const user = await getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return []
    }

    const results = await db
        .select()
        .from(menuItemSuggestions)
        .where(eq(menuItemSuggestions.status, "pending"))
        .orderBy(menuItemSuggestions.createdAt)

    return results.map((r) => ({
        ...r,
        suggestedData: r.suggestedData as unknown as MenuItemSuggestionData,
    }))
}

export async function getPendingMenuItemSuggestionsCount(cafeId: string) {
    const user = await getCurrentUser()
    if (!user) return 0

    const result = await db
        .select({ count: count() })
        .from(menuItemSuggestions)
        .where(
            and(
                eq(menuItemSuggestions.cafeId, cafeId),
                eq(menuItemSuggestions.status, "pending")
            )
        )

    return result[0]?.count ?? 0
}

export async function approveMenuItemSuggestion(suggestionId: string) {
    const user = await getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return { error: "Unauthorized" }
    }

    try {
        const [suggestion] = await db
            .select()
            .from(menuItemSuggestions)
            .where(eq(menuItemSuggestions.id, suggestionId))

        if (!suggestion) return { error: "Suggestion not found" }
        if (suggestion.status !== "pending") return { error: "Already processed" }

        const data = suggestion.suggestedData as MenuItemSuggestionData

        if (suggestion.type === "add") {
            await db.insert(cafeMenuItems).values({
                cafeId: suggestion.cafeId,
                name: data.name,
                description: data.description || null,
                category: data.category,
                price: data.price,
                isFood: data.is_food || false,
                isHot: data.is_hot || false,
                isCold: data.is_cold || false,
                isSignature: data.is_signature || false,
                calories: data.calories || null,
                isVegan: data.is_vegan || false,
                isVegetarian: data.is_vegetarian || false,
                sizeOptions: data.size_options || null,
                communitySubmitted: true,
                lastUpdatedBy: suggestion.userId,
            })
        } else if (suggestion.type === "edit" && suggestion.targetItemId) {
            await db
                .update(cafeMenuItems)
                .set({
                    name: data.name,
                    description: data.description || null,
                    category: data.category,
                    price: data.price,
                    isFood: data.is_food,
                    isHot: data.is_hot,
                    isCold: data.is_cold,
                    isSignature: data.is_signature,
                    calories: data.calories || null,
                    isVegan: data.is_vegan,
                    isVegetarian: data.is_vegetarian,
                    sizeOptions: data.size_options || null,
                    lastUpdatedBy: suggestion.userId,
                })
                .where(eq(cafeMenuItems.id, suggestion.targetItemId))
        } else if (suggestion.type === "remove" && suggestion.targetItemId) {
            await db
                .update(cafeMenuItems)
                .set({ isAvailable: false, lastUpdatedBy: suggestion.userId })
                .where(eq(cafeMenuItems.id, suggestion.targetItemId))
        }

        // Recalculate price level
        const { recalculatePriceLevel } = await import("./price-level")
        await recalculatePriceLevel(suggestion.cafeId)

        await db
            .update(menuItemSuggestions)
            .set({
                status: "approved",
                reviewedBy: user.id,
                reviewedAt: new Date(),
            })
            .where(eq(menuItemSuggestions.id, suggestionId))

        const [cafe] = await db
            .select({ slug: cafes.slug })
            .from(cafes)
            .where(eq(cafes.id, suggestion.cafeId))
            .limit(1)

        if (cafe?.slug) {
            revalidatePath(`/cafes/${cafe.slug}`)
            revalidatePath(`/cafes/${cafe.slug}/menu`)
        }
        revalidatePath(`/cafes/`)
        return { success: true }
    } catch (error) {
        console.error("Failed to approve suggestion:", error)
        return { error: "Failed to approve suggestion" }
    }
}

export async function rejectMenuItemSuggestion(suggestionId: string, adminNotes?: string) {
    const user = await getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return { error: "Unauthorized" }
    }

    try {
        const [suggestion] = await db
            .select()
            .from(menuItemSuggestions)
            .where(eq(menuItemSuggestions.id, suggestionId))

        if (!suggestion) return { error: "Suggestion not found" }

        await db
            .update(menuItemSuggestions)
            .set({
                status: "rejected",
                adminNotes: adminNotes || null,
                reviewedBy: user.id,
                reviewedAt: new Date(),
            })
            .where(eq(menuItemSuggestions.id, suggestionId))

        return { success: true }
    } catch (error) {
        console.error("Failed to reject suggestion:", error)
        return { error: "Failed to reject suggestion" }
    }
}
