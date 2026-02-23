import { describe, it, expect } from "bun:test"
import { buildRoutePlan } from "@/utils/crawls/route-planner"

describe("buildRoutePlan", () => {
    it("orders cafes by centroid + nearest neighbor and returns rationale", () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, rating: 4.6 },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, rating: 4.2 },
            { id: "3", name: "C", slug: "c", lat: 10.3200, lng: 123.8800, rating: 4.8 },
        ]

        const plan = buildRoutePlan(cafes)

        expect(plan.ordered.length).toBe(3)
        expect(plan.reason).toContain("centroid")
        expect(plan.reason).toContain("nearest")
    })
})
