import { db } from "@/db"
import { profiles, cafes } from "@/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { omitTestCafes } from "@/utils/filters"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params

        const result = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, userId))
            .limit(1)

        const profile = result[0]
        if (!profile) {
            return NextResponse.json(null, { status: 404 })
        }

        // Check if user owns any cafes
        // Narrow `omitTestCafes` on purpose, not `publicCafeConditions()`: this is
        // a stat on the owner's own public profile, so their unpublished and
        // deactivated listings still belong in the count (it reads as "this person
        // runs N cafes"). A test cafe is QA scaffolding, not a real listing, so it
        // is the only thing excluded.
        const ownedCafesResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(cafes)
            .where(
                and(
                    sql`${cafes.ownerIds} @> ARRAY[${userId}]::uuid[]`,
                    ...omitTestCafes([])
                )
            )

        const ownedCafeCount = ownedCafesResult[0]?.count ?? 0

        // Map to snake_case for consistency with existing client code
        return NextResponse.json({
            id: profile.id,
            username: profile.username,
            display_name: profile.displayName,
            avatar_url: profile.avatarUrl,
            bio: profile.bio,
            role: profile.role,
            is_supporter: profile.isSupporter,
            support_since: profile.supportSince?.toISOString() ?? null,
            supporter_expires_at: profile.supporterExpiresAt?.toISOString() ?? null,
            total_contribution: profile.totalContribution,
            profile_completed: profile.profileCompleted,
            passport: profile.passport,
            stats: profile.stats,
            owned_cafe_count: ownedCafeCount,
            created_at: profile.createdAt?.toISOString() ?? null,
            updated_at: profile.updatedAt?.toISOString() ?? null,
        })
    } catch (err) {
        console.error("Unexpected error:", err)
        return NextResponse.json(null, { status: 500 })
    }
}
