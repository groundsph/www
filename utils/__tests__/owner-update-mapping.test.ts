import { describe, it, expect } from "bun:test"
import { mapOwnerCafeUpdates } from "@/utils/owner/update-mapping"

describe("owner update mapping", () => {
    it("maps badge_stamp_url", () => {
        const result = mapOwnerCafeUpdates({ badge_stamp_url: "https://..." })
        expect(result.badgeStampUrl).toBe("https://...")
    })
})
