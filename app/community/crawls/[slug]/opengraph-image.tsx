import { ImageResponse } from "next/og"
import { db } from "@/db"
import { cafeCrawls, profiles } from "@/db/schema"
import { eq } from "drizzle-orm"

export const alt = "Cafe Crawl"
export const contentType = "image/png"
export const size = { width: 1200, height: 630 }
export const revalidate = 3600 // Cache for 1 hour

// Colors from globals.css - Community palette
const colors = {
    primary: "#74512d",
    secondary: "#af8f6f",
    tertiary: "#f1dec9",
    accent: "#bc6c25",
    background: "#f8f4e1",
    text: "#543310",
}

async function getCrawl(slug: string) {
    const result = await db
        .select({
            title: cafeCrawls.title,
            description: cafeCrawls.description,
            coverImage: cafeCrawls.coverImage,
            itemCount: cafeCrawls.itemCount,
            viewsCount: cafeCrawls.viewsCount,
            savesCount: cafeCrawls.savesCount,
            createdAt: cafeCrawls.createdAt,
            authorDisplayName: profiles.displayName,
            authorUsername: profiles.username,
            authorAvatarUrl: profiles.avatarUrl,
        })
        .from(cafeCrawls)
        .leftJoin(profiles, eq(cafeCrawls.userId, profiles.id))
        .where(eq(cafeCrawls.slug, slug))
        .limit(1)

    return result[0] || null
}

export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const crawl = await getCrawl(slug)

    // Load DM Sans Bold font
    const dmSansBold = await fetch(
        new URL(
            "https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-700-normal.ttf"
        )
    ).then((res) => res.arrayBuffer())

    // Crawl Not Found State
    if (!crawl) {
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
                    Crawl Not Found
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

    // Dynamic Image Content
    return new ImageResponse(
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                width: "100%",
                height: "100%",
                background: colors.background,
                fontFamily: "DM Sans",
            }}
        >
            {/* Left Side: Cover Image or Placeholder */}
            <div
                style={{
                    display: "flex",
                    width: 500,
                    height: "100%",
                    position: "relative",
                    background: `linear-gradient(135deg, ${colors.tertiary} 0%, ${colors.secondary} 100%)`,
                }}
            >
                {/* Only render cover if it's NOT WebP (Satori doesn't support WebP) */}
                {crawl.coverImage &&
                !crawl.coverImage.toLowerCase().endsWith(".webp") ? (
                    <img
                        src={crawl.coverImage}
                        alt=''
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                ) : (
                    <div
                        style={{
                            display: "flex",
                            width: "100%",
                            height: "100%",
                            alignItems: "center",
                            justifyContent: "center",
                            color: colors.text,
                            opacity: 0.15,
                            fontSize: 160,
                            fontWeight: 700,
                        }}
                    />
                )}
            </div>

            {/* Right Side: Details */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: "60px 60px 60px 40px",
                    justifyContent: "center",
                }}
            >
                {/* Branding */}
                <div
                    style={{
                        display: "flex",
                        fontSize: 24,
                        fontWeight: 700,
                        color: colors.accent,
                        letterSpacing: 2,
                        marginBottom: 20,
                        textTransform: "uppercase",
                    }}
                >
                    Cafe Crawl
                </div>

                {/* Title */}
                <div
                    style={{
                        display: "flex",
                        fontSize: 64,
                        fontWeight: 700,
                        color: colors.text,
                        lineHeight: 1.1,
                        marginBottom: 24,
                        maxHeight: 140,
                        overflow: "hidden",
                    }}
                >
                    {crawl.title}
                </div>

                {/* Description (Truncated) */}
                {crawl.description && (
                    <div
                        style={{
                            display: "flex",
                            fontSize: 24,
                            color: colors.text,
                            opacity: 0.8,
                            marginBottom: 40,
                            lineHeight: 1.4,
                            maxHeight: 100,
                            overflow: "hidden",
                        }}
                    >
                        {crawl.description.length > 120
                            ? crawl.description.slice(0, 120) + "..."
                            : crawl.description}
                    </div>
                )}

                {/* Author Info */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        marginBottom: "auto",
                    }}
                >
                    {crawl.authorAvatarUrl ? (
                        <img
                            src={crawl.authorAvatarUrl}
                            width={48}
                            height={48}
                            alt=''
                            style={{
                                borderRadius: 24,
                                border: `2px solid ${colors.primary}`,
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 24,
                                background: colors.primary,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: colors.background,
                                fontSize: 24,
                                fontWeight: 700,
                            }}
                        >
                            {crawl.authorDisplayName
                                ?.charAt(0)
                                .toUpperCase() || "?"}
                        </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 20,
                                fontWeight: 700,
                                color: colors.text,
                            }}
                        >
                            {crawl.authorDisplayName}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 16,
                                color: colors.secondary,
                            }}
                        >
                            @{crawl.authorUsername}
                        </div>
                    </div>
                </div>

                {/* Stats Row */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 40,
                        marginTop: 40,
                        borderTop: `2px solid ${colors.tertiary}`,
                        paddingTop: 30,
                    }}
                >
                    {/* Item Count (Stops) */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 36,
                                fontWeight: 700,
                                color: colors.primary,
                            }}
                        >
                            {crawl.itemCount || 0}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.secondary,
                                textTransform: "uppercase",
                                letterSpacing: 1,
                            }}
                        >
                            Stops
                        </div>
                    </div>

                    {/* Views Count */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 36,
                                fontWeight: 700,
                                color: colors.primary,
                            }}
                        >
                            {crawl.viewsCount || 0}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.secondary,
                                textTransform: "uppercase",
                                letterSpacing: 1,
                            }}
                        >
                            Views
                        </div>
                    </div>

                    {/* Saves Count */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 36,
                                fontWeight: 700,
                                color: colors.primary,
                            }}
                        >
                            {crawl.savesCount || 0}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.secondary,
                                textTransform: "uppercase",
                                letterSpacing: 1,
                            }}
                        >
                            Saves
                        </div>
                    </div>
                </div>

                {/* GROUNDS.PH Branding */}
                <div
                    style={{
                        display: "flex",
                        fontSize: 20,
                        fontWeight: 700,
                        color: colors.text,
                        letterSpacing: 2,
                        marginTop: 30,
                        textTransform: "uppercase",
                    }}
                >
                    GROUNDS.PH
                </div>
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
