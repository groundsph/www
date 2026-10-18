import { describe, it, expect } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import SegmentedTabs from "@/components/ui/SegmentedTabs"

const items = [
    { id: "basic", label: "Basic" },
    { id: "images", label: "Images", badge: 3, dirty: true },
    { id: "location", label: "Location", disabled: true },
]

describe("SegmentedTabs", () => {
    it("exposes a tablist with aria-selected on the active tab", () => {
        const { container } = render(
            <SegmentedTabs items={items} value='basic' onChange={() => {}} ariaLabel='Cafe sections' />
        )

        const tablist = container.querySelector("[role='tablist']")
        expect(tablist?.getAttribute("aria-label")).toBe("Cafe sections")

        const tabs = container.querySelectorAll("[role='tab']")
        expect(tabs).toHaveLength(3)
        expect(tabs[0].getAttribute("aria-selected")).toBe("true")
        expect(tabs[1].getAttribute("aria-selected")).toBe("false")
    })

    it("selects the next enabled tab on ArrowRight, skipping disabled tabs", () => {
        const changes: string[] = []
        const { container } = render(
            <SegmentedTabs items={items} value='images' onChange={(id) => changes.push(id)} ariaLabel='Cafe sections' />
        )

        fireEvent.keyDown(container.querySelector("[role='tablist']")!, { key: "ArrowRight" })

        // location is disabled, so it wraps back to basic
        expect(changes).toEqual(["basic"])
    })

    it("selects the last enabled tab on End", () => {
        const changes: string[] = []
        const { container } = render(
            <SegmentedTabs items={items} value='basic' onChange={(id) => changes.push(id)} ariaLabel='Cafe sections' />
        )

        fireEvent.keyDown(container.querySelector("[role='tablist']")!, { key: "End" })
        expect(changes).toEqual(["images"])
    })

    it("renders a count badge and a dirty dot", () => {
        const { container } = render(
            <SegmentedTabs items={items} value='basic' onChange={() => {}} ariaLabel='Cafe sections' />
        )

        expect(container.textContent).toContain("3")
        expect(container.querySelector("[data-dirty='true']")).toBeTruthy()
    })

    it("does not select a disabled tab when clicked", () => {
        const changes: string[] = []
        const { container } = render(
            <SegmentedTabs items={items} value='basic' onChange={(id) => changes.push(id)} ariaLabel='Cafe sections' />
        )

        fireEvent.click(container.querySelectorAll("[role='tab']")[2])

        expect(changes).toEqual([])
    })

    it("keeps only the active tab in the tab order", () => {
        const { container } = render(
            <SegmentedTabs items={items} value='images' onChange={() => {}} ariaLabel='Cafe sections' />
        )

        const tabs = [...container.querySelectorAll("[role='tab']")]
        expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])
    })
})
