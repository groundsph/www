import { describe, it, expect } from "bun:test"
import { cafes } from "@/db/schema"

describe("cafes schema", () => {
    it("includes badge stamp url", () => {
        expect(cafes).toHaveProperty("badgeStampUrl")
    })
})
