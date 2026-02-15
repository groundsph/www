import { describe, it, expect } from "bun:test"
import { getResultIcon } from "@/components/search/search-utils"

describe("getResultIcon", () => {
  it("maps new content types", () => {
    expect(getResultIcon("blog")).toBe("FileText")
    expect(getResultIcon("crawl")).toBe("MapIcon")
    expect(getResultIcon("collection")).toBe("Layers")
    expect(getResultIcon("event")).toBe("Calendar")
  })
})
