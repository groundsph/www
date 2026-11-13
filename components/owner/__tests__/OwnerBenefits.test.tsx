import { describe, it, expect, afterEach } from "bun:test"
import { render, screen, cleanup } from "@testing-library/react"
import OwnerBenefits from "@/components/owner/OwnerBenefits"
import {
    BENEFIT_GROUPS,
    CLAIM_STEPS,
    CLAIM_STEPS_HEADING,
    CONTACT_CTA,
    FAQ_HEADING,
    FAQ_ITEMS,
    FREE_PILLARS,
    INCLUDED_FEATURES,
    INCLUDED_HEADING,
} from "@/components/owner/owner-benefits-content"

describe("OwnerBenefits — hero", () => {
    afterEach(() => {
        cleanup()
    })

    it("renders the page headline exactly once as an h1", () => {
        const { container } = render(<OwnerBenefits />)
        const h1s = container.querySelectorAll("h1")
        expect(h1s.length).toBe(1)
        expect(h1s[0].textContent).toBe("Your cafe, finally yours online")
    })

    it("answers the cost question on the first screen", () => {
        render(<OwnerBenefits />)
        expect(screen.getByText(/Free to claim\. Free to manage\./)).toBeTruthy()
    })

    it("links both calls to action to real destinations", () => {
        const { container } = render(<OwnerBenefits />)
        const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
            a.getAttribute("href")
        )
        expect(hrefs).toContain("/cafes")
        expect(hrefs).toContain("/submit")
    })
})

describe("OwnerBenefits — free pillars", () => {
    afterEach(() => {
        cleanup()
    })

    it("renders every pillar with its description", () => {
        render(<OwnerBenefits />)
        for (const pillar of FREE_PILLARS) {
            expect(screen.getByText(pillar.title)).toBeTruthy()
            expect(screen.getByText(pillar.description)).toBeTruthy()
        }
    })

    it("explains the optional donation without gating access", () => {
        render(<OwnerBenefits />)
        expect(screen.getByText(/optional way to chip in/i)).toBeTruthy()
    })
})

describe("OwnerBenefits — benefit groups", () => {
    afterEach(() => {
        cleanup()
    })

    it("renders every group with its heading and intro", () => {
        render(<OwnerBenefits />)
        for (const group of BENEFIT_GROUPS) {
            expect(screen.getByText(group.title)).toBeTruthy()
            expect(screen.getByText(group.intro)).toBeTruthy()
        }
    })

    it("renders every benefit as an h3 with its description", () => {
        const { container } = render(<OwnerBenefits />)
        const h3Texts = Array.from(container.querySelectorAll("h3")).map(
            (heading) => heading.textContent
        )
        for (const group of BENEFIT_GROUPS) {
            for (const item of group.items) {
                expect(h3Texts).toContain(item.title)
                expect(screen.getByText(item.description)).toBeTruthy()
            }
        }
    })

    it("keeps group headings at h2 level", () => {
        const { container } = render(<OwnerBenefits />)
        const h2Texts = Array.from(container.querySelectorAll("h2")).map(
            (heading) => heading.textContent
        )
        for (const group of BENEFIT_GROUPS) {
            expect(h2Texts).toContain(group.title)
        }
    })

    it("gives each group an in-page anchor id", () => {
        const { container } = render(<OwnerBenefits />)
        for (const group of BENEFIT_GROUPS) {
            expect(container.querySelector(`#${group.id}`)).toBeTruthy()
        }
    })
})

describe("OwnerBenefits — claim steps", () => {
    afterEach(() => {
        cleanup()
    })

    it("renders the four claim steps as an ordered list", () => {
        const { container } = render(<OwnerBenefits />)
        const items = container.querySelectorAll("ol > li")
        expect(items.length).toBe(4)
        expect(screen.getByText(CLAIM_STEPS_HEADING)).toBeTruthy()
    })

    it("numbers the steps from one to four", () => {
        const { container } = render(<OwnerBenefits />)
        const markers = Array.from(container.querySelectorAll("ol > li > span")).map(
            (span) => span.textContent
        )
        expect(markers).toEqual(["1", "2", "3", "4"])
    })

    it("keeps the claim steps in narrative order", () => {
        const { container } = render(<OwnerBenefits />)
        const h3Texts = Array.from(container.querySelectorAll("h3")).map(
            (heading) => heading.textContent
        )
        const positions = CLAIM_STEPS.map((step) => h3Texts.indexOf(step.title))
        for (const position of positions) {
            expect(position).toBeGreaterThanOrEqual(0)
        }
        const ascending = [...positions].sort((a, b) => a - b)
        expect(positions).toEqual(ascending)
    })
})

