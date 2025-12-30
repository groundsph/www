import { db } from "@/db"
import { profiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

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
            created_at: profile.createdAt?.toISOString() ?? null,
            updated_at: profile.updatedAt?.toISOString() ?? null,
        })
    } catch (err) {
        console.error("Unexpected error:", err)
        return NextResponse.json(null, { status: 500 })
    }
}
