import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test"
import { buildRoutePlan } from "@/utils/crawls/route-planner"

const originalFetch = globalThis.fetch

describe("buildRoutePlan", () => {
    beforeEach(() => {
        // Mock fetch to avoid actual network calls
        globalThis.fetch = mock(async () => {
            return new Response(JSON.stringify({
                durations: [
                    [0, 600, 900],
                    [600, 0, 300],
                    [900, 300, 0]
                ]
            }), { status: 200 })
        })
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

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

    it("throws error for invalid startTime format", async () => {
        const cafes = [{ id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [] }]

        await expect(
            buildRoutePlan(cafes, {
                startDay: "mon",
                startTime: "invalid",
                travelMode: "foot",
            })
        ).rejects.toThrow("Invalid startTime format")
    })

    it("returns empty array for 0 cafes", async () => {
        const plan = await buildRoutePlan([], {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
        })

        expect(plan.ordered).toHaveLength(0)
        expect(plan.schedule).toHaveLength(0)
        expect(plan.reason).toContain("No valid cafes")
    })

    it("handles single cafe", async () => {
        const cafes = [{ id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [] }]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
        })

        expect(plan.ordered).toHaveLength(1)
        expect(plan.schedule).toHaveLength(1)
        expect(plan.schedule[0].arrivalTime).toBe("09:00")
        expect(plan.reason).toContain("one stop")
    })

    it("handles two cafes", async () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [] },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: [] },
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
            dwellMinutes: 30,
        })

        expect(plan.ordered).toHaveLength(2)
        expect(plan.schedule).toHaveLength(2)
        expect(plan.schedule[0].arrivalTime).toBe("09:00")
        expect(plan.reason).toContain("Two stops")
    })

    it("filters out cafes without coordinates", async () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: null, lng: null, operatingHours: [] },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: [] },
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
        })

        expect(plan.ordered).toHaveLength(1)
        expect(plan.ordered[0].id).toBe("2")
    })

    it("respects opening hours", async () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [
                { day: "mon", open: "08:00", close: "17:00" }
            ]},
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: [
                { day: "mon", open: "10:00", close: "20:00" }
            ]},
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
            dwellMinutes: 45,
        })

        expect(plan.schedule[0].note).toContain("Visit around 09:00")
        expect(plan.schedule[1].note).toContain("Visit around")
    })

    it("handles cross-day scheduling", async () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [] },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: [] },
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "fri",
            startTime: "23:30",
            travelMode: "foot",
            dwellMinutes: 45,
        })

        expect(plan.schedule[0].arrivalDay).toBe("fri")
        expect(plan.schedule[0].arrivalTime).toBe("23:30")
        expect(plan.schedule[1].arrivalDay).toBe("sat")
    })

    it("works with driving mode", async () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [] },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: [] },
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "car",
        })

        expect(plan.reason).toContain("driving")
    })

    it("handles cafes without operating hours", async () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: undefined },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: null },
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
        })

        expect(plan.ordered).toHaveLength(2)
        expect(plan.schedule[0].note).toContain("Visit around")
        expect(plan.schedule[1].note).toContain("Visit around")
    })

    it("schedules multiple cafes with travel times", async () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [] },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: [] },
            { id: "3", name: "C", slug: "c", lat: 10.3180, lng: 123.8810, operatingHours: [] },
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
            dwellMinutes: 30,
        })

        expect(plan.ordered).toHaveLength(3)
        expect(plan.schedule).toHaveLength(3)
        expect(plan.schedule[0].arrivalTime).toBe("09:00")
    })

    it("falls back to euclidean distance on OSRM failure", async () => {
        globalThis.fetch = mock(async () => {
            return new Response(null, { status: 500 })
        })

        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [] },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: [] },
            { id: "3", name: "C", slug: "c", lat: 10.3180, lng: 123.8810, operatingHours: [] },
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
        })

        expect(plan.ordered).toHaveLength(3)
        expect(plan.schedule).toHaveLength(3)
    })
})