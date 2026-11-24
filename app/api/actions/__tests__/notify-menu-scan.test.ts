import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"

/**
 * A queued Menu scan is a contribution waiting for a reviewer, and every other
 * contribution type already announces itself. This one carries the queue link,
 * because the Menu tab is otherwise several clicks deep and a message that says
 * "something is waiting" without saying where is not much use.
 *
 * Sent once per scan: a forty-item scan is one decision, so it is one message.
 */

const originalFetch = globalThis.fetch

describe("notifyDiscordMenuScanBatch", () => {
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

    it("sends one message naming the Cafe and the item count", async () => {
        const { notifyDiscordMenuScanBatch } = await import("@/app/api/actions/notify")
        const result = await notifyDiscordMenuScanBatch(
            { name: "Kape Lolo", slug: "kape-lolo" },
            52,
            "Adrian"
        )

        expect(result.success).toBe(true)
        expect(fetchCalls).toHaveLength(1)

        const embed = JSON.parse(fetchCalls[0].body).embeds[0]
        expect(embed.title).toContain("Menu scan")
        expect(embed.description).toContain("52 items")

        const fields = Object.fromEntries(
            (embed.fields as Array<{ name: string; value: string }>).map((f) => [f.name, f.value])
        )
        expect(fields["Cafe"]).toContain("Kape Lolo")
        expect(fields["Cafe"]).toContain("/cafes/kape-lolo")
        expect(fields["Items"]).toBe("52")
        expect(fields["Submitted By"]).toBe("Adrian")
    })

    it("links straight to the Menu tab of the review queue", async () => {
        const { notifyDiscordMenuScanBatch } = await import("@/app/api/actions/notify")
        await notifyDiscordMenuScanBatch({ name: "Kape Lolo", slug: "kape-lolo" }, 3)

        const embed = JSON.parse(fetchCalls[0].body).embeds[0]
        expect(embed.url).toBe("https://grounds.ph/manage/cafes?tab=menu-suggestions")
    })

    it("says one item for a one-item scan", async () => {
        const { notifyDiscordMenuScanBatch } = await import("@/app/api/actions/notify")
        await notifyDiscordMenuScanBatch({ name: "Kape Lolo", slug: "kape-lolo" }, 1)

        const embed = JSON.parse(fetchCalls[0].body).embeds[0]
        expect(embed.description).toContain("1 item ")
    })

    it("reports failure without throwing when no webhook is configured", async () => {
        delete process.env.DISCORD_WEBHOOK_URL
        const { notifyDiscordMenuScanBatch } = await import("@/app/api/actions/notify")

        const result = await notifyDiscordMenuScanBatch({ name: "Kape Lolo", slug: "kape-lolo" }, 2)

        expect(result.success).toBe(false)
        expect(fetchCalls).toHaveLength(0)
    })

    it("survives a webhook that rejects", async () => {
        globalThis.fetch = mock(() => Promise.resolve(new Response(null, { status: 500 })))
        const { notifyDiscordMenuScanBatch } = await import("@/app/api/actions/notify")

        const result = await notifyDiscordMenuScanBatch({ name: "Kape Lolo", slug: "kape-lolo" }, 2)

        expect(result.success).toBe(false)
    })
})
