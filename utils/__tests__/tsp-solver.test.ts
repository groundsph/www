import { describe, expect, it } from "bun:test"
import { solveTspExact } from "@/utils/crawls/tsp-solver"

describe("solveTspExact", () => {
    it("returns empty array for empty matrix", () => {
        const matrix: number[][] = []
        const order = solveTspExact(matrix, 0)
        expect(order).toEqual([])
    })

    it("returns [0] for single node", () => {
        const matrix = [[0]]
        const order = solveTspExact(matrix, 0)
        expect(order).toEqual([0])
    })

    it("returns correct order for 2-node matrix", () => {
        const matrix = [
            [0, 5],
            [3, 0],
        ]
        const order = solveTspExact(matrix, 0)
        expect(order).toEqual([0, 1])
    })

    it("returns a shortest route order with correct total cost", () => {
        const matrix = [
            [0, 2, 9, 10],
            [1, 0, 6, 4],
            [15, 7, 0, 8],
            [6, 3, 12, 0],
        ]
        const order = solveTspExact(matrix, 0)
        expect(order[0]).toBe(0)
        expect(order.length).toBe(4)

        // Calculate total cost of the path
        let totalCost = 0
        for (let i = 0; i < order.length - 1; i++) {
            totalCost += matrix[order[i]][order[i + 1]]
        }
        // Optimal cost for this matrix starting at 0 is 2 + 6 + 8 = 16 (0->1->2->3)
        expect(totalCost).toBe(16)
    })
})
