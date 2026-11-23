import { db } from "@/db"
import { cafes } from "@/db/schema/tables"
import { eq } from "drizzle-orm"

/**
 * The stored owner list for a Cafe — the source the menu and edit-permission
 * paths read ownership from.
 *
 * Every ownership decision that uses this module reads the owner ids kept on
 * the Cafe row and compares them against a server-derived user id. Nothing here
 * accepts a caller-supplied flag or list, so a client cannot assert ownership
 * by claiming it.
 *
 * Not every ownership check in the application goes through it: `blog.ts` and
 * `events.ts` still carry their own private `isCafeOwner` helpers. They are
 * not routed through this module yet, so a change to what counts as an owner
 * has to be made in all three places until they are folded in.
 */
export async function getCafeOwnerIds(cafeId: string): Promise<string[]> {
    const result = await db
        .select({ ownerIds: cafes.ownerIds })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    return result[0]?.ownerIds ?? []
}

/** Whether the stored Cafe data lists this user as one of its owners. */
export async function isCafeOwner(cafeId: string, userId: string): Promise<boolean> {
    const ownerIds = await getCafeOwnerIds(cafeId)
    return ownerIds.includes(userId)
}
