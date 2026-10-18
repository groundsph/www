import { describe, it, expect } from "bun:test"
import { getTableColumns } from "drizzle-orm"
import { cafes } from "@/db/schema/tables"

describe("cafes table", () => {
    it("allows a cafe to have no cover image", () => {
        const columns = getTableColumns(cafes)
        expect(columns.thumbnail.notNull).toBe(false)
    })

    it("still stores the gallery as a nullable array", () => {
        const columns = getTableColumns(cafes)
        expect(columns.gallery.notNull).toBe(false)
    })
})
