import { describe, it, expect } from "bun:test"
import {
    HERO,
    PRIMARY_CTA,
    SECONDARY_CTA,
    CONTACT_CTA,
    FREE_PILLARS,
    FREE_PILLARS_NOTE,
    BENEFIT_GROUPS,
    CLAIM_STEPS,
    INCLUDED_FEATURES,
    FAQ_ITEMS,
    CLOSING,
} from "@/components/owner/owner-benefits-content"

describe("owner benefits content — hero and calls to action", () => {
    it("has an eyebrow, a headline and a lede", () => {
        expect(HERO.eyebrow).toBe("For Cafe Owners")
        expect(HERO.heading.length).toBeGreaterThan(10)
        expect(HERO.lede.length).toBeGreaterThan(50)
    })

    it("answers the cost question on the first screen", () => {
        expect(HERO.reassurance).toContain("Free to claim")
        expect(HERO.reassurance.toLowerCase()).toContain("no subscription")
        expect(HERO.reassurance.toLowerCase()).toContain("no commission")
    })

    it("points the primary call to action at the cafe list", () => {
        expect(PRIMARY_CTA.label).toBe("Claim your cafe")
        expect(PRIMARY_CTA.href).toBe("/cafes")
    })

    it("points the secondary call to action at the submit form", () => {
        expect(SECONDARY_CTA.href).toBe("/submit")
    })

    it("only uses internal hrefs", () => {
        for (const cta of [PRIMARY_CTA, SECONDARY_CTA, CONTACT_CTA]) {
            expect(cta.href.startsWith("/")).toBe(true)
        }
    })
})

describe("owner benefits content — free pillars", () => {
    it("states the four no-cost pillars in order", () => {
        expect(FREE_PILLARS.length).toBe(4)
        expect(FREE_PILLARS.map((p) => p.title)).toEqual([
            "No subscription",
            "No commission",
            "No tiers",
            "No card",
        ])
    })

    it("gives every pillar a description and an icon", () => {
        for (const pillar of FREE_PILLARS) {
            expect(pillar.description.length).toBeGreaterThan(20)
            expect(pillar.icon).toBeTruthy()
        }
    })

    it("explains that optional donations do not gate access", () => {
        expect(FREE_PILLARS_NOTE.toLowerCase()).toContain("optional")
        expect(FREE_PILLARS_NOTE.toLowerCase()).toContain("changes nothing")
    })
})

describe("owner benefits content — benefit groups", () => {
    it("has five groups with unique ids and titles", () => {
        expect(BENEFIT_GROUPS.length).toBe(5)
        expect(new Set(BENEFIT_GROUPS.map((g) => g.id)).size).toBe(5)
        expect(new Set(BENEFIT_GROUPS.map((g) => g.title)).size).toBe(5)
    })

    it("names the five groups in narrative order", () => {
        expect(BENEFIT_GROUPS.map((g) => g.title)).toEqual([
            "Own your listing",
            "Get found",
            "Bring customers in",
            "Hear your customers",
            "Know what is working",
        ])
    })

    it("gives every group at least four benefits with copy and an icon", () => {
        for (const group of BENEFIT_GROUPS) {
            expect(group.items.length).toBeGreaterThanOrEqual(4)
            expect(group.intro.length).toBeGreaterThan(30)
            expect(group.icon).toBeTruthy()
            expect(group.accent.startsWith("bg-")).toBe(true)
            for (const item of group.items) {
                expect(item.title.length).toBeGreaterThan(5)
                expect(item.description.length).toBeGreaterThan(40)
                expect(item.icon).toBeTruthy()
            }
        }
    })

    it("does not repeat a benefit title", () => {
        const titles = BENEFIT_GROUPS.flatMap((g) => g.items.map((i) => i.title))
        expect(new Set(titles).size).toBe(titles.length)
    })
})

describe("owner benefits content — claim steps", () => {
    it("describes the four-step claim flow in order", () => {
        expect(CLAIM_STEPS.length).toBe(4)
        expect(CLAIM_STEPS.map((s) => s.title)).toEqual([
            "Find your cafe",
            "Open its page and claim it",
            "Tell us who you are",
            "We review, then email you",
        ])
    })

    it("says a human reviews every claim", () => {
        const finalStep = CLAIM_STEPS[3]
        expect(finalStep.description.toLowerCase()).toContain(
            "a person reads every claim"
        )
    })
})

describe("owner benefits content — inclusions", () => {
    it("lists nine things included from day one", () => {
        expect(INCLUDED_FEATURES.length).toBe(9)
    })

    it("keeps the gallery photos claim at the real limit of twelve", () => {
        const photos = INCLUDED_FEATURES.find((line) =>
            line.toLowerCase().includes("gallery")
        )
        expect(photos).toBeDefined()
        expect(photos as string).toContain("12")
    })

    it("says blog posts are reviewed before publishing", () => {
        const posts = INCLUDED_FEATURES.find((line) =>
            line.toLowerCase().includes("blog post")
        )
        expect(posts).toBeDefined()
        expect((posts as string).toLowerCase()).toContain("reviewed")
    })
})

describe("owner benefits content — FAQ", () => {
    it("has at least eight unique questions, each with an answer", () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(8)
        expect(new Set(FAQ_ITEMS.map((f) => f.question)).size).toBe(
            FAQ_ITEMS.length
        )
        for (const faq of FAQ_ITEMS) {
            expect(faq.question.endsWith("?")).toBe(true)
            expect(faq.answer.length).toBeGreaterThan(40)
        }
    })

    it("answers whether claiming costs anything", () => {
        const faq = FAQ_ITEMS.find((f) => f.question === "Is it really free?")
        expect(faq).toBeDefined()
        expect((faq as { answer: string }).answer.toLowerCase()).toContain(
            "no subscription"
        )
    })
})

describe("owner benefits content — forbidden claims", () => {
    const FORBIDDEN = [
        "verified badge",
        "0% commission",
        "unlimited photos",
        "instant publish",
        "export your analytics",
        "approve community menu suggestions",
    ]

    it("never states a claim the product does not back up", () => {
        const text = [
            HERO.eyebrow,
            HERO.heading,
            HERO.lede,
            HERO.reassurance,
            FREE_PILLARS_NOTE,
            ...FREE_PILLARS.flatMap((p) => [p.title, p.description]),
            ...BENEFIT_GROUPS.flatMap((g) => [
                g.title,
                g.intro,
                ...g.items.flatMap((i) => [i.title, i.description]),
            ]),
            ...CLAIM_STEPS.flatMap((s) => [s.title, s.description]),
            ...INCLUDED_FEATURES,
            ...FAQ_ITEMS.flatMap((f) => [f.question, f.answer]),
            CLOSING.heading,
            CLOSING.body,
            CLOSING.footnote,
        ]
            .join(" ")
            .toLowerCase()

        for (const phrase of FORBIDDEN) {
            expect(text.includes(phrase)).toBe(false)
        }
    })

    it("ships no marketing statistics", () => {
        const text = [
            HERO.lede,
            HERO.reassurance,
            ...BENEFIT_GROUPS.flatMap((g) => g.items.map((i) => i.description)),
            ...FAQ_ITEMS.map((f) => f.answer),
        ]
            .join(" ")
            .toLowerCase()

        for (const banned of [
            "% of",
            "trusted by",
            "owners joined",
            "customers served",
            "increase your",
        ]) {
            expect(text.includes(banned)).toBe(false)
        }
    })
})
