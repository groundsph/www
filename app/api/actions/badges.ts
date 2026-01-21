"use server"

import { db } from "@/db"
import { badgeDefinitions } from "@/db/schema"
import { eq } from "drizzle-orm"

export interface BadgeDetails {
    id: string
    name: string
    description: string
    image_url: string
    category: "achievement" | "monetary" | "social"
    rarity: "common" | "rare" | "legendary"
    metadata: { icon_name?: string; icon_color?: string } | null
}

export async function getBadgeByName(
    name: string,
): Promise<BadgeDetails | null> {
    const result = await db
        .select({
            id: badgeDefinitions.id,
            name: badgeDefinitions.name,
            description: badgeDefinitions.description,
            image_url: badgeDefinitions.imageUrl,
            category: badgeDefinitions.category,
            rarity: badgeDefinitions.rarity,
            metadata: badgeDefinitions.metadata,
        })
        .from(badgeDefinitions)
        .where(eq(badgeDefinitions.name, name))
        .limit(1)

    if (!result[0]) return null

    return {
        ...result[0],
        metadata: result[0].metadata as BadgeDetails["metadata"],
    }
}
