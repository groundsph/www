import { describe, expect, it } from "bun:test"
import { quickActions } from "@/utils/search-index"

describe("quickActions", () => {
  it("includes leaderboard", () => {
    expect(quickActions.some((a) => a.href === "/community?tab=leaderboard" && a.title.includes("Leaderboard"))).toBe(true)
  })
})
