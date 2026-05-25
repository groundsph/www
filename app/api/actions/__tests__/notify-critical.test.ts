import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"

const originalFetch = globalThis.fetch

describe("notifyDiscordCritical", () => {
  let fetchCalls: Array<{ url: string; body: string }> = []

  beforeEach(() => {
    fetchCalls = []
    globalThis.fetch = mock((url: string, init: RequestInit) => {
      fetchCalls.push({ url, body: init.body as string })
      return Promise.resolve(new Response(null, { status: 204 }))
    })
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test"
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.DISCORD_WEBHOOK_URL
  })

  it("sends a red embed with critical prefix", async () => {
    const { notifyDiscordCritical } = await import("@/app/api/actions/notify")
    await notifyDiscordCritical(
      "Submission DB Insert Failed",
      "The database insert failed for an unknown reason.",
      {
        cafeName: "Test Cafe",
        submitterId: "user-123",
        errorMessage: "Connection refused",
        failedStep: "db_insert",
      }
    )

    expect(fetchCalls.length).toBe(1)
    const body = JSON.parse(fetchCalls[0].body)
    expect(body.embeds[0].title).toContain("⚠️")
    expect(body.embeds[0].color).toBe(0xef4444)
  })

  it("is fire-and-forget — does not throw on fetch failure", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("Network error")))

    const { notifyDiscordCritical } = await import("@/app/api/actions/notify")
    await notifyDiscordCritical("Test", "Test", {
      errorMessage: "test",
      failedStep: "test",
    })
    expect(true).toBe(true)
  })

  it("skips if webhook URL is not configured", async () => {
    delete process.env.DISCORD_WEBHOOK_URL

    const { notifyDiscordCritical } = await import("@/app/api/actions/notify")
    await notifyDiscordCritical("Test", "Test", {
      errorMessage: "test",
      failedStep: "test",
    })

    expect(fetchCalls.length).toBe(0)
  })
})