import { describe, it, expect } from "bun:test"
import { escapeLikePattern } from "@/utils/sql-like"

describe("escapeLikePattern", () => {
    it("escapes %, _ and backslashes", () => {
        expect(escapeLikePattern("50% Off_Cafe")).toBe("50\\% Off\\_Cafe")
        expect(escapeLikePattern("back\\slash")).toBe("back\\\\slash")
    })

    it("leaves ordinary place names untouched", () => {
        expect(escapeLikePattern("San Fernando")).toBe("San Fernando")
        expect(escapeLikePattern("Café Makati")).toBe("Café Makati")
    })
})
