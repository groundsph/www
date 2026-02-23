import { describe, expect, it } from "bun:test"
import { solveTspExact } from "@/utils/crawls/tsp-solver"

describe("solveTspExact", () => {
    it("returns a shortest route order", () => {
        const matrix = [
            [0, 2, 9, 10],
            [1, 0, 6, 4],
            [15, 7, 0, 8],
            [6, 3, 12, 0],
        ]
        const order = solveTspExact(matrix, 0)
        expect(order[0]).toBe(0)
        expect(order.length).toBe(4)
    })
})
