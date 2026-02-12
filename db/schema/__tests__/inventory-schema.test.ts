import { describe, expect, it } from "bun:test"
import { inventoryItems, inventoryRestockHistory, inventoryItemStatusEnum } from "@/db/schema/inventory"

describe("inventory schema", () => {
    it("exports inventory tables", () => {
        expect(inventoryItems).toBeDefined()
        expect(inventoryRestockHistory).toBeDefined()
    })

    it("exports inventory item status enum", () => {
        expect(inventoryItemStatusEnum).toBeDefined()
    })
})
