import { describe, it, expect } from "bun:test"
import { routes } from "@/utils/routes"

describe("community routes", () => {
  it("includes community dropdown items", () => {
    const community = routes.find((r) => r.title === "community")
    const children = community?.children?.map((c) => c.title) || []
    expect(children).toEqual(["blogs", "crawls", "collections", "events", "leaderboard"])
  })
})
