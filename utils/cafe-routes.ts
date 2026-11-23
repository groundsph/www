import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { cafes } from "@/db/schema/tables"

/**
 * The public pages a Cafe actually serves: its page and its Menu sub-page.
 *
 * This module is the only place in the application that builds a Cafe page
 * path, so a write path cannot reintroduce the `/cafe/<id>` shape, which
 * matched no route. Call sites hand it the Cafe's stored identity (and the
 * slug when they already have it) and never assemble a path themselves.
 *
 * The Cafe index — the public list of Cafes — is a Cafe path too, so it is
 * built here as well rather than spelled at each write site.
 */

/** The Cafe index: the public list every Cafe write can change. */
const CAFE_INDEX_PATH = "/cafes"

async function lookupCafeSlug(cafeId: string): Promise<string | null> {
    try {
        const cafe = await db.query.cafes.findFirst({
            where: eq(cafes.id, cafeId),
            columns: { slug: true },
        })

        return cafe?.slug ?? null
    } catch (error) {
        // A revalidation lookup must never fail the write it follows: the data
        // is already committed and only a cached page would be stale.
        console.error("Failed to look up cafe slug for revalidation:", error)
        return null
    }
}

/**
 * The paths to revalidate for a Cafe, or an empty list when the id matches no
 * Cafe (or has no slug). Returning nothing is deliberate: an unknown identity
 * is not an error, it is simply nothing to refresh.
 */
export async function getCafeRevalidationPaths(
    cafeId: string,
    knownSlug?: string | null
): Promise<string[]> {
    const slug = knownSlug?.trim() || (await lookupCafeSlug(cafeId))
    if (!slug) return []

    return [`/cafes/${slug}`, `/cafes/${slug}/menu`]
}

/**
 * Revalidates the Cafe's public pages after a write. Safe to call with an id
 * that matches no Cafe: nothing is revalidated and no error is raised.
 */
export async function revalidateCafePages(
    cafeId: string,
    knownSlug?: string | null
): Promise<void> {
    const paths = await getCafeRevalidationPaths(cafeId, knownSlug)

    for (const path of paths) {
        revalidatePath(path)
    }
}

/**
 * Revalidates the Cafe index after a write that can change what the list shows.
 */
export function revalidateCafeIndex(): void {
    revalidatePath(CAFE_INDEX_PATH)
}
