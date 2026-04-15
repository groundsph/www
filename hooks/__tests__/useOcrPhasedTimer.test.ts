import { describe, it, expect } from "bun:test"
import { getPhaseProgress, getOverallProgress, type OcrPhase, OCR_PHASE_CONFIG } from "@/hooks/useOcrPhasedTimer"

describe("getPhaseProgress", () => {
    it("returns 0 at start of phase", () => {
        expect(getPhaseProgress("uploading", 0)).toBe(0)
    })

    it("returns 100 at end of phase", () => {
        const timeout = OCR_PHASE_CONFIG["uploading"].timeoutMs
        expect(getPhaseProgress("uploading", timeout)).toBe(100)
    })

    it("returns correct percentage mid-phase", () => {
        const timeout = OCR_PHASE_CONFIG["uploading"].timeoutMs
        const result = getPhaseProgress("uploading", timeout / 2)
        expect(result).toBe(50)
    })

    it("clamps to 100 when exceeding timeout", () => {
        expect(getPhaseProgress("uploading", 999999)).toBe(100)
    })
})

describe("getOverallProgress", () => {
    it("returns 0 at the very start", () => {
        expect(getOverallProgress("uploading", 0)).toBe(0)
    })

    it("returns higher percentage when in later phases", () => {
        const p1 = getOverallProgress("uploading", 0)
        const p2 = getOverallProgress("streaming", 0)
        expect(p2).toBeGreaterThan(p1)
    })

    it("returns 100 when phase is complete", () => {
        expect(getOverallProgress("processing-results", OCR_PHASE_CONFIG["processing-results"].timeoutMs)).toBe(100)
    })
})
