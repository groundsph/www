import { describe, it, expect } from "bun:test"
import { collectCafeStampUrls } from "@/utils/storage/cleanup"

describe("storage cleanup", () => {
    it("includes cafe badge stamp urls", () => {
        const urls = collectCafeStampUrls([{ badgeStampUrl: "https://x" }])
        expect(urls.has("https://x")).toBe(true)
    })
})
