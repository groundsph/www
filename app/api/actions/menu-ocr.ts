"use server"

import { getCurrentUser } from "@/lib/auth"
import { db } from "@/db"
import { cafeMenuItems, cafes, menuItemSuggestions, profiles } from "@/db/schema/tables"
import { desc, eq } from "drizzle-orm"
import { revalidateCafePages } from "@/utils/cafe-routes"
import { canWriteMenuDirectly } from "@/utils/menu/trusted-menu-write"
import { notifyDiscordMenuScanBatch } from "./notify"
import { recalculatePriceLevel } from "./price-level"
import { extractMenuItemsFromImage } from "@/utils/ai/menu-ocr"
import type { OcrMenuItem } from "@/utils/ai/menu-ocr"
import type { MenuItemSuggestionData } from "./menu-suggestions"

export interface OcrResult {
    success: boolean
    items?: OcrMenuItem[]
    deduplicated?: OcrMenuItem[]
    duplicates?: string[]
    error?: string
}

export async function normalizeName(name: string): Promise<string> {
    return name.toLowerCase().replace(/\s+/g, " ").trim()
}

export async function levenshteinDistance(a: string, b: string): Promise<number> {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i]
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                )
            }
        }
    }

    return matrix[b.length][a.length]
}

export async function isSimilarName(a: string, b: string): Promise<boolean> {
    const normalizedA = await normalizeName(a)
    const normalizedB = await normalizeName(b)

    if (normalizedA === normalizedB) {
        return true
    }

    if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
        return true
    }

    if (normalizedA.length <= 5 && normalizedB.length <= 5) {
        return false
    }

    const maxLength = Math.max(normalizedA.length, normalizedB.length)
    const distance = await levenshteinDistance(normalizedA, normalizedB)
    const threshold = maxLength * 0.2

    return distance <= threshold
}

export async function deduplicateMenuItems(
    newItems: OcrMenuItem[],
    existingItems: Array<{ name: string; category: string; price: number }>
): Promise<OcrMenuItem[]> {
    const normalizedExisting = await Promise.all(
        existingItems.map(async (item) => ({
            ...item,
            normalizedName: await normalizeName(item.name),
        }))
    )

    const results: OcrMenuItem[] = []
    for (const newItem of newItems) {
        const newItemNormalized = await normalizeName(newItem.name)
        const isDuplicate = await Promise.all(
            normalizedExisting.map(async (existing) => {
                if (newItemNormalized === existing.normalizedName) return true
                if (newItemNormalized.includes(existing.normalizedName) || existing.normalizedName.includes(newItemNormalized)) return true
                if (newItemNormalized.length > 5 && existing.normalizedName.length > 5) {
                    const maxLength = Math.max(newItemNormalized.length, existing.normalizedName.length)
                    const distance = await levenshteinDistance(newItemNormalized, existing.normalizedName)
                    return distance <= maxLength * 0.2
                }
                return false
            })
        )
        if (!isDuplicate.some(Boolean)) {
            results.push(newItem)
        }
    }
    return results
}

export async function scanMenuImage(
    cafeId: string,
    imageBase64: string
): Promise<OcrResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Authentication required" }
    }

    const cafe = await db.query.cafes.findFirst({
        where: eq(cafes.id, cafeId),
    })

    if (!cafe) {
        return { success: false, error: "Cafe not found" }
    }

    let extractionResult
    try {
        extractionResult = await extractMenuItemsFromImage(imageBase64)
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to extract menu items from image",
        }
    }

    const items = extractionResult.items

    const existingItems = await db
        .select({
            name: cafeMenuItems.name,
            category: cafeMenuItems.category,
            price: cafeMenuItems.price,
        })
        .from(cafeMenuItems)
        .where(eq(cafeMenuItems.cafeId, cafeId))

    const deduplicated = await deduplicateMenuItems(items, existingItems)
    const duplicateNames = items
        .filter((item) => !deduplicated.some((d) => d.name === item.name))
        .map((item) => item.name)

    return {
        success: true,
        items,
        deduplicated,
        duplicates: duplicateNames,
    }
}

export interface SaveOcrMenuResult {
    success: boolean
    /** Menu items written straight into the Menu by a trusted caller. */
    saved?: number
    /** Menu suggestions queued for review — one per extracted item. */
    queued?: number
    /** The Menu scan batch every queued suggestion belongs to. */
    batchId?: string
    /**
     * True when nothing was written and the scan waits for review. The caller
     * must say so in its own words, not as a saved confirmation.
     */
    underReview?: boolean
    error?: string
}

