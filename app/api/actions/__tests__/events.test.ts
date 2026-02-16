import { describe, it, expect } from "bun:test"
import { canAutoPublishCommunityEventForTest } from "@/app/api/actions/events"

describe("canAutoPublishCommunityEvent", () => {
    it("allows admin/moderator", async () => {
        const result = await canAutoPublishCommunityEventForTest({
            isAdminOrModerator: async () => true,
            isOwner: async () => false,
            userId: "u1",
        })
        expect(result).toBe(true)
    })

    it("allows cafe owner", async () => {
        const result = await canAutoPublishCommunityEventForTest({
            isAdminOrModerator: async () => false,
            isOwner: async () => true,
            userId: "u1",
        })
        expect(result).toBe(true)
    })

    it("blocks regular user", async () => {
        const result = await canAutoPublishCommunityEventForTest({
            isAdminOrModerator: async () => false,
            isOwner: async () => false,
            userId: "u1",
        })
        expect(result).toBe(false)
    })
})
