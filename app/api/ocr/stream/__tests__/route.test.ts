import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"
import type { NextRequest } from "next/server"

mock.module("@/lib/auth", () => ({
    getCurrentUser: async () => ({ id: "user-1" }),
}))

const dbQueries = { cafeLookups: 0, menuItemQueries: 0 }

mock.module("@/db", () => ({
    db: {
        query: {
            cafes: {
                findFirst: async () => {
                    dbQueries.cafeLookups += 1
                    return { id: "cafe-1" }
                },
            },
        },
        select: () => ({
            from: () => ({
                where: async () => {
                    dbQueries.menuItemQueries += 1
                    return []
                },
            }),
        }),
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

const MB = 1024 * 1024

/**
 * The scan path compresses to a 1.5 MB target and posts the result as base64,
 * which is about a third larger again. Written out here rather than imported:
 * the point is the size a real scan sends, not the constant's spelling.
 */
const COMPRESSED_IMAGE_BASE64 = "A".repeat(Math.ceil((1.5 * MB * 4) / 3))

function sseResponse(deltas: string[]): Response {
    const body = deltas
        .map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
        .join("") + "data: [DONE]\n\n"
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
}

beforeEach(() => {
    dbQueries.cafeLookups = 0
    dbQueries.menuItemQueries = 0
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

    it("scans without a cafeId for a cafe that does not exist yet", async () => {
        globalThis.fetch = (async () => sseResponse([
            '[{"name":"Latte","category":"Coffee","price":120}]',
        ])) as typeof fetch

        const response = await POST(makeRequest({ imageBase64: "aGk=" }))
        const text = await response.text()

        expect(response.status).toBe(200)
        expect(text).toContain('"type":"complete"')
        expect(text).toContain('"name":"Latte"')
        // Nothing to dedupe against before the cafe exists
        expect(dbQueries.cafeLookups).toBe(0)
        expect(dbQueries.menuItemQueries).toBe(0)
    })

    it("rejects the scan when the supplied cafeId does not exist", async () => {
        globalThis.fetch = (async () => sseResponse(["[]"])) as typeof fetch
        // Simulate a lookup miss for this case only
        const { db } = await import("@/db")
        const original = db.query.cafes.findFirst
        db.query.cafes.findFirst = async () => null

        const response = await POST(makeRequest({ cafeId: "missing", imageBase64: "aGk=" }))

        db.query.cafes.findFirst = original
        expect(response.status).toBe(404)
    })

    it("accepts a photo at the scan's compressed budget and sends it whole to the model", async () => {
        let sentBody: {
            messages: Array<{ content: Array<{ image_url: { url: string; detail?: string } }> }>
        } | undefined

        globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
            sentBody = JSON.parse(String(init?.body))
            return sseResponse(['[{"name":"Latte","category":"Coffee","price":120}]'])
        }) as typeof fetch

        const response = await POST(makeRequest({
            cafeId: "cafe-1",
            imageBase64: COMPRESSED_IMAGE_BASE64,
            mimeType: "image/jpeg",
        }))
        const text = await response.text()

        expect(response.status).toBe(200)
        expect(text).toContain('"type":"complete"')

        const imageUrl = sentBody!.messages[1].content[0].image_url
        // The whole image arrives: a ceiling anywhere on the way would have
        // truncated it or refused the request outright.
        expect(imageUrl.url).toBe(`data:image/jpeg;base64,${COMPRESSED_IMAGE_BASE64}`)
        // A 1600 px menu is only legible to the model if it is not downsized to
        // a single low-detail tile on the way out.
        expect(imageUrl.detail).toBe("high")
    })

    it("still refuses a format outside the wider accepted set", async () => {
        let reachedModel = false
        globalThis.fetch = (async () => {
            reachedModel = true
            return sseResponse(["[]"])
        }) as typeof fetch

        const response = await POST(makeRequest({
            cafeId: "cafe-1",
            imageBase64: "aGk=",
            mimeType: "image/bmp",
        }))

        expect(response.status).toBe(400)
        expect((await response.json() as { error: string }).error).toBe("Invalid request")
        expect(reachedModel).toBe(false)
    })

    it("keeps the wider accepted MIME set working", async () => {
        for (const mimeType of ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]) {
            globalThis.fetch = (async () => sseResponse(["[]"])) as typeof fetch

            const response = await POST(makeRequest({
                cafeId: "cafe-1",
                imageBase64: "aGk=",
                mimeType,
            }))
            await response.text()

            expect(response.status).toBe(200)
        }
    })
})
