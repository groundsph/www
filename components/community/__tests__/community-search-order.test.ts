import { describe, it, expect } from "bun:test"
import { COMMUNITY_TAB_ORDER } from "@/components/community/community-search-order"

describe("community search order", () => {
  it("matches the tab order", () => {
    expect(COMMUNITY_TAB_ORDER).toEqual(["blogs", "crawls", "collections", "events", "leaderboard"])
  })
})
