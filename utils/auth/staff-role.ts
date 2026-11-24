import { db } from "@/db"
import { profiles } from "@/db/schema"
import { eq } from "drizzle-orm"

export interface StaffRole {
    isAdmin: boolean
    isModerator: boolean
}

/**
 * Whether this caller is staff, asked of every source that can answer.
 *
 * The app carries two role fields and they disagree in production: better-auth
 * writes `user.role` (its admin plugin's field), while the owner, edit-permission
 * and region-scoping paths read `profiles.role`. Most real staff accounts have
 * `profiles.role = admin|moderator` with `user.role = user|authenticated`, so a
 * gate that consults only `user.role` treats them as strangers — an admin's scan
 * gets queued for review and the queue then refuses to let them approve it.
 *
 * Neither field can be dropped: better-auth's admin API reads its own, and the
 * rest of the app reads the profile. So a caller is staff if either says so, and
 * admin outranks moderator.
 */
export async function getStaffRole(
    user: { id: string; role?: string | null } | null
): Promise<StaffRole> {
    if (!user) return { isAdmin: false, isModerator: false }

    // Anyone better-auth already calls staff needs no second lookup.
    if (user.role === "admin") return { isAdmin: true, isModerator: true }
    if (user.role === "moderator") return { isAdmin: false, isModerator: true }

    try {
        const [row] = await db
            .select({ role: profiles.role })
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1)

        if (row?.role === "admin") return { isAdmin: true, isModerator: true }
        if (row?.role === "moderator") return { isAdmin: false, isModerator: true }
    } catch (error) {
        // A role lookup that fails must not grant anything.
        console.error("Failed to read the caller's profile role:", error)
    }

    return { isAdmin: false, isModerator: false }
}