/**
 * A scan from someone who may not write this Cafe's Menu directly becomes one
 * Menu scan batch: every extracted item is an ordinary Menu suggestion, and all
 * of them share a freshly assigned batch id.
 */
/**
 * Tells Discord a scan is waiting, with the Cafe's name and a link to the queue.
 * Best effort by design: failures are logged and swallowed.
 */
async function notifyQueuedMenuScan(cafeId: string, userId: string, itemCount: number): Promise<void> {
    try {
        const [cafe] = await db
            .select({ name: cafes.name, slug: cafes.slug })
            .from(cafes)
            .where(eq(cafes.id, cafeId))
            .limit(1)

        if (!cafe?.slug) return

        const [profile] = await db
            .select({ displayName: profiles.displayName, username: profiles.username })
            .from(profiles)
            .where(eq(profiles.id, userId))
            .limit(1)

        await notifyDiscordMenuScanBatch(
            { name: cafe.name, slug: cafe.slug },
            itemCount,
            profile?.displayName || profile?.username || undefined
        )
    } catch (error) {
        console.error("Failed to notify Discord about a queued menu scan:", error)
    }
}

async function queueMenuScanForReview(
    cafeId: string,
    userId: string,
    items: OcrMenuItem[]
): Promise<SaveOcrMenuResult> {
    const batchId = crypto.randomUUID()

    const suggestions = items.map((item) => {
        const suggestedData: MenuItemSuggestionData = {
            name: item.name,
            category: item.category,
            price: item.price,
            description: item.description ?? undefined,
            is_food: item.is_food ?? false,
            is_hot: item.is_hot ?? false,
            is_cold: item.is_cold ?? false,
            is_vegan: item.is_vegan ?? false,
            is_vegetarian: item.is_vegetarian ?? false,
            calories: item.calories ?? null,
        }

        return {
            cafeId,
            userId,
            type: "add",
            targetItemId: null,
            suggestedData: suggestedData as unknown as Record<string, unknown>,
            status: "pending",
            batchId,
        }
    })

    try {
        await db.insert(menuItemSuggestions).values(suggestions)
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to submit scanned menu items",
        }
    }

    // Once per scan, not once per item: a forty-item scan is one decision in the
    // queue. A webhook that is missing, slow or rejecting is logged and swallowed
    // by the reporter, so it can never turn a queued scan into a failed one.
    await notifyQueuedMenuScan(cafeId, userId, items.length)

    return { success: true, underReview: true, queued: items.length, batchId }
}

export async function saveOcrMenuItems(
    cafeId: string,
    items: OcrMenuItem[]
): Promise<SaveOcrMenuResult> {
    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Authentication required" }
    }

    if (items.length === 0) {
        return { success: true, saved: 0 }
    }

    const cafe = await db.query.cafes.findFirst({
        where: eq(cafes.id, cafeId),
        columns: { slug: true },
    })

    if (!cafe) {
        return { success: false, error: "Cafe not found" }
    }

    // Who is saving decides what saving means. Anyone who is not this Cafe's
    // owner or an admin goes through review, exactly like a one-item suggestion.
    const isTrustedWriter = await canWriteMenuDirectly(cafeId)
    if (!isTrustedWriter) {
        return queueMenuScanForReview(cafeId, user.id, items)
    }

    const existingItems = await db
        .select({ sortOrder: cafeMenuItems.sortOrder })
        .from(cafeMenuItems)
        .where(eq(cafeMenuItems.cafeId, cafeId))
        .orderBy(desc(cafeMenuItems.sortOrder))
        .limit(1)

    const nextSortOrder = existingItems.length > 0 ? (existingItems[0].sortOrder ?? 0) + 1 : 0

    const itemsToInsert = items.map((item, index) => ({
        cafeId,
        name: item.name,
        category: item.category,
        price: item.price,
        description: item.description ?? null,
        isFood: item.is_food ?? false,
        isHot: item.is_hot ?? false,
        isCold: item.is_cold ?? false,
        isVegan: item.is_vegan ?? false,
        isVegetarian: item.is_vegetarian ?? false,
        calories: item.calories ?? null,
        communitySubmitted: true,
        sortOrder: nextSortOrder + index,
        lastUpdatedBy: user.id,
    }))

    try {
        await db.insert(cafeMenuItems).values(itemsToInsert)
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to save menu items",
        }
    }

    await recalculatePriceLevel(cafeId)

    // The slug was loaded above; the helper must never rebuild a `/cafe/<id>` path.
    await revalidateCafePages(cafeId, cafe.slug)

    return { success: true, saved: items.length }
}
