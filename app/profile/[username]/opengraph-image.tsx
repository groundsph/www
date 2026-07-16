import { ImageResponse } from "next/og"
import { db } from "@/db"
import { profiles } from "@/db/schema/tables"
import { eq } from "drizzle-orm"

export const alt = "Profile"
export const contentType = "image/png"
export const size = { width: 1200, height: 630 }
export const revalidate = 3600 // Cache for 1 hour

// Colors from globals.css
const colors = {
    primary: "#74512d",
    secondary: "#af8f6f",
    tertiary: "#f1dec9",
    accent: "#bc6c25",
    background: "#f8f4e1",
    text: "#543310",
}

// Simple query to avoid importing heavy profile function
async function getProfile(username: string) {
    const result = await db
        .select({
            displayName: profiles.displayName,
            username: profiles.username,
            avatarUrl: profiles.avatarUrl,
            isSupporter: profiles.isSupporter,
            stats: profiles.stats,
            bio: profiles.bio,
            createdAt: profiles.createdAt,
        })
        .from(profiles)
        .where(eq(profiles.username, username))
        .limit(1)
    return result[0] || null
}

export default async function Image({
    params,
}: {
    params: Promise<{ username: string }>
}) {
    const { username } = await params
    const profile = await getProfile(username)

    // Load DM Sans Bold font
    const dmSansBold = await fetch(
        new URL(
            "https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-700-normal.ttf"
        )
    ).then((res) => res.arrayBuffer())

    if (!profile) {
        return new ImageResponse(
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                    background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.tertiary} 50%, ${colors.secondary} 100%)`,
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "DM Sans",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        fontSize: 64,
                        fontWeight: 700,
                        color: colors.text,
                    }}
                >
                    Profile Not Found
                </div>
            </div>,
            {
                ...size,
                fonts: [
                    {
                        name: "DM Sans",
                        data: dmSansBold,
                        style: "normal",
                        weight: 700,
                    },
                ],
            }
        )
    }

    const stats = profile.stats as {
        scout_rank?: string
        total_photos?: number
        total_reviews?: number
        total_scouted?: number
    } | null

    return new ImageResponse(
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.tertiary} 50%, ${colors.secondary} 100%)`,
                padding: 60,
                fontFamily: "DM Sans",
            }}
        >
            {/* Header: Avatar on left, Name/Username on right */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 40,
                }}
            >
                {/* Avatar */}
                {profile.avatarUrl ? (
                    <img
                        src={profile.avatarUrl}
                        width={140}
                        height={140}
                        alt=''
                        style={{
                            borderRadius: 70,
                            border: `4px solid ${colors.primary}`,
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: 140,
                            height: 140,
                            borderRadius: 70,
                            background: colors.primary,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 64,
                            color: colors.background,
                            fontWeight: 700,
                        }}
                    >
                        {profile.displayName?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                )}

                {/* Name and Username */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            fontSize: 56,
                            fontWeight: 700,
                            color: colors.text,
                        }}
                    >
                        {profile.displayName}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            fontSize: 28,
                            fontWeight: 700,
                            color: colors.primary,
                        }}
                    >
                        @{profile.username}
                    </div>
                    {profile.createdAt && (
                        <div
                            style={{
                                display: "flex",
                                fontSize: 20,
                                fontWeight: 700,
                                color: colors.secondary,
                                marginTop: 12,
                            }}
                        >
                            Joined{" "}
                            {new Date(profile.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                    month: "long",
                                    year: "numeric",
                                }
                            )}
                        </div>
                    )}
                    {profile.bio && (
                        <div
                            style={{
                                display: "flex",
                                fontSize: 20,
                                fontWeight: 700,
                                color: colors.text,
                                marginTop: 12,
                                maxWidth: 600,
                                lineHeight: 1.4,
                                opacity: 0.8,
                            }}
                        >
                            {profile.bio.length > 80
                                ? profile.bio.slice(0, 80) + "..."
                                : profile.bio}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Row (4 cards horizontal) */}
            {stats && (
                <div
                    style={{
                        display: "flex",
                        gap: 16,
                        marginTop: 50,
                        width: "100%",
                    }}
                >
                    {/* Scout Rank */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flex: 1,
                            height: 100,
                            padding: 16,
                            background: colors.tertiary,
                            borderRadius: 12,
                            border: `2px solid ${colors.secondary}66`,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                fontSize: 28,
                                fontWeight: 700,
                                color: colors.text,
                                textTransform: "capitalize",
                            }}
                        >
                            {stats.scout_rank || "Novice"}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.secondary,
                                marginTop: 0,
                            }}
                        >
                            Scout Rank
                        </div>
                    </div>

                    {/* Reviews */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            height: 100,
                            background: colors.tertiary,
                            borderRadius: 12,
                            border: `2px solid ${colors.secondary}66`,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                fontSize: 36,
                                fontWeight: 700,
                                color: colors.text,
                            }}
                        >
                            {stats.total_reviews || 0}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.secondary,
                                marginTop: 4,
                            }}
                        >
                            Reviews
                        </div>
                    </div>

                    {/* Photos */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            height: 100,
                            background: colors.tertiary,
                            borderRadius: 12,
                            border: `2px solid ${colors.secondary}66`,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                fontSize: 36,
                                fontWeight: 700,
                                color: colors.text,
                            }}
                        >
                            {stats.total_photos || 0}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.secondary,
                                marginTop: 4,
                            }}
                        >
                            Photos
                        </div>
                    </div>

                    {/* Scouted */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            height: 100,
                            background: colors.tertiary,
                            borderRadius: 12,
                            border: `2px solid ${colors.secondary}66`,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                fontSize: 36,
                                fontWeight: 700,
                                color: colors.text,
                            }}
                        >
                            {stats.total_scouted || 0}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.secondary,
                                marginTop: 4,
                            }}
                        >
                            Scouted
                        </div>
                    </div>
                </div>
            )}

            {/* GROUNDSPH branding at bottom */}
            <div
                style={{
                    display: "flex",
                    position: "absolute",
                    bottom: 40,
                    left: 60,
                    fontSize: 28,
                    fontWeight: 700,
                    color: colors.text,
                    letterSpacing: 4,
                }}
            >
                GROUNDSPH
            </div>
        </div>,
        {
            ...size,
            fonts: [
                {
                    name: "DM Sans",
                    data: dmSansBold,
                    style: "normal",
                    weight: 700,
                },
            ],
        }
    )
}
