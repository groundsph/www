import { describe, it, expect } from "bun:test"
import { calculateOverallProgress, type SubmissionStep } from "@/components/submit/SubmissionProgress"

function steps(...states: SubmissionStep[]): SubmissionStep[] {
    return states
}

describe("calculateOverallProgress", () => {
    it("returns 0 for an empty report", () => {
        expect(calculateOverallProgress([])).toBe(0)
    })

    it("counts a done step as complete", () => {
        expect(calculateOverallProgress(steps(
            { id: "cafe", label: "Creating your cafe", state: "done" },
        ))).toBe(100)
    })

    it("counts an active upload by its progress", () => {
        expect(calculateOverallProgress(steps(
            { id: "cover", label: "Uploading cover photo", state: "done" },
            { id: "gallery", label: "Uploading gallery photos", state: "active", progress: 50 },
        ))).toBe(75)
    })

    it("ignores pending and failed steps", () => {
        expect(calculateOverallProgress(steps(
            { id: "proofs", label: "Uploading ownership proofs", state: "error" },
            { id: "cafe", label: "Creating your cafe", state: "pending" },
        ))).toBe(0)
    })

    it("clamps out-of-range progress values", () => {
        expect(calculateOverallProgress(steps(
            { id: "gallery", label: "Uploading gallery photos", state: "active", progress: 480 },
        ))).toBe(100)
        expect(calculateOverallProgress(steps(
            { id: "gallery", label: "Uploading gallery photos", state: "active", progress: -20 },
        ))).toBe(0)
    })
})
