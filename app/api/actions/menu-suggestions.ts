"use server"

import { db } from "@/db"
import { menuItemSuggestions, cafeMenuItems, cafes, profiles } from "@/db/schema/tables"
import { getCurrentUser } from "@/lib/auth"
import { eq, and, count, desc } from "drizzle-orm"
import { revalidateCafePages, revalidateCafeIndex } from "@/utils/cafe-routes"
import { getStaffRole } from "@/utils/auth/staff-role"
import { notifyDiscordMenuSuggestion } from "./notify"

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

/**
 * The Menu item a suggestion would write.
 *
 * One mapping, called by the single-item approval and by a whole Menu scan, so
 * the two cannot drift apart. The single-item path is contractually frozen, so
 * its defaults are the shared ones: an absent — or empty — value means "none".
 * A scan item therefore lands with exactly the fields a one-off suggestion does.
 * `sortOrder` is not part of the mapping: only a scan positions its items.
 */
function menuItemOfSuggestion(suggestion: {
    cafeId: string
    userId: string
    suggestedData: unknown
}) {
    const data = suggestion.suggestedData as MenuItemSuggestionData

    return {
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
    }
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

        // One message per filed suggestion: this path is the one-at-a-time
        // counterpart to a scan batch, which reports itself once for the whole scan.
        await notifySubmittedMenuItemSuggestion(cafeId, user.id, type, data)

        revalidateCafeIndex()
        return { success: true, suggestionId: suggestion.id }
    } catch (error) {
        console.error("Failed to submit menu item suggestion:", error)
        return { error: "Failed to submit suggestion" }
    }
}

export async function getMenuItemSuggestionsForCafe(cafeId: string) {
    const user = await getCurrentUser()
    if (!user) return []

    // Suggestions are cafe-scoped moderation data. Only the cafe's own owners
    // may read the payload; everyone else gets the same empty result as an
    // anonymous visitor so the response does not disclose that the cafe exists.
    const ownerCheckResult = await db
        .select({ ownerIds: cafes.ownerIds })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    const ownsCafe = ownerCheckResult[0]?.ownerIds?.includes(user.id) ?? false
    if (!ownsCafe) return []

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
    /** Set when the suggestion came from a Menu scan; null for a one-off suggestion. */
    batchId: string | null
    status: string | null
    adminNotes: string | null
    reviewedBy: string | null
    reviewedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
}

export interface PendingMenuItemSuggestion
    extends Pick<
        MenuItemSuggestion,
        | "id"
        | "cafeId"
        | "type"
        | "targetItemId"
        | "suggestedData"
        | "batchId"
        | "createdAt"
    > {
    /**
     * The Cafe the suggestion is for. Rows from one Menu scan are headed by it,
     * so a reviewer can tell which Cafe a batch would change.
     */
    cafeName: string | null
}

/**
 * The suggestion columns the queue renders. Listed one by one so the query can
 * never pull a column the queue does not show.
 */
const pendingQueueColumns = {
    id: menuItemSuggestions.id,
    cafeId: menuItemSuggestions.cafeId,
    type: menuItemSuggestions.type,
    targetItemId: menuItemSuggestions.targetItemId,
    suggestedData: menuItemSuggestions.suggestedData,
    batchId: menuItemSuggestions.batchId,
    createdAt: menuItemSuggestions.createdAt,
}

export async function getPendingMenuItemSuggestions(): Promise<
    PendingMenuItemSuggestion[]
