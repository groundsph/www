import { describe, it, expect } from "bun:test"
import { buildChatResult, getResultIcon } from "@/components/search/search-utils"

describe("search utils", () => {
  it("maps chat icon", () => {
    expect(getResultIcon("chat")).toBe("Sparkles")
  })

  it("builds chat result for normal queries", () => {
    const result = buildChatResult("best cafes in cebu")
    expect(result?.type).toBe("chat")
  })

  it("skips chat result for quick action prefixes", () => {
    expect(buildChatResult(">map")).toBeNull()
    expect(buildChatResult("@user")).toBeNull()
    expect(buildChatResult("?best cafes")).toBeNull()
  })
})
