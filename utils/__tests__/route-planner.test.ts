import { describe, expect, it } from "bun:test"
import { buildRoutePlan } from "@/utils/crawls/route-planner"

describe("buildRoutePlan", () => {
    it("returns an OSRM-based order and visit notes", async () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [] },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: [] },
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
        })

        expect(plan.ordered.length).toBe(2)
        expect(plan.reason).toContain("walking")
    })
})
