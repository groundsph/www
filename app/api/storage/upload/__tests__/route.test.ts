import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { NextRequest } from "next/server"

const uploads: { bucket: string; path: string }[] = []

mock.module("@/lib/auth", () => ({
    getCurrentUser: async () => ({ id: "user-1" }),
}))

mock.module("@/utils/storage/factory", () => ({
    getStorageProvider: async () => ({
        upload: async (bucket: string, path: string) => {
            uploads.push({ bucket, path })
            return { success: true, url: `https://cdn.test/${bucket}/${path}`, path }
        },
    }),
    getStorageProviderName: () => "r2",
    isUsingR2: () => true,
}))

import { POST } from "../route"

// Minimal PNG header so validateFile's magic-byte sniff passes.
const PNG_BYTES = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
])

function makeRequest(fields: { bucket: string; cafeId?: string }): NextRequest {
    const form = new FormData()
    form.append("file", new File([PNG_BYTES], "cover.png", { type: "image/png" }))
    form.append("bucket", fields.bucket)
    if (fields.cafeId) form.append("cafeId", fields.cafeId)

    return new Request("http://localhost/api/storage/upload", {
        method: "POST",
        body: form,
    }) as unknown as NextRequest
}

beforeEach(() => {
    uploads.length = 0
})

describe("POST /api/storage/upload", () => {
    it("accepts cafe images without a cafeId (pre-submission uploads)", async () => {
        const response = await POST(makeRequest({ bucket: "cafes" }))
        const body = (await response.json()) as { success: boolean; url?: string }

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(uploads).toHaveLength(1)
        expect(uploads[0].bucket).toBe("cafes")
        expect(uploads[0].path.startsWith("user-1/")).toBe(true)
    })

    it("namespaces cafe images under the cafe when a cafeId is supplied", async () => {
        const response = await POST(makeRequest({ bucket: "cafes", cafeId: "cafe-1" }))
        const body = (await response.json()) as { success: boolean }

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(uploads[0].path.startsWith("cafe-1/")).toBe(true)
    })

    it("still requires a cafeId for menu photos", async () => {
        const response = await POST(makeRequest({ bucket: "menu-photos" }))
        const body = (await response.json()) as { success: boolean; error?: string }

        expect(response.status).toBe(400)
        expect(body.success).toBe(false)
        expect(body.error).toBe("cafeId required for menu photos")
        expect(uploads).toHaveLength(0)
    })
})
