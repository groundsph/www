"use server"

import { db } from "@/db"
import { cafeMenuItems, cafes } from "@/db/schema/tables"
import { eq, and } from "drizzle-orm"
import { calculatePriceLevel } from "@/utils/price-level"

export async function recalculatePriceLevel(cafeId: string): Promise<void> {
    const items = await db
        .select({ price: cafeMenuItems.price })
        .from(cafeMenuItems)
        .where(
            and(
                eq(cafeMenuItems.cafeId, cafeId),
                eq(cafeMenuItems.isAvailable, true)
            )
        )

    const prices = items.map(i => i.price)
    const newLevel = calculatePriceLevel(prices)

    if (newLevel) {
        await db
            .update(cafes)
            .set({ priceLevel: newLevel })
            .where(eq(cafes.id, cafeId))
    }
}
