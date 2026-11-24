import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"

/**
 * Every queue-backed notification must say where to act.
 *
 * A reviewer reading "a blog post was reported" on Discord, with no link, has to
 * remember that reports live under Content → Reports. Each notifier therefore
 * links to the tab that holds the item, and each of those pages reads `?tab=` on
 * mount. This file pins the link for each notifier so the two halves cannot drift
 * apart again.
 */

const originalFetch = globalThis.fetch

interface Captured {
    url: string
    body: string
}

describe("queue links on Discord notifications", () => {
    let fetchCalls: Captured[] = []

    beforeEach(() => {
        fetchCalls = []
        globalThis.fetch = mock((url: string, init: RequestInit) => {
            fetchCalls.push({ url, body: init.body as string })
            return Promise.resolve(new Response(null, { status: 204 }))
        })
        process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test"
        process.env.NEXT_PUBLIC_SITE_URL = "https://grounds.ph"
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        delete process.env.DISCORD_WEBHOOK_URL
        delete process.env.NEXT_PUBLIC_SITE_URL
    })

    async function embedFor(send: () => Promise<unknown>) {
        await send()
        return JSON.parse(fetchCalls[0].body).embeds[0]
    }

    const notify = () => import("@/app/api/actions/notify")

    it("cafe submission links to the pending tab", async () => {
        const { notifyDiscord } = await notify()
        const embed = await embedFor(() =>
            notifyDiscord("Kape Lolo", "Cebu City", "Cebu", "Adrian")
        )
        expect(embed.url).toBe("https://grounds.ph/manage/cafes?tab=pending")
    })

    it("edit suggestion links to the suggestions tab", async () => {
        const { notifyDiscordEditSuggestion } = await notify()
        const embed = await embedFor(() =>
            notifyDiscordEditSuggestion({ name: "Kape Lolo", slug: "kape-lolo" }, ["name"])
        )
        expect(embed.url).toBe("https://grounds.ph/manage/cafes?tab=suggestions")
    })

    it("cafe claim links to the claims tab", async () => {
        const { notifyDiscordCafeClaim } = await notify()
        const embed = await embedFor(() =>
            notifyDiscordCafeClaim("Kape Lolo", "kape-lolo", "Adrian", "adrian@example.test")
        )
        expect(embed.url).toBe("https://grounds.ph/manage/cafes?tab=claims")
    })

    it("blog submission links to the blog tab", async () => {
        const { notifyDiscordBlogSubmission } = await notify()
        const embed = await embedFor(() =>
            notifyDiscordBlogSubmission({ title: "Beans", slug: "beans", category: "Coffee" })
        )
        expect(embed.url).toBe("https://grounds.ph/manage/content?tab=blog")
    })

    it("blog report links to the reports tab, not the blog tab", async () => {
        const { notifyDiscordBlogReport } = await notify()
        const embed = await embedFor(() =>
            notifyDiscordBlogReport({ title: "Beans", slug: "beans" }, "spam", "Adrian")
        )
        expect(embed.url).toBe("https://grounds.ph/manage/content?tab=reports")
    })

    it("event submission links to the events tab", async () => {
        const { notifyDiscordEventSubmission } = await notify()
        const embed = await embedFor(() =>
            notifyDiscordEventSubmission({
                title: "Cupping Night",
                location: "Cebu City",
                startDate: "2026-12-01",
            })
        )
        expect(embed.url).toBe("https://grounds.ph/manage/community?tab=events")
    })

    it("review report links to the reviews tab", async () => {
        const { notifyDiscordReviewReport } = await notify()
        const embed = await embedFor(() =>
            notifyDiscordReviewReport(
                { name: "Kape Lolo", slug: "kape-lolo" },
                2,
                "abusive",
                "Adrian"
            )
        )
        expect(embed.url).toBe("https://grounds.ph/manage/community?tab=reviews")
    })
})
