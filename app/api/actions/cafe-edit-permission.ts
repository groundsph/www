"use server"

import { db } from "@/db"
import { cafes, profiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { getModeratorRegionsForCurrentUser } from "@/utils/moderation/region-access"

export interface CafeEditPermission {
    canEdit: boolean
    role: "admin" | "moderator" | null
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

    if (role !== "admin" && role !== "moderator") {
        return { canEdit: false, role: null }
    }

    // For moderators, check region scope
    if (role === "moderator") {
        const regions = await getModeratorRegionsForCurrentUser()
        if (regions.length > 0) {
            // Moderator has region restrictions - check cafe region
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
    }

    return { canEdit: true, role: role as "admin" | "moderator" }
}
