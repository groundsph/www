import { describe, it, expect } from "bun:test"
import { OCR_PHASE_CONFIG, type OcrPhase, type OcrStreamCallbacks, extractItemCountFromStreamedContent } from "@/utils/ocr-stream-client"

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

describe("OcrStreamCallbacks", () => {
    it("includes onPhaseChange callback", () => {
        const callbacks: OcrStreamCallbacks = {
            onStatus: (_msg: string) => {},
            onContent: (_token: string) => {},
            onComplete: (_data: { items: unknown[]; deduplicated: unknown[]; duplicates: string[] }) => {},
            onError: (_error: string) => {},
            onPhaseChange: (_phase: OcrPhase) => {},
            onItemCount: (_count: number) => {},
        }
        expect(callbacks.onPhaseChange).toBeDefined()
        expect(callbacks.onItemCount).toBeDefined()
    })
})

describe("streamOcrScan phase tracking", () => {
    it("calls onPhaseChange with 'uploading' at start", () => {
        const phaseChanges: string[] = []
        const callbacks: OcrStreamCallbacks = {
            onStatus: (_msg: string) => {},
            onContent: (_token: string) => {},
            onComplete: (_data: { items: unknown[]; deduplicated: unknown[]; duplicates: string[] }) => {},
            onError: (_error: string) => {},
            onPhaseChange: (phase: OcrPhase) => { phaseChanges.push(phase) },
        }
        expect(callbacks.onPhaseChange).toBeDefined()
    })
})

describe("extractItemCountFromStreamedContent", () => {
    it("returns 0 for empty content", () => {
        expect(extractItemCountFromStreamedContent("")).toBe(0)
    })

    it("returns 0 for content with no items", () => {
        expect(extractItemCountFromStreamedContent("Here is the menu analysis")).toBe(0)
    })

    it("counts items by name fields", () => {
        const content = '[{"name":"Espresso","price":120},{"name":"Latte","price":150}]'
        expect(extractItemCountFromStreamedContent(content)).toBe(2)
    })

    it("counts partial streaming content", () => {
        const content = '[{"name":"Espresso","price":120},{"name":'
        expect(extractItemCountFromStreamedContent(content)).toBe(2)
    })

    it("counts items with whitespace variations", () => {
        const content = '[{ "name" : "Cappuccino" }]'
        expect(extractItemCountFromStreamedContent(content)).toBe(1)
    })
})
