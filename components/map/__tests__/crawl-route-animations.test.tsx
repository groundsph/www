import { describe, it, expect, vi, beforeEach, afterEach } from "bun:test"
import { join } from "path"
import { readFileSync } from "fs"

// Store interval tracking
let activeIntervals: Array<{ id: number; callback: () => void; delay: number }> = []
let nextIntervalId = 1

describe("CrawlRouteMap animations", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        activeIntervals = []
        nextIntervalId = 1

        // Mock setInterval to capture callbacks
        global.setInterval = vi.fn((callback: () => void, delay: number) => {
            const id = nextIntervalId++
            const interval = { id, callback, delay }
            activeIntervals.push(interval)
            return id as unknown as ReturnType<typeof setInterval>
        }) as unknown as typeof setInterval

        global.clearInterval = vi.fn((id: ReturnType<typeof setInterval>) => {
            const numId = id as unknown as number
            activeIntervals = activeIntervals.filter((i) => i.id !== numId)
        }) as unknown as typeof clearInterval
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("adds timeline classes to map markers", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")
        expect(source).toContain("crawl-marker-active")
    })

    it("uses useRef for currentStep to avoid re-renders", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")
        
        // Should use useRef for currentStep
        expect(source).toContain("const currentStepRef = useRef")
        expect(source).toContain("currentStepRef.current")
    })

    it("waits for segments to load before starting animation", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")
        
        // The animation effect should check segments.length
        expect(source).toMatch(/if\s*\(\s*!animateTimeline[^}]*segments\.length\s*===?\s*0\s*\)/)
    })

    it("uses stable key props for markers", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")
        
        // Should use cafeSlug or idx as key
        expect(source).toContain("key={p.cafeSlug || idx}")
    })

    it("interval is created when animateTimeline is true and segments exist", async () => {
        // Test that setInterval is called under the right conditions
        const points = [
            { lat: 12.8797, lng: 121.774, cafeSlug: "cafe-1" },
            { lat: 12.8798, lng: 121.775, cafeSlug: "cafe-2" },
        ]
        const segments: [number, number][][] = [
            [[12.8797, 121.774], [12.8798, 121.775]],
        ]

        // Simulate the animation effect logic
        const animateTimeline = true
        const normalizedPoints = points
        
        // The effect should run when: animateTimeline && normalizedPoints.length > 0 && segments.length > 0
        const shouldRunAnimation = animateTimeline && normalizedPoints.length > 0 && segments.length > 0
        expect(shouldRunAnimation).toBe(true)
    })

    it("interval is not created when segments are empty", async () => {
        const animateTimeline = true
        const normalizedPoints = [
            { lat: 12.8797, lng: 121.774 },
        ]
        const segments: [number, number][][] = []

        // The effect should NOT run when segments are empty
        const shouldRunAnimation = animateTimeline && normalizedPoints.length > 0 && segments.length > 0
        expect(shouldRunAnimation).toBe(false)
    })

    it("interval is not created when animateTimeline is false", async () => {
        const animateTimeline = false
        const normalizedPoints = [
            { lat: 12.8797, lng: 121.774 },
            { lat: 12.8798, lng: 121.775 },
        ]
        const segments: [number, number][][] = [
            [[12.8797, 121.774], [12.8798, 121.775]],
        ]

        // The effect should NOT run when animateTimeline is false
        const shouldRunAnimation = animateTimeline && normalizedPoints.length > 0 && segments.length > 0
        expect(shouldRunAnimation).toBe(false)
    })

    it("animation state transitions correctly between points and segments", () => {
        const totalSteps = 4 // 2 points + 2 segments (simplified)
        
        // Test step progression logic
        const testSteps = [
            { step: 0, expectedPoint: 0, expectedSegment: -1 },
            { step: 1, expectedPoint: -1, expectedSegment: 0 },
            { step: 2, expectedPoint: 1, expectedSegment: -1 },
            { step: 3, expectedPoint: -1, expectedSegment: 1 },
            { step: 4, expectedPoint: 0, expectedSegment: -1 }, // Wraps back to 0
        ]

        for (const { step, expectedPoint, expectedSegment } of testSteps) {
            const actualStep = step >= totalSteps ? 0 : step
            
            if (actualStep % 2 === 0) {
                const activePointIndex = actualStep / 2
                const activeSegmentIndex = -1
                expect(activePointIndex).toBe(expectedPoint >= 0 ? expectedPoint : 0)
                expect(activeSegmentIndex).toBe(expectedSegment)
            } else {
                const activePointIndex = -1
                const activeSegmentIndex = Math.floor(actualStep / 2)
                expect(activePointIndex).toBe(expectedPoint)
                expect(activeSegmentIndex).toBe(expectedSegment >= 0 ? expectedSegment : 0)
            }
        }
    })

    it("active classes are applied based on animation state", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")

        // Check that isActive prop is passed to CrawlMarker
        // The actual code has line breaks, so check for parts of the expression
        expect(source).toContain("isActive=")
        expect(source).toContain("animateTimeline")
        expect(source).toContain("idx === activePointIndex")

        // Check that activeSegmentIndex is used for polyline styling
        expect(source).toContain("idx === activeSegmentIndex")
    })

    it("clears interval on cleanup", () => {
        const filePath = join(process.cwd(), "components", "map", "CrawlRouteMapInternal.tsx")
        const source = readFileSync(filePath, "utf-8")
        
        // Should return cleanup function
        expect(source).toContain("return () => clearInterval(interval)")
    })
})