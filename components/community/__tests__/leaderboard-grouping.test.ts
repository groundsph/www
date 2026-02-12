import { describe, expect, it } from "bun:test"
import { groupByRank } from "@/components/community/leaderboard-utils"

describe("groupByRank", () => {
    it("groups entries by rank", () => {
        const input = [
            { rank: 1 },
            { rank: 1 },
            { rank: 3 },
        ]
        const result = groupByRank(input)
        expect(result[1].length).toBe(2)
        expect(result[3].length).toBe(1)
    })

    it("returns empty record for empty array", () => {
        const result = groupByRank([])
        expect(Object.keys(result).length).toBe(0)
    })

    it("handles single entry", () => {
        const input = [{ rank: 1 }]
        const result = groupByRank(input)
        expect(result[1].length).toBe(1)
    })

    it("groups multiple ranks correctly", () => {
        const input = [
            { rank: 1 },
            { rank: 1 },
            { rank: 2 },
            { rank: 2 },
            { rank: 2 },
            { rank: 3 },
        ]
        const result = groupByRank(input)
        expect(result[1].length).toBe(2)
        expect(result[2].length).toBe(3)
        expect(result[3].length).toBe(1)
    })

    it("preserves entry properties", () => {
        const input = [
            { rank: 1, userId: "a", username: "alice" },
            { rank: 1, userId: "b", username: "bob" },
        ]
        const result = groupByRank(input)
        expect(result[1][0].username).toBe("alice")
        expect(result[1][1].username).toBe("bob")
    })
})
