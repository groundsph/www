import { describe, expect, it } from "bun:test"
import { applyTieRanking } from "@/utils/leaderboard"

describe("applyTieRanking", () => {
  it("assigns same rank to equal counts (dense ranking)", () => {
    const input = [
      { userId: "a", visitCount: 10 },
      { userId: "b", visitCount: 10 },
      { userId: "c", visitCount: 8 },
    ]
    const result = applyTieRanking(input)
    expect(result.map((r) => r.rank)).toEqual([1, 1, 2])
  })

  it("handles no ties correctly", () => {
    const input = [
      { userId: "a", visitCount: 10 },
      { userId: "b", visitCount: 9 },
      { userId: "c", visitCount: 8 },
    ]
    const result = applyTieRanking(input)
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it("handles multiple ties with dense ranking", () => {
    const input = [
      { userId: "a", visitCount: 10 },
      { userId: "b", visitCount: 10 },
      { userId: "c", visitCount: 10 },
      { userId: "d", visitCount: 8 },
      { userId: "e", visitCount: 8 },
      { userId: "f", visitCount: 5 },
    ]
    const result = applyTieRanking(input)
    // Dense ranking: 3 people tied for 1st, next 2 tied for 2nd, last is 3rd
    expect(result.map((r) => r.rank)).toEqual([1, 1, 1, 2, 2, 3])
  })

  it("handles empty array", () => {
    const input: { userId: string; visitCount: number }[] = []
    const result = applyTieRanking(input)
    expect(result).toEqual([])
  })

  it("preserves all input data", () => {
    const input = [
      { userId: "a", visitCount: 10, extra: "data" },
      { userId: "b", visitCount: 10 },
    ]
    const result = applyTieRanking(input)
    expect(result[0].userId).toBe("a")
    expect(result[0].visitCount).toBe(10)
    expect((result[0] as { extra: string }).extra).toBe("data")
    expect(result[1].userId).toBe("b")
    expect(result[1].visitCount).toBe(10)
  })

  it("supports custom score keys", () => {
    const input = [
      { userId: "a", score: 12 },
      { userId: "b", score: 12 },
      { userId: "c", score: 6 },
    ]
    const result = applyTieRanking(input, { scoreKey: "score" })
    expect(result.map((r) => r.rank)).toEqual([1, 1, 2])
  })

  it("defaults to visitCount when scoreKey not provided", () => {
    const input = [
      { userId: "a", visitCount: 5 },
      { userId: "b", visitCount: 4 },
    ]
    const result = applyTieRanking(input)
    expect(result.map((r) => r.rank)).toEqual([1, 2])
  })
})
