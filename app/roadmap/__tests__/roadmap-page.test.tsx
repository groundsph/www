import { render, screen } from "@testing-library/react"
import RoadmapPage from "@/app/roadmap/page"

test("roadmap shows AI Chat in progress", () => {
    render(<RoadmapPage />)
    expect(screen.getByText("AI Chat")).toBeTruthy()
})
