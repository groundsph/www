"use server"

import { db } from "@/db"
import { cafes, profiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { getModeratorRegionsForCurrentUser } from "@/utils/moderation/region-access"
import { isCafeOwner } from "@/utils/owner/cafe-ownership"

/** Who may edit a Cafe, and through which surface. */
export type CafeEditRole = "admin" | "moderator" | "owner"

export interface CafeEditPermission {
    canEdit: boolean
    role: CafeEditRole | null
}

export async function getCafeEditPermission(cafeId: string): Promise<CafeEditPermission> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { canEdit: false, role: null }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    const role = profileResult[0]?.role

    // Admin: unrestricted staff editing, exactly as before.
    if (role === "admin") {
        return { canEdit: true, role: "admin" }
    }

    // Moderator: staff editing, but only inside the regions they moderate.
    // A refusal here is final — ownership never widens a scoped moderator's reach.
    if (role === "moderator") {
        const regions = await getModeratorRegionsForCurrentUser()
        if (regions.length > 0) {
            const cafeResult = await db
                .select({ region: cafes.region })
                .from(cafes)
                .where(eq(cafes.id, cafeId))
                .limit(1)

            const cafeRegion = cafeResult[0]?.region
            if (!cafeRegion || !regions.includes(cafeRegion)) {
                return { canEdit: false, role: "moderator" }
            }
        }

        return { canEdit: true, role: "moderator" }
    }

    // Everyone else: the only claim left is ownership of this very Cafe,
    // read from the stored owner list on the Cafe row.
    if (await isCafeOwner(cafeId, currentUser.id)) {
        return { canEdit: true, role: "owner" }
    }

    return { canEdit: false, role: null }
}