> {
    const user = await getCurrentUser()
    if (!user || !(await canReviewMenuSuggestions(user))) {
        return []
    }

    const results = await db
        .select({ ...pendingQueueColumns, cafeName: cafes.name })
        .from(menuItemSuggestions)
        .leftJoin(cafes, eq(menuItemSuggestions.cafeId, cafes.id))
        .where(eq(menuItemSuggestions.status, "pending"))
        .orderBy(menuItemSuggestions.createdAt)

    return results.map((row) => ({
        ...row,
        suggestedData: row.suggestedData as unknown as MenuItemSuggestionData,
        cafeName: row.cafeName ?? null,
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
    if (!user || !(await canReviewMenuSuggestions(user))) {
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
            await db.insert(cafeMenuItems).values(
                menuItemOfSuggestion({
                    cafeId: suggestion.cafeId,
                    userId: suggestion.userId,
                    suggestedData: suggestion.suggestedData,
                })
            )
        } else if (suggestion.type === "edit" && suggestion.targetItemId) {
            await db
                .update(cafeMenuItems)
                .set({
                    name: data.name,
                    description: data.description || null,
                    category: data.category,
                    price: data.price,
                    isFood: data.is_food ?? false,
                    isHot: data.is_hot ?? false,
                    isCold: data.is_cold ?? false,
                    isSignature: data.is_signature ?? false,
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

        await revalidateCafePages(suggestion.cafeId)
        revalidateCafeIndex()
        return { success: true }
    } catch (error) {
        console.error("Failed to approve suggestion:", error)
        return { error: "Failed to approve suggestion" }
    }
}

export async function rejectMenuItemSuggestion(suggestionId: string, adminNotes?: string) {
    const user = await getCurrentUser()
    if (!user || !(await canReviewMenuSuggestions(user))) {
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

/* ------------------------------------------------------------------------- *
 * Menu scan batches
 *
 * A Menu scan batch is a group of Menu suggestions that one scan produced, all
 * sharing a batch id. A reviewer decides the batch once: approving it writes
 * every still-pending item to the Menu in one statement, rejecting it writes
 * nothing. The batch's state is derived from its own rows — it is pending while
 * any of them is pending — so an already-processed row is simply not part of the
 * decision rather than an error.
 * ------------------------------------------------------------------------- */

/**
 * What a decided batch changed, when it changed anything.
 */
export interface MenuSuggestionBatchData {
    /** Menu items the approval wrote. */
    approved?: number
    /** Suggestion rows the rejection marked. */
    rejected?: number
    /** The Cafe the batch belongs to. */
    cafeId?: string
}

/**
 * The result of deciding a batch, in the shape every server action returns: a
 * required outcome, an optional message, and the payload under `data`.
 */
export interface MenuSuggestionBatchResult {
    success: boolean
    error?: string
    data?: MenuSuggestionBatchData
}

/**
 * Moderation is a different permission from writing a Menu: the batch review
 * keeps the queue's existing admin-or-moderator gate.
 */
async function canReviewMenuSuggestions(
    user: { id: string; role?: string | null } | null
): Promise<boolean> {
    const { isAdmin, isModerator } = await getStaffRole(user)
    return isAdmin || isModerator
}

/**
 * Announces a single Menu item suggestion, once.
 *
 * Best effort: a webhook that is missing, slow or rejecting is logged and
 * swallowed, so it can never turn a filed suggestion into a failed one.
 */
async function notifySubmittedMenuItemSuggestion(
    cafeId: string,
    userId: string,
    type: "add" | "edit" | "remove",
    data: MenuItemSuggestionData
): Promise<void> {
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

        await notifyDiscordMenuSuggestion(
            { name: cafe.name, slug: cafe.slug },
            {
                type,
                itemName: data.name ?? null,
                price: typeof data.price === "number" ? data.price : null,
            },
            profile?.displayName || profile?.username || undefined
        )
    } catch (error) {
        console.error("Failed to notify Discord about a menu item suggestion:", error)
    }
}

/** A Drizzle transaction handle, named so a signature need not spell it out. */
export type MenuSuggestionTransaction = Parameters<
    Parameters<typeof db.transaction>[0]
>[0]

/** The rows a batch decision still has to decide: that batch's pending ones. */
function pendingBatchRows(batchId: string) {
    return and(
        eq(menuItemSuggestions.batchId, batchId),
        eq(menuItemSuggestions.status, "pending")
    )
}

/**
 * Reads the batch's pending rows inside the transaction, locked, so a second
 * approval of the same batch waits for the first and then finds nothing left.
 */
async function loadPendingBatchRows(tx: MenuSuggestionTransaction, batchId: string) {
    return tx
        .select({
            cafeId: menuItemSuggestions.cafeId,
            userId: menuItemSuggestions.userId,
            suggestedData: menuItemSuggestions.suggestedData,
        })
        .from(menuItemSuggestions)
        .where(pendingBatchRows(batchId))
        .for("update")
}

/**
 * Approves a whole Menu scan batch: every still-pending item becomes a Menu item
 * in one insert and its suggestion row is marked approved, in one transaction.
 *
 * All or nothing. If anything in the transaction fails the Menu keeps whatever it
 * had and every row stays pending, so a reviewer can retry. A batch with nothing
 * pending is refused rather than re-applied, which makes a double tap harmless.
 */
export async function approveMenuSuggestionBatch(
    batchId: string
): Promise<MenuSuggestionBatchResult> {
    const user = await getCurrentUser()
    if (!user || !(await canReviewMenuSuggestions(user))) {
        return { success: false, error: "Unauthorized" }
    }
    if (!batchId) return { success: false, error: "Batch id is required" }

    let outcome: { approved: number; cafeId: string | null }

    try {
        outcome = await db.transaction(async (tx) => {
            const pending = await loadPendingBatchRows(tx, batchId)

            if (pending.length === 0) {
                return { approved: 0, cafeId: null }
            }

            const cafeId = pending[0].cafeId

            const [highest] = await tx
                .select({ sortOrder: cafeMenuItems.sortOrder })
                .from(cafeMenuItems)
                .where(eq(cafeMenuItems.cafeId, cafeId))
                .orderBy(desc(cafeMenuItems.sortOrder))
                .limit(1)

            const firstSortOrder = (highest?.sortOrder ?? -1) + 1

            // One statement for the whole scan: a batch lands together, each item
            // mapped exactly as the single-item approval maps one.
            await tx.insert(cafeMenuItems).values(
                pending.map((row, index) => ({
                    ...menuItemOfSuggestion(row),
                    sortOrder: firstSortOrder + index,
                }))
            )

            await tx
                .update(menuItemSuggestions)
                .set({
                    status: "approved",
                    reviewedBy: user.id,
                    reviewedAt: new Date(),
                })
                .where(pendingBatchRows(batchId))

            return { approved: pending.length, cafeId }
        })
    } catch (error) {
        console.error("Failed to approve menu scan batch:", error)
        return { success: false, error: "Failed to approve menu scan batch" }
    }

    if (outcome.approved === 0 || !outcome.cafeId) {
        return { success: false, error: "Nothing left to approve" }
    }

    // Post-commit only. The price level reads committed Menu rows and
    // revalidation touches framework caches; neither belongs inside a
    // transaction. If either fails the Menu is already correct and only a cached
    // page is stale.
    try {
        const { recalculatePriceLevel } = await import("./price-level")
        await recalculatePriceLevel(outcome.cafeId)
    } catch (error) {
        console.error("Failed to recalculate price level after batch approval:", error)
    }

    try {
        await revalidateCafePages(outcome.cafeId)
        revalidateCafeIndex()
    } catch (error) {
        console.error("Failed to revalidate cafe pages after batch approval:", error)
    }

    return { success: true, data: { approved: outcome.approved, cafeId: outcome.cafeId } }
}

/**
 * Rejects a whole Menu scan batch: every pending row is marked rejected and no
 * Menu item is written. Nothing public changed, so nothing is revalidated.
 */
export async function rejectMenuSuggestionBatch(
    batchId: string,
    adminNotes?: string
): Promise<MenuSuggestionBatchResult> {
    const user = await getCurrentUser()
    if (!user || !(await canReviewMenuSuggestions(user))) {
        return { success: false, error: "Unauthorized" }
    }
    if (!batchId) return { success: false, error: "Batch id is required" }

    let rejected: number

    try {
        rejected = await db.transaction(async (tx) => {
            const pending = await loadPendingBatchRows(tx, batchId)

            if (pending.length === 0) return 0

            await tx
                .update(menuItemSuggestions)
                .set({
                    status: "rejected",
                    adminNotes: adminNotes || null,
                    reviewedBy: user.id,
                    reviewedAt: new Date(),
                })
                .where(pendingBatchRows(batchId))

            return pending.length
        })
    } catch (error) {
        console.error("Failed to reject menu scan batch:", error)
        return { success: false, error: "Failed to reject menu scan batch" }
    }

    if (rejected === 0) {
        return { success: false, error: "Nothing left to reject" }
    }

    return { success: true, data: { rejected } }
}
