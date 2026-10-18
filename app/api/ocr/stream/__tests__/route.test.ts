import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"
import type { NextRequest } from "next/server"

mock.module("@/lib/auth", () => ({
    getCurrentUser: async () => ({ id: "user-1" }),
}))

mock.module("@/db", () => ({
    db: {
        query: { cafes: { findFirst: async () => ({ id: "cafe-1" }) } },
        select: () => ({ from: () => ({ where: async () => [] }) }),
    },
}))

mock.module("@/app/api/actions/menu-ocr", () => ({
    deduplicateMenuItems: async (items: unknown[]) => items,
}))

import { POST } from "../route"

const originalFetch = globalThis.fetch

const originalEnv = {
    base: process.env.OPENAI_COMPATIBLE_BASE_URL,
    key: process.env.OPENAI_COMPATIBLE_API_KEY,
    model: process.env.OPENAI_COMPATIBLE_OCR_MODEL,
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[name]
    } else {
        process.env[name] = value
    }
}

function makeRequest(body: Record<string, unknown>): NextRequest {
    return new Request("http://localhost/api/ocr/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }) as unknown as NextRequest
}

function sseResponse(deltas: string[]): Response {
    const body = deltas
        .map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
        .join("") + "data: [DONE]\n\n"
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
}

beforeEach(() => {
    process.env.OPENAI_COMPATIBLE_BASE_URL = "https://openrouter.ai/api/v1"
    process.env.OPENAI_COMPATIBLE_API_KEY = "test-key"
    process.env.OPENAI_COMPATIBLE_OCR_MODEL = "test-model"
})

afterEach(() => {
    globalThis.fetch = originalFetch
    restoreEnv("OPENAI_COMPATIBLE_BASE_URL", originalEnv.base)
    restoreEnv("OPENAI_COMPATIBLE_API_KEY", originalEnv.key)
    restoreEnv("OPENAI_COMPATIBLE_OCR_MODEL", originalEnv.model)
})

describe("POST /api/ocr/stream", () => {
    it("requests exactly one /v1 segment when the base URL already ends in /v1", async () => {
        let requestedUrl = ""
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            requestedUrl = typeof input === "string" ? input : input.toString()
            return sseResponse(['[{"name":"Latte","category":"Coffee","price":120}]'])
        }) as typeof fetch

        const response = await POST(makeRequest({ cafeId: "cafe-1", imageBase64: "aGk=" }))
        await response.text()

        expect(requestedUrl).toBe("https://openrouter.ai/api/v1/chat/completions")
    })

    it("returns 502 carrying the upstream status when the provider rejects the request", async () => {
        globalThis.fetch = (async () => new Response(
            '{"error":{"message":"Not Found","code":404}}',
            { status: 404, statusText: "Not Found" },
        )) as typeof fetch

        const response = await POST(makeRequest({ cafeId: "cafe-1", imageBase64: "aGk=" }))

        expect(response.status).toBe(502)
        const body = await response.json() as { error: string }
        expect(body.error).toContain("404")
        expect(body.error).toContain("Not Found")
    })

    it("streams parsed items to the client on success", async () => {
        globalThis.fetch = (async () => sseResponse([
            '[{"name":"Latte","category":"Coffee","price":120}',
            ']',
        ])) as typeof fetch

        const response = await POST(makeRequest({ cafeId: "cafe-1", imageBase64: "aGk=" }))
        const text = await response.text()

        expect(text).toContain('"type":"complete"')
        expect(text).toContain('"name":"Latte"')
    })
})
