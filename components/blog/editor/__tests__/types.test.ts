import { describe, it, expect } from "bun:test"
import type { RichBlogEditorProps, AutoSaveState, SaveStatus } from "../types"

describe("editor types", () => {
    it("SaveStatus includes all expected values", () => {
        const statuses: SaveStatus[] = ["idle", "saving", "saved", "error"]
        expect(statuses).toHaveLength(4)
    })

    it("AutoSaveState has correct shape for saved state", () => {
        const state: AutoSaveState = { status: "saved", lastSaved: new Date() }
        expect(state.status).toBe("saved")
        expect(state.lastSaved).toBeInstanceOf(Date)
    })

    it("AutoSaveState has correct shape for error state", () => {
        const state: AutoSaveState = { status: "error", error: "Network failed" }
        expect(state.status).toBe("error")
        expect(state.error).toBe("Network failed")
    })

    it("AutoSaveState has correct shape for idle state", () => {
        const state: AutoSaveState = { status: "idle" }
        expect(state.status).toBe("idle")
    })
})
