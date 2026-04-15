import { describe, it, expect } from "bun:test"
import { OCR_PHASE_CONFIG, type OcrPhase } from "@/utils/ocr-stream-client"

describe("OCR Phase Configuration", () => {
    it("has config for all phases", () => {
        const phases: OcrPhase[] = ["uploading", "ai-processing", "streaming", "processing-results"]
        for (const phase of phases) {
            expect(OCR_PHASE_CONFIG[phase]).toBeDefined()
            expect(OCR_PHASE_CONFIG[phase].timeoutMs).toBeGreaterThan(0)
            expect(OCR_PHASE_CONFIG[phase].label).toBeTruthy()
        }
    })

    it("uploading phase has shortest timeout relative to main phases", () => {
        expect(OCR_PHASE_CONFIG["uploading"].timeoutMs)
            .toBeLessThan(OCR_PHASE_CONFIG["ai-processing"].timeoutMs)
        expect(OCR_PHASE_CONFIG["uploading"].timeoutMs)
            .toBeLessThan(OCR_PHASE_CONFIG["streaming"].timeoutMs)
    })

    it("streaming phase has longest timeout", () => {
        expect(OCR_PHASE_CONFIG["streaming"].timeoutMs)
            .toBeGreaterThan(OCR_PHASE_CONFIG["uploading"].timeoutMs)
        expect(OCR_PHASE_CONFIG["streaming"].timeoutMs)
            .toBeGreaterThan(OCR_PHASE_CONFIG["ai-processing"].timeoutMs)
        expect(OCR_PHASE_CONFIG["streaming"].timeoutMs)
            .toBeGreaterThan(OCR_PHASE_CONFIG["processing-results"].timeoutMs)
    })
})