describe("OwnerBenefits — inclusions", () => {
    afterEach(() => {
        cleanup()
    })

    it("lists every included feature", () => {
        const { container } = render(<OwnerBenefits />)
        expect(screen.getByText(INCLUDED_HEADING)).toBeTruthy()
        // Each inclusion renders as a bold lead plus a muted detail line, so the
        // full sentence is asserted against the item's text content rather than
        // a single text node.
        const lineTexts = Array.from(container.querySelectorAll("li")).map(
            (item) => (item.textContent ?? "").replace(/\s+/g, " ").trim()
        )
        for (const feature of INCLUDED_FEATURES) {
            expect(lineTexts).toContain(feature)
        }
    })

    it("renders the inclusions as a list with nine entries", () => {
        const { container } = render(<OwnerBenefits />)
        const lists = container.querySelectorAll("ul")
        const inclusionList = Array.from(lists).find(
            (list) => list.querySelectorAll("li").length === 9
        )
        expect(inclusionList).toBeTruthy()
    })
})

describe("OwnerBenefits — FAQ", () => {
    afterEach(() => {
        cleanup()
    })

    it("uses native details elements so the FAQ works without JavaScript", () => {
        const { container } = render(<OwnerBenefits />)
        expect(screen.getByText(FAQ_HEADING)).toBeTruthy()
        expect(container.querySelectorAll("details").length).toBe(
            FAQ_ITEMS.length
        )
    })

    it("exposes every question as a summary", () => {
        const { container } = render(<OwnerBenefits />)
        const summaries = Array.from(
            container.querySelectorAll("summary")
        ).map((summary) => summary.textContent ?? "")
        expect(summaries.length).toBe(FAQ_ITEMS.length)
        for (const faq of FAQ_ITEMS) {
            expect(summaries.some((text) => text.includes(faq.question))).toBe(
                true
            )
        }
    })

    it("renders every answer", () => {
        render(<OwnerBenefits />)
        for (const faq of FAQ_ITEMS) {
            expect(screen.getByText(faq.answer)).toBeTruthy()
        }
    })
})

describe("OwnerBenefits — closing", () => {
    afterEach(() => {
        cleanup()
    })

    it("repeats both calls to action at the end of the page", () => {
        const { container } = render(<OwnerBenefits />)
        const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
            a.getAttribute("href")
        )
        expect(hrefs.filter((href) => href === "/cafes").length).toBe(2)
        expect(hrefs.filter((href) => href === "/submit").length).toBe(2)
    })

    it("offers an escape hatch for already-claimed cafes", () => {
        const { container } = render(<OwnerBenefits />)
        const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
            a.getAttribute("href")
        )
        expect(hrefs).toContain(CONTACT_CTA.href)
    })

    it("links the legal pages from the footnote", () => {
        const { container } = render(<OwnerBenefits />)
        const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
            a.getAttribute("href")
        )
        expect(hrefs).toContain("/legal/terms")
        expect(hrefs).toContain("/legal/content-policy")
    })
})

describe("OwnerBenefits — copy accuracy and accessibility guards", () => {
    afterEach(() => {
        cleanup()
    })

    const BLOCKED_CLAIMS = [
        "verified badge",
        "0% commission",
        "unlimited photos",
        "instant publish",
        "export your analytics",
        "approve community menu suggestions",
    ]

    it("renders none of the blocked claims from the spec", () => {
        const { container } = render(<OwnerBenefits />)
        const text = (container.textContent ?? "").toLowerCase()
        for (const claim of BLOCKED_CLAIMS) {
            expect(text.includes(claim)).toBe(false)
        }
    })

    it("renders no marketing statistics", () => {
        const { container } = render(<OwnerBenefits />)
        const text = container.textContent ?? ""
        expect(/\d+\s*%/.test(text)).toBe(false)
        expect(/thousands of/i.test(text)).toBe(false)
        expect(/trusted by/i.test(text)).toBe(false)
        expect(/customers served/i.test(text)).toBe(false)
    })

    it("has exactly one h1 and never skips a heading level", () => {
        const { container } = render(<OwnerBenefits />)
        const headings = Array.from(
            container.querySelectorAll("h1, h2, h3")
        )
        expect(headings.filter((h) => h.tagName === "H1").length).toBe(1)
        expect(headings[0].tagName).toBe("H1")
        for (const heading of headings) {
            expect(["H1", "H2", "H3"]).toContain(heading.tagName)
        }
    })

    it("hides every icon from assistive technology", () => {
        const { container } = render(<OwnerBenefits />)
        const icons = Array.from(container.querySelectorAll("svg"))
        expect(icons.length).toBeGreaterThan(0)
        for (const icon of icons) {
            const explicitlyHidden =
                icon.getAttribute("aria-hidden") === "true"
            const insideHiddenRegion =
                icon.closest('[aria-hidden="true"]') !== null
            expect(explicitlyHidden || insideHiddenRegion).toBe(true)
        }
    })

    it("gives both primary calls to action a visible focus ring", () => {
        const { container } = render(<OwnerBenefits />)
        const ctas = Array.from(
            container.querySelectorAll('a[href="/cafes"]')
        )
        expect(ctas.length).toBe(2)
        for (const cta of ctas) {
            expect(cta.className).toContain("focus-visible:outline")
        }
    })
})
