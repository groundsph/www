import { describe, it, expect } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import SegmentedTabs, { getScrollFadeState } from "@/components/ui/SegmentedTabs"

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

describe("getScrollFadeState", () => {
    it("shows no fades when every tab fits", () => {
        expect(getScrollFadeState({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 }))
            .toEqual({ left: false, right: false })
    })

    it("fades only the right edge at the start of an overflowing strip", () => {
        expect(getScrollFadeState({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 }))
            .toEqual({ left: false, right: true })
    })

    it("fades both edges mid-scroll", () => {
        expect(getScrollFadeState({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 }))
            .toEqual({ left: true, right: true })
    })

    it("fades only the left edge at the end", () => {
        expect(getScrollFadeState({ scrollLeft: 300, scrollWidth: 600, clientWidth: 300 }))
            .toEqual({ left: true, right: false })
    })

    it("treats sub-pixel scroll offsets as flush", () => {
        expect(getScrollFadeState({ scrollLeft: 1, scrollWidth: 600, clientWidth: 300 }))
            .toEqual({ left: false, right: true })
    })
})
