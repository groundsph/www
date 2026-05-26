import { describe, it, expect, afterEach } from "bun:test"
import { render, screen, cleanup } from "@testing-library/react"
import RoadmapPage from "@/app/roadmap/page"

describe("Roadmap", () => {
    afterEach(() => {
        cleanup()
    })

    it("shows AI Chat in progress", () => {
        render(<RoadmapPage />)
        expect(screen.getByText("AI Chat")).toBeTruthy()
    })
})
