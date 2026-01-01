import { ImageResponse } from "next/og"
import { db } from "@/db"
import { collections, profiles } from "@/db/schema/tables"
import { eq } from "drizzle-orm"

export const alt = "Collection"
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

async function getCollection(slug: string) {
    const result = await db
        .select({
            title: collections.title,
            description: collections.description,
            coverImage: collections.coverImage,
            itemCount: collections.itemCount,
            viewsCount: collections.viewsCount,
            likesCount: collections.likesCount,
            createdAt: collections.createdAt,
            authorDisplayName: profiles.displayName,
            authorUsername: profiles.username,
            authorAvatarUrl: profiles.avatarUrl,
        })
        .from(collections)
        .leftJoin(profiles, eq(collections.userId, profiles.id))
        .where(eq(collections.slug, slug))
        .limit(1)

    return result[0] || null
}

export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const collection = await getCollection(slug)

    // Load DM Sans Bold font
    const dmSansBold = await fetch(
        new URL(
            "https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-700-normal.ttf"
        )
    ).then((res) => res.arrayBuffer())

    // Collection Not Found State
    if (!collection) {
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
                    Collection Not Found
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
                flexDirection: "row", // Side-by-side layout
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
                    width: 500, // Fixed width simplified
                    height: "100%",
                    position: "relative",
                    background: `linear-gradient(135deg, ${colors.tertiary} 0%, ${colors.secondary} 100%)`, // Fallback gradient
                }}
            >
                {/* Only render cover if it's NOT WebP (Satori doesn't support WebP) */}
                {collection.coverImage &&
                !collection.coverImage.toLowerCase().endsWith(".webp") ? (
                    <img
                        src={collection.coverImage}
                        alt=''
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                ) : (
                    // Placeholder gradient shown for missing or unsupported image formats
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
                    >
                        ☕
                    </div>
                )}

                {/* Overlay gradient for readability if needed, but side-by-side is cleaner */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        right: 0,
                        width: "20%",
                        background: `linear-gradient(90deg, transparent 0%, ${colors.background} 100%)`,
                    }}
                />
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
                    Cafe Collection
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
                        maxHeight: 140, // Limit height
                        overflow: "hidden",
                    }}
                >
                    {collection.title}
                </div>

                {/* Description (Truncated) */}
                {collection.description && (
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
                        {collection.description.length > 120
                            ? collection.description.slice(0, 120) + "..."
                            : collection.description}
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
                    {collection.authorAvatarUrl ? (
                        <img
                            src={collection.authorAvatarUrl}
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
                            {collection.authorDisplayName
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
                            {collection.authorDisplayName}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 16,
                                color: colors.secondary,
                            }}
                        >
                            @{collection.authorUsername}
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
                    {/* Item Count */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 36,
                                fontWeight: 700,
                                color: colors.primary,
                            }}
                        >
                            {collection.itemCount || 0}
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
                            Cafes
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
                            {collection.viewsCount || 0}
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

                    {/* Likes Count */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 36,
                                fontWeight: 700,
                                color: colors.primary,
                            }}
                        >
                            {collection.likesCount || 0}
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
                            Likes
                        </div>
                    </div>
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
