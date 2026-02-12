import { describe, expect, it } from "bun:test"
import { groupCheckInsByCafe, getLandingFeedGroupedByCafe } from "@/app/api/actions/social"
import type { FeedCheckIn } from "@/app/api/actions/social"

function createCheckIn(overrides: Partial<FeedCheckIn>): FeedCheckIn {
  return {
    id: "visit-" + Math.random().toString(36).substring(7),
    userId: "user-" + Math.random().toString(36).substring(7),
    username: "testuser",
    displayName: "Test User",
    avatarUrl: null,
    cafeId: "cafe-1",
    cafeName: "Test Cafe",
    cafeSlug: "test-cafe",
    cafeThumbnail: null,
    visitedAt: new Date().toISOString(),
    companions: [],
    ...overrides,
  }
}

describe("groupCheckInsByCafe", () => {
  it("groups check-ins by cafeId", async () => {
    const input = [
      createCheckIn({ cafeId: "1", userId: "a", visitedAt: new Date("2024-01-01").toISOString() }),
      createCheckIn({ cafeId: "1", userId: "b", visitedAt: new Date("2024-01-02").toISOString() }),
      createCheckIn({ cafeId: "2", userId: "c", visitedAt: new Date("2024-01-03").toISOString() }),
    ]
    const grouped = await groupCheckInsByCafe(input)
    expect(grouped.length).toBe(2)
  })

  it("tracks latestVisitedAt per group", async () => {
    const input = [
      createCheckIn({ cafeId: "1", userId: "a", visitedAt: new Date("2024-01-01").toISOString() }),
      createCheckIn({ cafeId: "1", userId: "b", visitedAt: new Date("2024-01-03").toISOString() }),
      createCheckIn({ cafeId: "1", userId: "c", visitedAt: new Date("2024-01-02").toISOString() }),
    ]
    const grouped = await groupCheckInsByCafe(input)
    expect(grouped.length).toBe(1)
    expect(grouped[0].latestVisitedAt).toBe(new Date("2024-01-03").toISOString())
  })

  it("aggregates unique visitors per cafe", async () => {
    const input = [
      createCheckIn({ cafeId: "1", userId: "a", username: "alice", displayName: "Alice", visitedAt: new Date("2024-01-01").toISOString() }),
      createCheckIn({ cafeId: "1", userId: "a", username: "alice", displayName: "Alice", visitedAt: new Date("2024-01-02").toISOString() }),
      createCheckIn({ cafeId: "1", userId: "b", username: "bob", displayName: "Bob", visitedAt: new Date("2024-01-03").toISOString() }),
    ]
    const grouped = await groupCheckInsByCafe(input)
    expect(grouped[0].visitors.length).toBe(2)
    expect(grouped[0].visitorCount).toBe(2)
  })

  it("sorts groups by latestVisitedAt descending", async () => {
    const input = [
      createCheckIn({ cafeId: "1", userId: "a", visitedAt: new Date("2024-01-01").toISOString() }),
      createCheckIn({ cafeId: "2", userId: "b", visitedAt: new Date("2024-01-03").toISOString() }),
      createCheckIn({ cafeId: "3", userId: "c", visitedAt: new Date("2024-01-02").toISOString() }),
    ]
    const grouped = await groupCheckInsByCafe(input)
    expect(grouped[0].cafeId).toBe("2")
    expect(grouped[1].cafeId).toBe("3")
    expect(grouped[2].cafeId).toBe("1")
  })
})

describe("getLandingFeedGroupedByCafe", () => {
  it("exists as a function", () => {
    expect(typeof getLandingFeedGroupedByCafe).toBe("function")
  })
})
