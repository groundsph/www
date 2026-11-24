import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"

/**
 * A menu item suggested by hand is still a contribution waiting for a reviewer,
 * and it lands in the same queue as a scan batch. It reports itself once, with
 * the item that was suggested and a link straight to that queue.
 */

const originalFetch = globalThis.fetch

describe("notifyDiscordMenuSuggestion", () => {
    let fetchCalls: Array<{ url: string; body: string }> = []

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

    const cafe = { name: "Kape Lolo", slug: "kape-lolo" }

    async function embedFor(promise: Promise<unknown>) {
        await promise
        return JSON.parse(fetchCalls[0].body).embeds[0]
    }

    it("reports a suggested addition with its name, cafe and queue link", async () => {
        const { notifyDiscordMenuSuggestion } = await import("@/app/api/actions/notify")
        const embed = await embedFor(
            notifyDiscordMenuSuggestion(cafe, { type: "add", itemName: "Salted Caramel Latte", price: 195 }, "Adrian")
        )

        expect(embed.title).toContain("Salted Caramel Latte")
        expect(embed.url).toBe("https://grounds.ph/manage/cafes?tab=menu-suggestions")

        const fields = Object.fromEntries(
            (embed.fields as Array<{ name: string; value: string }>).map((f) => [f.name, f.value])
        )
        expect(fields["Cafe"]).toContain("Kape Lolo")
        expect(fields["Cafe"]).toContain("/cafes/kape-lolo")
        expect(fields["Suggested By"]).toBe("Adrian")
        expect(fields["Price"]).toBe("₱195.00")
    })

    it("distinguishes an edit from an addition and a removal", async () => {
        const { notifyDiscordMenuSuggestion } = await import("@/app/api/actions/notify")

        const add = await embedFor(notifyDiscordMenuSuggestion(cafe, { type: "add", itemName: "Latte", price: 150 }))
        fetchCalls = []
        const edit = await embedFor(notifyDiscordMenuSuggestion(cafe, { type: "edit", itemName: "Latte", price: 160 }))
        fetchCalls = []
        const remove = await embedFor(notifyDiscordMenuSuggestion(cafe, { type: "remove", itemName: "Latte" }))

        expect(add.title).toContain("suggested")
        expect(edit.title).toContain("edit")
        expect(remove.title).toContain("removal")
        expect(new Set([add.color, edit.color, remove.color]).size).toBe(3)
    })

    it("describes an unnamed item instead of printing 'undefined'", async () => {
        const { notifyDiscordMenuSuggestion } = await import("@/app/api/actions/notify")
        const embed = await embedFor(notifyDiscordMenuSuggestion(cafe, { type: "remove", itemName: null }))

        expect(embed.title).toContain("an item")
        expect(embed.title).not.toContain("undefined")
    })

    it("omits the price field when there is no price", async () => {
        const { notifyDiscordMenuSuggestion } = await import("@/app/api/actions/notify")
        const embed = await embedFor(notifyDiscordMenuSuggestion(cafe, { type: "remove", itemName: "Latte" }))

        const names = (embed.fields as Array<{ name: string }>).map((f) => f.name)
        expect(names).not.toContain("Price")
    })

    it("reports failure without throwing when no webhook is configured", async () => {
        delete process.env.DISCORD_WEBHOOK_URL
        const { notifyDiscordMenuSuggestion } = await import("@/app/api/actions/notify")

        const result = await notifyDiscordMenuSuggestion(cafe, { type: "add", itemName: "Latte", price: 150 })

        expect(result.success).toBe(false)
        expect(fetchCalls).toHaveLength(0)
    })

    it("survives a rejecting webhook", async () => {
        globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 500 })))
        const { notifyDiscordMenuSuggestion } = await import("@/app/api/actions/notify")

        const result = await notifyDiscordMenuSuggestion(cafe, { type: "add", itemName: "Latte", price: 150 })

        expect(result.success).toBe(false)
    })
})
