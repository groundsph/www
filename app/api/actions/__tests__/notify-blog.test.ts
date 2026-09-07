import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"

const originalFetch = globalThis.fetch

describe("blog Discord notifications", () => {
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

    describe("notifyDiscordBlogSubmission", () => {
        it("sends an embed with blog link, category, and author", async () => {
            const { notifyDiscordBlogSubmission } = await import("@/app/api/actions/notify")

            await notifyDiscordBlogSubmission(
                { title: "My Cafe Story", slug: "my-cafe-story", category: "community" },
                "Jane Doe"
            )

            expect(fetchCalls.length).toBe(1)
            expect(fetchCalls[0].url).toBe("https://discord.com/api/webhooks/test")
            const body = JSON.parse(fetchCalls[0].body)
            const embed = body.embeds[0]
            expect(embed.title).toContain("Blog")
            expect(embed.description).toContain("approval")
            expect(embed.fields).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: "Blog Post",
                        value: "[My Cafe Story](https://grounds.ph/blog/my-cafe-story)",
                    }),
                    expect.objectContaining({ name: "Category", value: "community" }),
                    expect.objectContaining({ name: "Submitted By", value: "Jane Doe" }),
                    expect.objectContaining({
                        name: "Action Required",
                        value: expect.stringContaining("/manage/content"),
                    }),
                ])
            )
        })

        it("falls back to Anonymous User when author name missing", async () => {
            const { notifyDiscordBlogSubmission } = await import("@/app/api/actions/notify")

            await notifyDiscordBlogSubmission({
                title: "T",
                slug: "t",
                category: "community",
            })

            const body = JSON.parse(fetchCalls[0].body)
            const submittedBy = body.embeds[0].fields.find(
                (f: { name: string }) => f.name === "Submitted By"
            )
            expect(submittedBy.value).toBe("Anonymous User")
        })

        it("skips if webhook URL is not configured", async () => {
            delete process.env.DISCORD_WEBHOOK_URL
            const { notifyDiscordBlogSubmission } = await import("@/app/api/actions/notify")

            const result = await notifyDiscordBlogSubmission({
                title: "T",
                slug: "t",
                category: "community",
            })

            expect(fetchCalls.length).toBe(0)
            expect(result.success).toBe(false)
        })

        it("does not throw on fetch failure", async () => {
            globalThis.fetch = mock(() => Promise.reject(new Error("Network error")))
            const { notifyDiscordBlogSubmission } = await import("@/app/api/actions/notify")

            const result = await notifyDiscordBlogSubmission({
                title: "T",
                slug: "t",
                category: "community",
            })

            expect(result.success).toBe(false)
        })
    })

    describe("notifyDiscordBlogApproved", () => {
        it("sends a green embed with published post link and approver", async () => {
            const { notifyDiscordBlogApproved } = await import("@/app/api/actions/notify")

            await notifyDiscordBlogApproved(
                { title: "My Cafe Story", slug: "my-cafe-story" },
                "Jane Doe"
            )

            expect(fetchCalls.length).toBe(1)
            const body = JSON.parse(fetchCalls[0].body)
            const embed = body.embeds[0]
            expect(embed.title).toContain("Approved")
            expect(embed.color).toBe(0x22c55e) // green
            expect(embed.fields).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: "Blog Post",
                        value: "[My Cafe Story](https://grounds.ph/blog/my-cafe-story)",
                    }),
                    expect.objectContaining({ name: "Approved By", value: "Jane Doe" }),
                ])
            )
        })

        it("skips if webhook URL is not configured", async () => {
            delete process.env.DISCORD_WEBHOOK_URL
            const { notifyDiscordBlogApproved } = await import("@/app/api/actions/notify")

            const result = await notifyDiscordBlogApproved(
                { title: "T", slug: "t" }
            )

            expect(fetchCalls.length).toBe(0)
            expect(result.success).toBe(false)
        })
    })
})
