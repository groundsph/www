# Cafe Image Pipeline + OCR Fix Implementation Plan (Plan A of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken Scan Menu upload, make every cafe image upload optimized and validated, and make cafe image add/remove/reorder persist automatically with visible per-file progress — without touching the editor layout.

**Architecture:** One shared, injectable upload queue hook (`useImageUploadQueue`) and one shared image-state hook (`useCafeImages`) that owns debounced single-flight persistence and the "persist before deleting storage" ordering rule. New field-level server actions (`updateCafeImages`, `updateCafeImagesAsOwner`) persist only `{thumbnail, gallery}`. The storage layer gains per-bucket MIME limits plus magic-byte sniffing, and a single compression entry point (`compressImageFor`) that every cafe image path uses. The OCR streaming route stops maintaining its own base-URL/URL-building copy and surfaces upstream failures.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Drizzle ORM (PostgreSQL), Cloudflare R2 via the S3 SDK, `browser-image-compression`, Zod v4, `bun test` + `@testing-library/react` (v16, JSDOM preloaded by `bunfig.toml` → `test-setup.ts`).

**Spec:** `docs/superpowers/specs/2026-10-17-cafe-manage-ui-images-design.md`
**Branch:** `feat/cafe-manage-ui-images` (already created from `prod`, spec committed as `e9587b5`)
**Plan B (not this document):** `SegmentedTabs`/`EditorShell`/`ConfirmDialog`, editor shell adoption, toasts, unsaved-changes guard, listing/hub tab strip, skeletons. Plan B starts only after Plan A lands, because it consumes `useCafeImages` and `useImageUploadQueue`.

**Scope guard:** every task below is behaviour-preserving except where it explicitly fixes a bug. Do not restructure `CafesManagement.tsx`, `CafeManagement.tsx`, `CafeEditor.tsx`, or `CafeEdit.tsx` beyond the exact edits listed.

---

## File map (Plan A)

| File | Responsibility | Action |
|---|---|---|
| `utils/ai/openai-compatible.ts` | Add `buildChatCompletionsUrl`, `sanitizeUpstreamError` | modify |
| `utils/ai/menu-ocr.ts` | Export the shared menu prompt; add `resolveImageMime` | modify |
| `app/api/ocr/stream/route.ts` | Use shared URL/prompt helpers; report the upstream cause | modify |
| `utils/ocr-stream-client.ts` | Send the real image MIME; empty-result copy helper | modify |
| `components/suggestions/MenuOcrScanModal.tsx` | Pass `compressed.type`; show the "no items" copy | modify |
| `utils/storage/types.ts` | `allowedMimeTypes` + `maxFiles` per bucket | modify |
| `utils/storage/helpers.ts` | `async validateFile` + `sniffImageMime` | modify |
| `utils/storage/actions.ts` | `await validateFile` (9 call sites) | modify |
| `app/api/storage/upload/route.ts` | `await validateFile`; cafe-scoped path for the `cafes` bucket | modify |
| `utils/image-processing.ts` | `compressImageFor`, `compressBadgeStamp` | modify |
| `utils/hooks/useCoverImageUpload.ts` | Compress the already-16:9 fast path | modify |
| `db/schema/tables.ts` | `cafes.thumbnail` nullable | modify |
| `drizzle/migrations/*` | Generated `DROP NOT NULL` migration | create |
| `app/api/actions/admin.ts` | `updateCafeImages`; `thumbnail: string \| null` | modify |
| `app/api/actions/owner.ts` | `updateCafeImagesAsOwner`; add `thumbnail`/`gallery` to the update type | modify |
| `utils/validation/cafe-images.ts` | `cafeImagesPatchSchema`, `parseCafeImagesPatch`, `MAX_CAFE_GALLERY` | create |
| `utils/hooks/useImageUploadQueue.ts` | Per-file compress → upload → progress → retry/dismiss | create |
| `utils/hooks/useCafeImages.ts` | Image state + debounced single-flight persistence | create |
| `components/cafe-editor/ImageSection.tsx` | Upload tiles, delegate removal to the hooks | modify |
| `components/manage/CafeEditor.tsx` | Wire `useCafeImages`; drop images from the main save | modify |
| `components/owner/CafeEdit.tsx` | Same for the owner side | modify |
| `utils/storage/cafe-image-audit.ts` | Pure URL collection for the audit | create |
| `scripts/report-broken-cafe-images.ts` | Read-only broken-image report | create |

---

## Task 1: Commit the pending `adminDeleteCafeImage` fix (B3)

This fix already exists uncommitted in the working tree and was verified earlier (`bunx tsc --noEmit` clean, `bun lint` clean, `bun test` unchanged at 919 pass / 17 pre-existing failures).

**Files:**
- Modify (already staged in the working tree): `app/api/actions/admin.ts`, `app/api/actions/system-logs.ts`, `components/manage/CafeEditor.tsx`

- [ ] **Step 1: Confirm the working tree contains only the expected three files**

Run: `git status --porcelain`
Expected: exactly these three lines (order may differ):
```
 M app/api/actions/admin.ts
 M app/api/actions/system-logs.ts
 M components/manage/CafeEditor.tsx
```
If anything else appears, stop and report instead of committing.

- [ ] **Step 2: Confirm the diff is the reviewed fix**

Run: `git diff --stat`
Expected: `3 files changed`, roughly `54 insertions(+), 13 deletions(-)`. If the file list differs, stop.

- [ ] **Step 3: Re-verify before committing**

Run: `bunx tsc --noEmit && bun lint`
Expected: no output from either command.

- [ ] **Step 4: Commit**

```bash
git add app/api/actions/admin.ts app/api/actions/system-logs.ts components/manage/CafeEditor.tsx
git commit -m "fix(cafe): log admin image deletion against the cafe id

adminDeleteCafeImage passed the image URL as system_logs.entity_id, which
is a uuid column, so every admin image deletion 500'd after the storage
object had already been removed. Log the cafe id instead, keep the URL in
metadata, and make logSystemAction non-throwing so an audit write can
never fail an action that already succeeded."
```

---

## Task 2: Shared URL builder and upstream-error sanitizer

**Files:**
- Modify: `utils/ai/openai-compatible.ts` (append after `normalizeBaseUrl`, which ends at :32)
- Test: `utils/ai/__tests__/openai-compatible.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `utils/ai/__tests__/openai-compatible.test.ts` (it already imports `normalizeBaseUrl` from `@/utils/ai/openai-compatible`, so add the two new names to that import list):

```ts
import { buildChatCompletionsUrl, sanitizeUpstreamError } from "@/utils/ai/openai-compatible"

describe("buildChatCompletionsUrl", () => {
    it("does not double the /v1 segment when the base already ends in /v1", () => {
        expect(buildChatCompletionsUrl("https://openrouter.ai/api/v1"))
            .toBe("https://openrouter.ai/api/v1/chat/completions")
    })

    it("appends /v1 when the base is a bare host", () => {
        expect(buildChatCompletionsUrl("https://api.example.com"))
            .toBe("https://api.example.com/v1/chat/completions")
    })

    it("tolerates a trailing slash after /v1", () => {
        expect(buildChatCompletionsUrl("https://openrouter.ai/api/v1/"))
            .toBe("https://openrouter.ai/api/v1/chat/completions")
    })
})

describe("sanitizeUpstreamError", () => {
    it("keeps the status and the upstream message", () => {
        expect(sanitizeUpstreamError(404, "Not Found", '{"error":{"message":"Not Found","code":404}}'))
            .toBe('404 Not Found: {"error":{"message":"Not Found","code":404}}')
    })

    it("redacts bearer tokens and api keys", () => {
        const output = sanitizeUpstreamError(401, "Unauthorized", "Bearer sk-abc123 was rejected")
        expect(output).not.toContain("sk-abc123")
        expect(output).toContain("401 Unauthorized")
    })

    it("truncates a long body", () => {
        expect(sanitizeUpstreamError(500, "Server Error", "x".repeat(500)).length).toBeLessThanOrEqual(220)
    })

    it("handles an empty body", () => {
        expect(sanitizeUpstreamError(502, "Bad Gateway", "   ")).toBe("502 Bad Gateway")
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test utils/ai/__tests__/openai-compatible.test.ts`
Expected: FAIL — `buildChatCompletionsUrl` / `sanitizeUpstreamError` are not exported.

- [ ] **Step 3: Implement**

In `utils/ai/openai-compatible.ts`, immediately after the `normalizeBaseUrl` function body (`:32`), add:

```ts
/**
 * Build the OpenAI-compatible chat completions URL for a configured base URL.
 * Callers must not concatenate "/v1/..." themselves — that is how the OCR
 * streaming route ended up requesting ".../api/v1/v1/chat/completions" (404).
 */
export function buildChatCompletionsUrl(baseUrl: string): string {
    return `${normalizeBaseUrl(baseUrl)}/v1/chat/completions`
}

const MAX_UPSTREAM_ERROR_LENGTH = 200

/**
 * Turn a failed upstream HTTP response into a single diagnosable line.
 * Never leaks credentials: bearer tokens and sk-* keys are redacted.
 */
export function sanitizeUpstreamError(status: number, statusText: string, body: string): string {
    const cleaned = (body ?? "")
        .replace(/sk-[A-Za-z0-9_\-]+/g, "[REDACTED]")
        .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
        .replace(/\s+/g, " ")
        .trim()

    const head = `${status} ${statusText}`.trim()
    if (!cleaned) return head

    const truncated = cleaned.length > MAX_UPSTREAM_ERROR_LENGTH
        ? `${cleaned.slice(0, MAX_UPSTREAM_ERROR_LENGTH)}…`
        : cleaned

    return `${head}: ${truncated}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test utils/ai/__tests__/openai-compatible.test.ts`
Expected: PASS (all pre-existing tests in the file still pass).

- [ ] **Step 5: Commit**

```bash
git add utils/ai/openai-compatible.ts utils/ai/__tests__/openai-compatible.test.ts
git commit -m "feat(ai): add shared chat-completions URL builder and upstream error sanitizer"
```

---

## Task 3: Fix the OCR streaming route (B4) and make its failures diagnosable

**Files:**
- Modify: `app/api/ocr/stream/route.ts:21-24` (delete the local `normalizeBaseUrl`), `:83-103` (URL + error handling)
- Test: `app/api/ocr/stream/__tests__/route.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `app/api/ocr/stream/__tests__/route.test.ts`:

```ts
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
const originalEnv = { ...process.env }

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
    process.env = { ...originalEnv }
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test app/api/ocr/stream/__tests__/route.test.ts`
Expected: the first test FAILS with `Received: "https://openrouter.ai/api/v1/v1/chat/completions"`.

- [ ] **Step 3: Implement the fix**

In `app/api/ocr/stream/route.ts`:

Delete the local helper (`:21-24`):

```ts
function normalizeBaseUrl(url: string): string {
    return url.replace(/\/$/, "")
}
```

Extend the imports at the top of the file:

```ts
import { buildChatCompletionsUrl, sanitizeUpstreamError } from "@/utils/ai/openai-compatible"
```

Replace the URL construction and the non-OK branch (`:83-103`):

```ts
        const model = process.env.OPENAI_COMPATIBLE_OCR_MODEL ?? "gpt-4o"

        const ocrResponse = await fetch(buildChatCompletionsUrl(baseUrl), {
```

and, below the `fetch` call, replace:

```ts
        if (!ocrResponse.ok) {
            return new Response(
                JSON.stringify({ type: "error", error: `AI service error: ${ocrResponse.status}` }),
                { status: 502, headers: { "Content-Type": "application/json" } }
            )
        }
```

with:

```ts
        if (!ocrResponse.ok) {
            const upstreamBody = await ocrResponse.text().catch(() => "")
            const detail = sanitizeUpstreamError(ocrResponse.status, ocrResponse.statusText, upstreamBody)
            console.error(`OCR upstream error: ${detail} (url: ${buildChatCompletionsUrl(baseUrl)})`)
            return new Response(
                JSON.stringify({ type: "error", error: `AI service error: ${detail}` }),
                { status: 502, headers: { "Content-Type": "application/json" } }
            )
        }
```

The `getConfig()` check that returns `"AI service not configured"` stays exactly as it is.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test app/api/ocr/stream/__tests__/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/ocr/stream/route.ts app/api/ocr/stream/__tests__/route.test.ts
git commit -m "fix(ai): stop double-suffixing /v1 in the OCR streaming route

The route kept its own normalizeBaseUrl that only stripped a trailing
slash, so with an OpenRouter base URL (.../api/v1) it requested
.../api/v1/v1/chat/completions and every Scan Menu upload returned 502.
Use the shared helper and surface the upstream status and message."
```

---

## Task 4: One source for the menu prompt, real image MIME, empty-result copy

**Files:**
- Modify: `utils/ai/menu-ocr.ts` (export the prompt; add `resolveImageMime`)
- Modify: `app/api/ocr/stream/route.ts` (import the prompt; accept a validated `mimeType`)
- Modify: `utils/ocr-stream-client.ts` (send the MIME; add `describeEmptyOcrResult`)
- Modify: `components/suggestions/MenuOcrScanModal.tsx:201-240` (pass `compressed.type`, show the copy)
- Tests: `utils/ai/__tests__/menu-ocr.test.ts`, `utils/__tests__/ocr-stream-client.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `utils/ai/__tests__/menu-ocr.test.ts`:

```ts
import { MENU_EXTRACTION_SYSTEM_PROMPT, resolveImageMime } from "@/utils/ai/menu-ocr"

describe("MENU_EXTRACTION_SYSTEM_PROMPT", () => {
    it("is exported for the streaming route to share", () => {
        expect(MENU_EXTRACTION_SYSTEM_PROMPT).toContain("menu item extractor")
    })
})

describe("resolveImageMime", () => {
    it("keeps an allowed image MIME", () => {
        expect(resolveImageMime("image/png")).toBe("image/png")
        expect(resolveImageMime("image/webp")).toBe("image/webp")
    })

    it("falls back to image/jpeg when absent or unrecognised", () => {
        expect(resolveImageMime(undefined)).toBe("image/jpeg")
        expect(resolveImageMime("text/html")).toBe("image/jpeg")
    })
})
```

Append to `utils/__tests__/ocr-stream-client.test.ts`:

```ts
import { describeEmptyOcrResult } from "@/utils/ocr-stream-client"

describe("describeEmptyOcrResult", () => {
    it("explains an empty result instead of reporting an error", () => {
        expect(describeEmptyOcrResult(0)).toContain("No menu items")
    })

    it("returns null when items were found", () => {
        expect(describeEmptyOcrResult(3)).toBeNull()
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test utils/ai/__tests__/menu-ocr.test.ts utils/__tests__/ocr-stream-client.test.ts`
Expected: FAIL — `MENU_EXTRACTION_SYSTEM_PROMPT` is not exported; `resolveImageMime` / `describeEmptyOcrResult` are missing.

- [ ] **Step 3: Implement**

In `utils/ai/menu-ocr.ts`, change the prompt declaration to an exported const (keep it byte-identical):

```ts
export const MENU_EXTRACTION_SYSTEM_PROMPT =
```

Add below it:

```ts
const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"] as const

/**
 * The data URL handed to the model must describe the actual bytes. The client
 * compresses every image first, so its blob type is authoritative; anything
 * unrecognised falls back to jpeg for compatibility.
 */
export function resolveImageMime(mimeType?: string): string {
    if (mimeType && (ALLOWED_IMAGE_MIMES as readonly string[]).includes(mimeType)) {
        return mimeType
    }
    return "image/jpeg"
}
```

In `utils/ocr-stream-client.ts`, add near the other helpers:

```ts
/**
 * A successful scan that found nothing is not an error — it needs its own copy.
 */
export function describeEmptyOcrResult(itemCount: number): string | null {
    if (itemCount > 0) return null
    return "No menu items detected — try a clearer, straight-on photo of the menu."
}
```

and change the stream call to carry the MIME:

```ts
export async function streamOcrScan(
    cafeId: string,
    imageBase64: string,
    mimeType: string | undefined,
    callbacks: OcrStreamCallbacks,
    signal?: AbortSignal
): Promise<void> {
```

with the request body becoming:

```ts
        body: JSON.stringify({ cafeId, imageBase64, mimeType }),
```

In `app/api/ocr/stream/route.ts`:

```ts
const requestSchema = z.object({
    cafeId: z.string().min(1),
    imageBase64: z.string().min(1),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]).optional(),
})
```

delete the route's own `MENU_EXTRACTION_SYSTEM_PROMPT` constant (`:28-50`) and import the shared one:

```ts
import { parseOcrMenuItems, MENU_EXTRACTION_SYSTEM_PROMPT, resolveImageMime } from "@/utils/ai/menu-ocr"
```

and build the data URL from the resolved MIME:

```ts
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${resolveImageMime(validated.data.mimeType)};base64,${validated.data.imageBase64}`,
                                    detail: "low",
                                },
                            },
```

In `components/suggestions/MenuOcrScanModal.tsx`, pass the compressed blob's type and use the new copy:

```ts
            await streamOcrScan(cafeId, base64, compressed.type, {
```

and inside `onComplete` (where the existing handler sets the item list), add:

```ts
                    const emptyMessage = describeEmptyOcrResult(data.items.length)
                    if (emptyMessage) {
                        setError(emptyMessage)
                    }
```

adding `describeEmptyOcrResult` to the existing import from `@/utils/ocr-stream-client`.

- [ ] **Step 4: Run the tests, typecheck, and lint**

Run: `bun test utils/ai/__tests__/menu-ocr.test.ts utils/__tests__/ocr-stream-client.test.ts && bunx tsc --noEmit && bun lint`
Expected: PASS, then no output from tsc/eslint. `tsc` is the check that catches the changed `streamOcrScan` signature at its one call site.

- [ ] **Step 5: Commit**

```bash
git add utils/ai/menu-ocr.ts utils/ocr-stream-client.ts app/api/ocr/stream/route.ts components/suggestions/MenuOcrScanModal.tsx utils/ai/__tests__/menu-ocr.test.ts utils/__tests__/ocr-stream-client.test.ts
git commit -m "refactor(ai): share the menu prompt and send the real image MIME"
```

---

## Task 5: Per-bucket MIME limits and magic-byte sniffing

**Files:**
- Modify: `utils/storage/types.ts` (`BUCKET_CONFIGS`, ~:130-195)
- Modify: `utils/storage/helpers.ts:16-52` (`validateFile` becomes async; add `sniffImageMime`)
- Modify: `utils/storage/actions.ts` — add `await` at :152, :203, :241, :344, :424, :502, :542, :584, :621
- Modify: `app/api/storage/upload/route.ts:52` (`await`)
- Tests: `utils/__tests__/storage-badges.test.ts` (add `await`), `utils/__tests__/storage-validation.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `utils/__tests__/storage-validation.test.ts`:

```ts
import { describe, it, expect } from "bun:test"
import { validateFile, sniffImageMime, STORAGE_BUCKETS } from "@/utils/storage"

function pngBytes(): Uint8Array {
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
}

function jpegBytes(): Uint8Array {
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])
}

describe("sniffImageMime", () => {
    it("detects png and jpeg signatures", () => {
        expect(sniffImageMime(pngBytes())).toBe("image/png")
        expect(sniffImageMime(jpegBytes())).toBe("image/jpeg")
    })

    it("returns null for non-image bytes", () => {
        expect(sniffImageMime(new TextEncoder().encode("<?php echo 1; ?>"))).toBeNull()
    })
})

describe("validateFile content checks", () => {
    it("rejects a text file renamed to .png", async () => {
        const file = new File(["not really a png"], "menu.png", { type: "image/png" })
        const result = await validateFile(file, STORAGE_BUCKETS.CAFES)
        expect(result.valid).toBe(false)
        expect(result.error).toContain("not a recognised image")
    })

    it("accepts a real png for the cafes bucket", async () => {
        const file = new File([pngBytes()], "cafe.png", { type: "image/png" })
        expect((await validateFile(file, STORAGE_BUCKETS.CAFES)).valid).toBe(true)
    })

    it("rejects a jpeg for the png-only badges bucket", async () => {
        const file = new File([jpegBytes()], "stamp.jpg", { type: "image/jpeg" })
        const result = await validateFile(file, STORAGE_BUCKETS.BADGES)
        expect(result.valid).toBe(false)
    })

    it("still rejects an oversize file before reading bytes", async () => {
        const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" })
        const result = await validateFile(big, STORAGE_BUCKETS.CAFES)
        expect(result.valid).toBe(false)
        expect(result.error).toContain("too large")
    })

    it("does not sniff non-image buckets", async () => {
        const pdf = new File(["%PDF-1.4"], "proof.pdf", { type: "application/pdf" })
        expect((await validateFile(pdf, STORAGE_BUCKETS.OWNERSHIP_PROOFS)).valid).toBe(true)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test utils/__tests__/storage-validation.test.ts`
Expected: FAIL — `sniffImageMime` is not exported, and `validateFile` returns a plain object rather than a promise, so the text-renamed-to-png case passes validation.

- [ ] **Step 3: Implement**

In `utils/storage/types.ts`, add `allowedMimeTypes` (and `maxFiles` where a cap exists) to each image bucket. `cafes`, `reviews`, `blogs`, `events`, `menu-photos`, `collections`, `crawls`:

```ts
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
```

`avatars` keeps its 2 MB limit and gains the same `allowedMimeTypes`. `badges` gains:

```ts
        allowedMimeTypes: ['image/png'],
```

`ownership-proofs` gains:

```ts
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
```

and `cafes` additionally gains `maxFiles: 12`.

In `utils/storage/helpers.ts`, replace the `validateFile` signature line and body:

```ts
const IMAGE_BUCKETS: StorageBucket[] = [
    "cafes",
    "reviews",
    "avatars",
    "blogs",
    "events",
    "menu-photos",
    "badges",
    "collections",
    "crawls",
]

/**
 * Detect an image MIME type from its leading bytes.
 * Guards against a non-image file renamed to .png/.jpg.
 */
export function sniffImageMime(bytes: Uint8Array): string | null {
    if (bytes.length < 12) return null

    const startsWith = (signature: number[]) =>
        signature.every((byte, index) => bytes[index] === byte)

    if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg"
    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
    if (
        startsWith([0x52, 0x49, 0x46, 0x46]) &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return "image/webp"
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif"

    const brand = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
    if (brand === "ftyp") {
        const compat = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
        if (compat === "avif" || compat === "avis") return "image/avif"
    }

    return null
}

/**
 * Validate a file against bucket configuration.
 * Async because image buckets are verified by their content, not their name.
 */
export async function validateFile(
    file: File,
    bucket: StorageBucket
): Promise<{ valid: boolean; error?: string }> {
```

Keep the existing size, extension and `allowedMimeTypes` checks unchanged, and append before the final `return { valid: true }`:

```ts
    // Verify the bytes, not just the name, for image buckets
    if (IMAGE_BUCKETS.includes(bucket)) {
        const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
        const sniffed = sniffImageMime(head)
        if (!sniffed) {
            return { valid: false, error: "File content is not a recognised image" }
        }
        if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(sniffed)) {
            return { valid: false, error: `Image format not allowed: ${sniffed}` }
        }
    }
```

In `utils/storage/actions.ts`, prefix `await` to the nine `validateFile(...)` calls listed in the Files section (each sits inside an already-async function, so this is mechanical).

In `app/api/storage/upload/route.ts:52`:

```ts
        const validation = await validateFile(file, bucket)
```

Also give the `cafes` bucket a cafe-scoped path in the same switch (`route.ts:62-86`), so progress uploads land in the same shape as the rest of the cafe assets:

```ts
            case STORAGE_BUCKETS.CAFES:
                if (!cafeId) {
                    return NextResponse.json(
                        { success: false, error: "cafeId required for cafe images" },
                        { status: 400 }
                    )
                }
                path = generateCafeFilePath(cafeId, file.name)
                break
```

In `utils/__tests__/storage-badges.test.ts`, add `async`/`await`:

```ts
    it("rejects non-png", async () => {
        const file = new File(["fake"], "stamp.jpg", { type: "image/jpeg" })
        const result = await validateFile(file, STORAGE_BUCKETS.BADGES)
        expect(result.valid).toBe(false)
    })
```

- [ ] **Step 4: Run the tests, typecheck, and lint**

Run: `bun test utils/__tests__/storage-validation.test.ts utils/__tests__/storage-badges.test.ts && bunx tsc --noEmit && bun lint`
Expected: PASS, then no output. `tsc` is the check that every `validateFile` call site was awaited.

- [ ] **Step 5: Commit**

```bash
git add utils/storage/types.ts utils/storage/helpers.ts utils/storage/actions.ts app/api/storage/upload/route.ts utils/__tests__/storage-validation.test.ts utils/__tests__/storage-badges.test.ts
git commit -m "fix(storage): enforce per-bucket MIME types and verify image content"
```

---

## Task 6: One compression entry point, and fix the two raw-upload paths

**Files:**
- Modify: `utils/image-processing.ts` (append `ImagePurpose`, `compressImageFor`, `compressBadgeStamp`)
- Modify: `utils/hooks/useCoverImageUpload.ts:80-100` (compress the 16:9 fast path)
- Modify: `components/cafe-editor/ImageSection.tsx:145-175` (compress the badge stamp before upload)
- Test: `utils/__tests__/image-processing-purpose.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `utils/__tests__/image-processing-purpose.test.ts`:

```ts
import { describe, it, expect, mock, beforeEach } from "bun:test"

let capturedOptions: Record<string, unknown> | null = null

mock.module("browser-image-compression", () => ({
    default: async (file: File, options: Record<string, unknown>) => {
        capturedOptions = options
        return new Blob([file], { type: String(options.fileType) })
    },
}))

import { compressImageFor, compressBadgeStamp } from "@/utils/image-processing"

beforeEach(() => {
    capturedOptions = null
})

const sourceFile = () => new File(["x"], "photo.png", { type: "image/png" })

describe("compressImageFor", () => {
    it("produces a webp for cafe gallery images", async () => {
        const result = await compressImageFor("cafe-gallery", sourceFile())
        expect(result.type).toBe("image/webp")
        expect(result.name).toBe("photo.webp")
        expect(capturedOptions?.maxSizeMB).toBe(0.2)
    })

    it("produces a webp for cafe covers at a larger budget", async () => {
        const result = await compressImageFor("cafe-cover", sourceFile())
        expect(result.type).toBe("image/webp")
        expect(capturedOptions?.maxSizeMB).toBe(0.3)
    })

    it("keeps png for badge stamps and caps the long edge", async () => {
        const result = await compressBadgeStamp(sourceFile())
        expect(result.type).toBe("image/png")
        expect(capturedOptions?.maxWidthOrHeight).toBe(512)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test utils/__tests__/image-processing-purpose.test.ts`
Expected: FAIL — `compressImageFor` is not exported.

- [ ] **Step 3: Implement**

In `utils/image-processing.ts`, add after the avatar section:

```ts
/**
 * Every image upload purpose in the app. Adding a call site means adding a
 * purpose here, so no path can upload an unprocessed original by accident.
 */
export type ImagePurpose =
    | "cafe-cover"
    | "cafe-gallery"
    | "cafe-badge-stamp"
    | "menu-photo"
    | "review"
    | "blog-cover"
    | "event-cover"
    | "collection-cover"
    | "avatar"

/**
 * Compress a file for its purpose. This is the only entry point call sites
 * should use.
 */
export async function compressImageFor(purpose: ImagePurpose, file: File): Promise<File> {
    switch (purpose) {
        case "cafe-cover":
            return compressCoverImage(file)
        case "cafe-gallery":
        case "menu-photo":
            return compressGalleryImage(file)
        case "cafe-badge-stamp":
            return compressBadgeStamp(file)
        case "review":
            return compressReviewImage(file)
        case "blog-cover":
            return compressBlogCover(file)
        case "event-cover":
            return compressEventCover(file)
        case "collection-cover":
            return compressCollectionCover(file)
        case "avatar":
            return compressAvatar(file)
    }
}

/**
 * Compress a badge stamp. Badges are rendered as transparent overlays, so the
 * PNG format is preserved; only the long edge and the byte budget are reduced.
 */
export async function compressBadgeStamp(file: File): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        useWebWorker: true,
        fileType: "image/png",
        initialQuality: 0.9,
    })

    logCompressionResult(file.size, compressed.size, "badgeStamp")

    return new File(
        [compressed],
        file.name.replace(/\.[^/.]+$/, "") + ".png",
        { type: "image/png", lastModified: Date.now() }
    )
}
```

In `utils/hooks/useCoverImageUpload.ts`, replace the raw 16:9 fast path:

```ts
            if (is16by9) {
                // Already 16:9 — skip the cropper, but still compress (B5)
                setUploading(true)
                const processed = await compressCoverImage(file)
                const result = await uploadCafeImage(processed)
                setUploading(false)
```

In `components/cafe-editor/ImageSection.tsx`, in `handleBadgeStampUpload`, compress before uploading and use the shared validator:

```ts
        setUploadingBadgeStamp(true)
        const processed = await compressBadgeStamp(file)
        const result = await uploadCafeBadgeStamp(processed, cafeId)
```

adding `compressBadgeStamp` to the existing `@/utils/image-processing` import. Keep the existing PNG type check and the 500 KB size check as the pre-upload guard (they now run against the original file, which is the user's intent).

- [ ] **Step 4: Run the tests, typecheck, and lint**

Run: `bun test utils/__tests__/image-processing-purpose.test.ts && bunx tsc --noEmit && bun lint`
Expected: PASS, then no output.

- [ ] **Step 5: Commit**

```bash
git add utils/image-processing.ts utils/hooks/useCoverImageUpload.ts components/cafe-editor/ImageSection.tsx utils/__tests__/image-processing-purpose.test.ts
git commit -m "feat(storage): add a single image compression entry point

The already-16:9 cover path and badge stamps uploaded raw originals.
Both now go through compressImageFor/compressBadgeStamp."
```

---

## Task 7: Migration — make the cafe cover nullable

**Files:**
- Modify: `db/schema/tables.ts:103`
- Create: `drizzle/migrations/<generated>_*.sql` (via `bun db:generate`)
- Test: `utils/__tests__/schema-cafe-thumbnail.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `utils/__tests__/schema-cafe-thumbnail.test.ts`:

```ts
import { describe, it, expect } from "bun:test"
import { getTableColumns } from "drizzle-orm"
import { cafes } from "@/db/schema/tables"

describe("cafes table", () => {
    it("allows a cafe to have no cover image", () => {
        const columns = getTableColumns(cafes)
        expect(columns.thumbnail.notNull).toBe(false)
    })

    it("still stores the gallery as a nullable array", () => {
        const columns = getTableColumns(cafes)
        expect(columns.gallery.notNull).toBe(false)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test utils/__tests__/schema-cafe-thumbnail.test.ts`
Expected: FAIL — `expected true to be false` for `thumbnail.notNull`.

- [ ] **Step 3: Change the schema**

In `db/schema/tables.ts:103`:

```ts
        thumbnail: text("thumbnail"),
```

- [ ] **Step 4: Generate the migration and inspect it (do not apply it)**

Run: `bun db:generate`
Expected: a new file under `drizzle/migrations/` plus an updated journal. Open the new SQL file and confirm it contains **only**:

```sql
ALTER TABLE "cafes" ALTER COLUMN "thumbnail" DROP NOT NULL;
```

If it contains any `DROP TABLE`, `DROP COLUMN`, data rewrite, or anything other than the single `DROP NOT NULL` statement, stop and report — do not commit and do not run `bun db:migrate`. Applying migrations to production is a human step; the agent must never run `bun db:migrate`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test utils/__tests__/schema-cafe-thumbnail.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/schema/tables.ts drizzle/migrations utils/__tests__/schema-cafe-thumbnail.test.ts
git commit -m "feat(cafe): allow a null cover image

cafes.thumbnail was NOT NULL while both editors coerced null back to the
previous value, so 'remove cover' deleted the R2 object and persisted
nothing. Relax the constraint so a coverless cafe is representable."
```

---

## Task 8: Validate image patches

**Files:**
- Create: `utils/validation/cafe-images.ts`
- Test: `utils/validation/__tests__/cafe-images.test.ts`

- [ ] **Step 1: Write the failing test**

Create `utils/validation/__tests__/cafe-images.test.ts`:

```ts
import { describe, it, expect } from "bun:test"
import { parseCafeImagesPatch, MAX_CAFE_GALLERY } from "@/utils/validation/cafe-images"

const cafeUrl = (name: string) =>
    `https://cdn.grounds.ph/cafes/b6e75615-7db4-4ad0-b949-37b09502d846/${name}`

describe("parseCafeImagesPatch", () => {
    it("accepts a gallery of cafe image URLs", () => {
        const result = parseCafeImagesPatch({ gallery: [cafeUrl("a.webp"), cafeUrl("b.jpg")] })
        expect(result.ok).toBe(true)
    })

    it("accepts an explicitly cleared cover", () => {
        const result = parseCafeImagesPatch({ thumbnail: null })
        expect(result.ok).toBe(true)
    })

    it("accepts a legacy uploader-scoped path", () => {
        // Uploads used <userId>/<file> inside the cafes bucket before cafe-scoping
        const result = parseCafeImagesPatch({
            thumbnail: "https://cdn.grounds.ph/cafes/2b919190-537d-4576-8b6f-3464d54bde33/1700000000000-abc123.webp",
        })
        expect(result.ok).toBe(true)
    })

    it("rejects a URL outside the cafes bucket", () => {
        const result = parseCafeImagesPatch({ thumbnail: "https://cdn.grounds.ph/avatars/user.png" })
        expect(result.ok).toBe(false)
    })

    it("rejects a non-image extension", () => {
        const result = parseCafeImagesPatch({ gallery: [cafeUrl("payload.svg")] })
        expect(result.ok).toBe(false)
    })

    it("rejects more than the gallery cap", () => {
        const gallery = Array.from({ length: MAX_CAFE_GALLERY + 1 }, (_, i) => cafeUrl(`${i}.webp`))
        const result = parseCafeImagesPatch({ gallery })
        expect(result.ok).toBe(false)
    })

    it("rejects an empty patch", () => {
        expect(parseCafeImagesPatch({}).ok).toBe(false)
    })

    it("rejects unknown keys", () => {
        expect(parseCafeImagesPatch({ is_verified: true }).ok).toBe(false)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test utils/validation/__tests__/cafe-images.test.ts`
Expected: FAIL — cannot resolve `@/utils/validation/cafe-images`.

- [ ] **Step 3: Implement**

Create `utils/validation/cafe-images.ts`:

```ts
import { z } from "zod"

/**
 * Maximum number of gallery images a cafe may have. Enforced on the client
 * (upload queue) and here, so a crafted request cannot exceed it.
 */
export const MAX_CAFE_GALLERY = 12

/**
 * A public cafe asset URL. The folder segment is the uploader's user id for
 * legacy uploads and the cafe id for newer ones, so only the bucket folder,
 * the uuid segment and the image extension are required.
 */
const CAFE_ASSET_PATTERN = /^https?:\/\/[^/\s]+\/cafes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/?#\s]+\.(?:jpe?g|png|webp|avif|gif)$/i

export const cafeImageUrlSchema = z
    .string()
    .max(500)
    .refine((value) => CAFE_ASSET_PATTERN.test(value), {
        message: "Not a cafe image URL",
    })

export const cafeImagesPatchSchema = z
    .object({
        thumbnail: z.union([cafeImageUrlSchema, z.null()]).optional(),
        gallery: z.array(cafeImageUrlSchema).max(MAX_CAFE_GALLERY).optional(),
    })
    .strict()
    .refine(
        (patch) => patch.thumbnail !== undefined || patch.gallery !== undefined,
        { message: "Nothing to update" }
    )

export interface CafeImagesPatch {
    thumbnail?: string | null
    gallery?: string[]
}

export function parseCafeImagesPatch(
    input: unknown
): { ok: true; value: CafeImagesPatch } | { ok: false; error: string } {
    const parsed = cafeImagesPatchSchema.safeParse(input)
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid image update" }
    }
    return { ok: true, value: parsed.data }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test utils/validation/__tests__/cafe-images.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add utils/validation/cafe-images.ts utils/validation/__tests__/cafe-images.test.ts
git commit -m "feat(validation): add the cafe image patch schema"
```

---

## Task 9: `updateCafeImages` and `updateCafeImagesAsOwner`

**Files:**
- Modify: `app/api/actions/admin.ts` (add after `adminDeleteCafeImage`, ~:1092); `:874` type change
- Modify: `app/api/actions/owner.ts` (add after `deleteCafeImageAsOwner`, ~:418); `:263` type change
- Test: `app/api/actions/__tests__/cafe-images.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `app/api/actions/__tests__/cafe-images.test.ts`. This is a **source contract test**, deliberately following the existing pattern in `app/api/actions/__tests__/owner.test.ts` (which reads the action source to assert wiring): the full import graph of `admin.ts`/`owner.ts` (email, badges, storage, moderation) cannot be imported cheaply in a unit test, so the pure validation is covered in Task 8 and the wiring contract is asserted here.

```ts
import { describe, it, expect } from "bun:test"

const adminSource = await Bun.file("app/api/actions/admin.ts").text()
const ownerSource = await Bun.file("app/api/actions/owner.ts").text()

describe("updateCafeImages (admin)", () => {
    it("is exported", () => {
        expect(/export async function updateCafeImages\(/.test(adminSource)).toBe(true)
    })

    it("validates the patch and revalidates the preview", () => {
        const body = adminSource.slice(adminSource.indexOf("export async function updateCafeImages("))
        expect(body).toContain("parseCafeImagesPatch")
        expect(body).toContain('revalidatePath("/manage/preview/[id]"')
    })

    it("logs the change against the cafe id", () => {
        const body = adminSource.slice(adminSource.indexOf("export async function updateCafeImages("))
        expect(body).toContain('logSystemAction(\n            "update",')
    })

    it("accepts a null thumbnail in updateCafe's payload type", () => {
        expect(/thumbnail: string \| null/.test(adminSource)).toBe(true)
    })
})

describe("updateCafeImagesAsOwner (owner)", () => {
    it("is exported and ownership-checked", () => {
        const body = ownerSource.slice(ownerSource.indexOf("export async function updateCafeImagesAsOwner("))
        expect(body.length).toBeGreaterThan(0)
        expect(body).toContain("isOwnerOfCafe(cafeId)")
    })

    it("accepts thumbnail and gallery in the owner update type", () => {
        const typeBlock = ownerSource.slice(
            ownerSource.indexOf("export async function updateCafeAsOwner("),
        )
        expect(typeBlock.slice(0, 3000)).toContain("thumbnail: string | null")
        expect(typeBlock.slice(0, 3000)).toContain("gallery: string[]")
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test app/api/actions/__tests__/cafe-images.test.ts`
Expected: FAIL — `updateCafeImages` is not present in either file.

- [ ] **Step 3: Implement**

In `app/api/actions/admin.ts`, add the import:

```ts
import { parseCafeImagesPatch } from "@/utils/validation/cafe-images"
```

and after `adminDeleteCafeImage`:

```ts
/**
 * Persist only the cafe image fields (admin/moderator).
 * Kept separate from updateCafe so an image auto-save can never clobber edits
 * being made in another section of the editor.
 */
export async function updateCafeImages(
    cafeId: string,
    patch: { thumbnail?: string | null; gallery?: string[] }
): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const parsed = parseCafeImagesPatch(patch)
    if (!parsed.ok) return { success: false, error: parsed.error }

    const profileResult = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (profileResult[0]?.role !== 'admin' && profileResult[0]?.role !== 'moderator') {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await db
            .update(cafes)
            .set({
                ...(parsed.value.thumbnail !== undefined ? { thumbnail: parsed.value.thumbnail } : {}),
                ...(parsed.value.gallery !== undefined ? { gallery: parsed.value.gallery } : {}),
                updatedAt: new Date(),
            })
            .where(eq(cafes.id, cafeId))

        revalidatePath("/manage/preview/[id]", "page")
        revalidatePath("/cafes/[slug]", "page")

        await logSystemAction(
            "update",
            "cafe",
            cafeId,
            null,
            parsed.value,
            { reason: "Cafe images updated by admin" }
        )

        return { success: true }
    } catch (error) {
        console.error("Error updating cafe images:", error)
        return { success: false, error: "Failed to save images" }
    }
}
```

This file does not currently import `revalidatePath`; add it to the `next/cache` import, or add `import { revalidatePath } from "next/cache"` if no such import exists.

In `app/api/actions/owner.ts`, add the same import of `parseCafeImagesPatch` and, after `deleteCafeImageAsOwner`:

```ts
/**
 * Persist only the cafe image fields (owner).
 */
export async function updateCafeImagesAsOwner(
    cafeId: string,
    patch: { thumbnail?: string | null; gallery?: string[] }
): Promise<OwnerActionResult> {
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        return { success: false, error: 'Not authorized to manage this cafe' }
    }

    const parsed = parseCafeImagesPatch(patch)
    if (!parsed.ok) return { success: false, error: parsed.error }

    try {
        await db
            .update(cafes)
            .set({
                ...(parsed.value.thumbnail !== undefined ? { thumbnail: parsed.value.thumbnail } : {}),
                ...(parsed.value.gallery !== undefined ? { gallery: parsed.value.gallery } : {}),
                updatedAt: new Date(),
            })
            .where(eq(cafes.id, cafeId))

        revalidatePath("/owner/cafes/[slug]/edit", "page")
        revalidatePath("/cafes/[slug]", "page")

        await logSystemAction(
            "update",
            "cafe",
            cafeId,
            null,
            parsed.value,
            { reason: "Cafe images updated by owner" }
        )

        return { success: true }
    } catch (error) {
        console.error("Error updating cafe images as owner:", error)
        return { success: false, error: "Failed to save images" }
    }
}
```

In both files, widen the `thumbnail` field of the existing `updateCafe` / `updateCafeAsOwner` update types to `string | null`, and add `gallery: string[]` to the owner's type (it has no image fields at all today, which is bug B1):

```ts
        thumbnail: string | null
        gallery: string[]
```

`owner.ts` imports `revalidatePath` already (`:30`); `logSystemAction` needs importing there if it is not already imported.

- [ ] **Step 4: Run the test, typecheck, and lint**

Run: `bun test app/api/actions/__tests__/cafe-images.test.ts && bunx tsc --noEmit && bun lint`
Expected: PASS, then no output.

- [ ] **Step 5: Commit**

```bash
git add app/api/actions/admin.ts app/api/actions/owner.ts app/api/actions/__tests__/cafe-images.test.ts
git commit -m "feat(cafe): add field-level updateCafeImages actions

Images now persist through a dedicated action that only touches thumbnail
and gallery, revalidates the preview and public page, and audits against
the cafe id. The owner update type gains the image fields it was missing."
```

---

## Task 10: `useImageUploadQueue`

**Files:**
- Create: `utils/hooks/useImageUploadQueue.ts`
- Test: `utils/hooks/__tests__/useImageUploadQueue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `utils/hooks/__tests__/useImageUploadQueue.test.ts`:

```ts
import { describe, it, expect, mock } from "bun:test"
import { renderHook, act, waitFor } from "@testing-library/react"

mock.module("@/utils/image-processing", () => ({
    compressImageFor: async (purpose: string, file: File) => file,
}))

import { useImageUploadQueue } from "@/utils/hooks/useImageUploadQueue"

const file = (name: string) => new File(["bytes"], name, { type: "image/png" })

describe("useImageUploadQueue", () => {
    it("uploads queued files and reports each result", async () => {
        const uploaded: string[] = []
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            compress: async (_purpose, f) => f,
            upload: async (f) => {
                uploaded.push(f.name)
                return { success: true, url: `https://cdn.grounds.ph/cafes/x/${f.name}` }
            },
        }))

        act(() => result.current.enqueue([file("a.png"), file("b.png")]))

        await waitFor(() => expect(result.current.items.every(i => i.status === "done")).toBe(true))
        expect(uploaded.sort()).toEqual(["a.png", "b.png"])
        expect(result.current.items[0].url).toContain("a.png")
    })

    it("keeps a failed file retryable and then succeeds", async () => {
        let attempt = 0
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            compress: async (_purpose, f) => f,
            upload: async (f) => {
                attempt += 1
                if (attempt === 1) return { success: false, error: "Network error" }
                return { success: true, url: `https://cdn.grounds.ph/cafes/x/${f.name}` }
            },
        }))

        act(() => result.current.enqueue([file("a.png")]))
        await waitFor(() => expect(result.current.items[0].status).toBe("error"))
        expect(result.current.items[0].error).toBe("Network error")

        act(() => result.current.retry(result.current.items[0].id))
        await waitFor(() => expect(result.current.items[0].status).toBe("done"))
    })

    it("rejects an unsupported type before uploading", async () => {
        let uploadCalls = 0
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            compress: async (_purpose, f) => f,
            upload: async (f) => {
                uploadCalls += 1
                return { success: true, url: f.name }
            },
        }))

        act(() => result.current.enqueue([new File(["x"], "notes.txt", { type: "text/plain" })]))

        await waitFor(() => expect(result.current.items[0].status).toBe("error"))
        expect(uploadCalls).toBe(0)
        expect(result.current.items[0].error).toContain("image")
    })

    it("dismisses an item and keeps the rest", async () => {
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            compress: async (_purpose, f) => f,
            upload: async (f) => ({ success: true, url: f.name }),
        }))

        act(() => result.current.enqueue([file("a.png"), file("b.png")]))
        await waitFor(() => expect(result.current.items).toHaveLength(2))

        act(() => result.current.dismiss(result.current.items[0].id))
        expect(result.current.items).toHaveLength(1)
    })

    it("enforces the gallery cap", async () => {
        const { result } = renderHook(() => useImageUploadQueue({
            purpose: "cafe-gallery",
            maxFiles: 1,
            compress: async (_purpose, f) => f,
            upload: async (f) => ({ success: true, url: f.name }),
        }))

        act(() => result.current.enqueue([file("a.png"), file("b.png")]))
        await waitFor(() => expect(result.current.items).toHaveLength(1))
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test utils/hooks/__tests__/useImageUploadQueue.test.ts`
Expected: FAIL — cannot resolve `@/utils/hooks/useImageUploadQueue`.

- [ ] **Step 3: Implement**

Create `utils/hooks/useImageUploadQueue.ts`:

```ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ImagePurpose } from "@/utils/image-processing"
import { MAX_CAFE_GALLERY } from "@/utils/validation/cafe-images"

export type UploadStatus = "queued" | "compressing" | "uploading" | "done" | "error"

export interface UploadItem {
    id: string
    fileName: string
    previewUrl: string
    status: UploadStatus
    progress: number
    error?: string
    url?: string
}

export interface UploadResult {
    success: boolean
    url?: string
    error?: string
}

interface UseImageUploadQueueOptions {
    purpose: ImagePurpose
    cafeId?: string
    concurrency?: number
    maxFiles?: number
    compress?: (purpose: ImagePurpose, file: File) => Promise<File>
    upload?: (file: File, onProgress: (progress: number) => void) => Promise<UploadResult>
    onComplete?: (result: { id: string; fileName: string; url: string }) => void
    onReject?: (fileName: string, reason: string) => void
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]
const MAX_FILE_BYTES = 5 * 1024 * 1024

async function defaultCompress(purpose: ImagePurpose, file: File): Promise<File> {
    const { compressImageFor } = await import("@/utils/image-processing")
    return compressImageFor(purpose, file)
}

export function useImageUploadQueue(options: UseImageUploadQueueOptions) {
    const {
        purpose,
        cafeId,
        concurrency = 3,
        maxFiles = MAX_CAFE_GALLERY,
        onComplete,
        onReject,
    } = options

    const [items, setItems] = useState<UploadItem[]>([])
    const itemsRef = useRef<UploadItem[]>([])
    itemsRef.current = items
    const runningRef = useRef(0)
    const queueRef = useRef<string[]>([])
    const filesRef = useRef(new Map<string, File>())
    const counterRef = useRef(0)

    const compress = useCallback(
        async (file: File) => (options.compress ?? defaultCompress)(purpose, file),
        [options.compress, purpose]
    )

    const upload = useCallback(
        async (file: File, onProgress: (progress: number) => void) => {
            if (options.upload) return options.upload(file, onProgress)
            const { uploadWithProgress } = await import("@/utils/storage/client")
            return uploadWithProgress({ file, bucket: "cafes", cafeId, onProgress })
        },
        [options.upload, cafeId]
    )

    const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)))
    }, [])

    const runOne = useCallback(async (id: string) => {
        const file = filesRef.current.get(id)
        if (!file) return

        patch(id, { status: "compressing", progress: 0 })

        try {
            const compressed = await compress(file)
            patch(id, { status: "uploading" })

            const result = await upload(compressed, (progress) => patch(id, { progress }))

            if (result.success && result.url) {
                patch(id, { status: "done", progress: 100, url: result.url })
                onComplete?.({ id, fileName: file.name, url: result.url })
            } else {
                patch(id, { status: "error", error: result.error ?? "Upload failed" })
            }
        } catch (error) {
            patch(id, {
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
            })
        }
    }, [compress, upload, patch, onComplete])

    const pump = useCallback(() => {
        while (runningRef.current < concurrency && queueRef.current.length > 0) {
            const id = queueRef.current.shift()
            if (!id) break
            runningRef.current += 1
            void runOne(id).finally(() => {
                runningRef.current -= 1
                pump()
            })
        }
    }, [concurrency, runOne])

    const enqueue = useCallback((files: File[]) => {
        const accepted: UploadItem[] = []

        for (const file of files) {
            if (accepted.length + filesRef.current.size >= maxFiles) {
                onReject?.(file.name, `You can have at most ${maxFiles} gallery images`)
                continue
            }
            if (!ACCEPTED_TYPES.includes(file.type)) {
                onReject?.(file.name, `${file.name} is not a supported image`)
                continue
            }
            if (file.size > MAX_FILE_BYTES) {
                onReject?.(file.name, `${file.name} is larger than 5MB`)
                continue
            }

            counterRef.current += 1
            const id = `upload-${counterRef.current}`
            filesRef.current.set(id, file)
            accepted.push({
                id,
                fileName: file.name,
                previewUrl: URL.createObjectURL(file),
                status: "queued",
                progress: 0,
            })
            queueRef.current.push(id)
        }

        if (accepted.length === 0) return
        setItems((prev) => [...prev, ...accepted])
        pump()
    }, [maxFiles, onReject, pump])

    const retry = useCallback((id: string) => {
        patch(id, { status: "queued", progress: 0, error: undefined })
        queueRef.current.push(id)
        pump()
    }, [patch, pump])

    const dismiss = useCallback((id: string) => {
        const item = items.find((i) => i.id === id)
        if (item) URL.revokeObjectURL(item.previewUrl)
        filesRef.current.delete(id)
        queueRef.current = queueRef.current.filter((queued) => queued !== id)
        setItems((prev) => prev.filter((i) => i.id !== id))
    }, [items])

    const clearCompleted = useCallback(() => {
        setItems((prev) => {
            for (const item of prev) {
                if (item.status === "done") URL.revokeObjectURL(item.previewUrl)
            }
            return prev.filter((item) => item.status !== "done")
        })
    }, [])

    useEffect(() => () => {
        for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl)
    }, [])

    return {
        items,
        enqueue,
        retry,
        dismiss,
        clearCompleted,
        isBusy: items.some((item) => item.status === "queued" || item.status === "compressing" || item.status === "uploading"),
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test utils/hooks/__tests__/useImageUploadQueue.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite and commit**

Run: `bun test && bunx tsc --noEmit`
Expected: 919 + new tests passing; 17 pre-existing failures unchanged.

```bash
git add utils/hooks/useImageUploadQueue.ts utils/hooks/__tests__/useImageUploadQueue.test.ts
git commit -m "feat(images): add the per-file upload queue with progress and retry"
```

---

## Task 11: `useCafeImages`

**Files:**
- Create: `utils/hooks/useCafeImages.ts`
- Test: `utils/hooks/__tests__/useCafeImages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `utils/hooks/__tests__/useCafeImages.test.ts`:

```ts
import { describe, it, expect } from "bun:test"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useCafeImages } from "@/utils/hooks/useCafeImages"

const thumb = "https://cdn.grounds.ph/cafes/aaa/cover.webp"
const second = "https://cdn.grounds.ph/cafes/aaa/second.webp"

describe("useCafeImages", () => {
    it("persists a gallery addition after the debounce", async () => {
        const saved: unknown[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [] },
            save: async (patch) => { saved.push(patch); return { success: true } },
            removeFile: async () => ({ success: true }),
            debounceMs: 5,
        }))

        act(() => result.current.appendGallery([second]))
        await waitFor(() => expect(saved).toHaveLength(1))
        expect(saved[0]).toEqual({ gallery: [second] })
    })

    it("saves before deleting the storage object when removing an image", async () => {
        const order: string[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [second] },
            save: async () => { order.push("save"); return { success: true } },
            removeFile: async () => { order.push("delete"); return { success: true } },
            debounceMs: 5,
        }))

        await act(async () => { await result.current.removeGalleryAt(0) })
        await waitFor(() => expect(order).toContain("delete"))
        expect(order.indexOf("save")).toBeLessThan(order.indexOf("delete"))
        expect(result.current.gallery).toEqual([])
    })

    it("restores the image and deletes nothing when the save fails", async () => {
        const order: string[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [second] },
            save: async () => ({ success: false, error: "Boom" }),
            removeFile: async () => { order.push("delete"); return { success: true } },
            debounceMs: 5,
        }))

        await act(async () => { await result.current.removeGalleryAt(0) })
        await waitFor(() => expect(result.current.saveState.error).toBe("Boom"))
        expect(result.current.gallery).toEqual([second])
        expect(order).toEqual([])
    })

    it("clears the cover and persists null", async () => {
        const saved: unknown[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [] },
            save: async (patch) => { saved.push(patch); return { success: true } },
            removeFile: async () => ({ success: true }),
            debounceMs: 5,
        }))

        await act(async () => { await result.current.clearThumbnail() })
        await waitFor(() => expect(result.current.thumbnail).toBeNull())
        expect(saved[0]).toEqual({ thumbnail: null })
    })

    it("refuses to exceed the gallery cap", async () => {
        const gallery = Array.from({ length: 12 }, (_, i) => `https://cdn.grounds.ph/cafes/aaa/${i}.webp`)
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery },
            save: async () => ({ success: true }),
            removeFile: async () => ({ success: true }),
            debounceMs: 5,
        }))

        act(() => result.current.appendGallery([second]))
        expect(result.current.gallery).toHaveLength(12)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test utils/hooks/__tests__/useCafeImages.test.ts`
Expected: FAIL — cannot resolve `@/utils/hooks/useCafeImages`.

- [ ] **Step 3: Implement**

Create `utils/hooks/useCafeImages.ts`:

```ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MAX_CAFE_GALLERY } from "@/utils/validation/cafe-images"

export interface CafeImagesPatch {
    thumbnail?: string | null
    gallery?: string[]
}

export interface CafeImagesSaveState {
    dirty: boolean
    saving: boolean
    lastSavedAt: Date | null
    error: string | null
}

interface ActionResult {
    success: boolean
    error?: string
}

interface UseCafeImagesOptions {
    cafeId: string
    initial: { thumbnail: string | null; gallery: string[] }
    save: (patch: CafeImagesPatch) => Promise<ActionResult>
    removeFile: (url: string) => Promise<ActionResult>
    debounceMs?: number
    maxGallery?: number
}

export function useCafeImages(options: UseCafeImagesOptions) {
    const { cafeId, initial, save, removeFile, debounceMs = 600, maxGallery = MAX_CAFE_GALLERY } = options

    const [thumbnail, setThumbnail] = useState<string | null>(initial.thumbnail)
    const [gallery, setGallery] = useState<string[]>(initial.gallery)
    const [saveState, setSaveState] = useState<CafeImagesSaveState>({
        dirty: false,
        saving: false,
        lastSavedAt: null,
        error: null,
    })

    const pendingRef = useRef<CafeImagesPatch>({})
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const inFlightRef = useRef(false)

    const flush = useCallback(async () => {
        if (inFlightRef.current) return
        const patch = pendingRef.current
        if (patch.thumbnail === undefined && patch.gallery === undefined) return

        pendingRef.current = {}
        inFlightRef.current = true
        setSaveState((state) => ({ ...state, saving: true, error: null }))

        try {
            const result = await save(patch)
            if (result.success) {
                setSaveState({ dirty: pendingRef.current.gallery !== undefined || pendingRef.current.thumbnail !== undefined, saving: false, lastSavedAt: new Date(), error: null })
            } else {
                pendingRef.current = { ...patch, ...pendingRef.current }
                setSaveState((state) => ({ ...state, saving: false, dirty: true, error: result.error ?? "Failed to save images" }))
            }
        } catch (error) {
            pendingRef.current = { ...patch, ...pendingRef.current }
            setSaveState((state) => ({
                ...state,
                saving: false,
                dirty: true,
                error: error instanceof Error ? error.message : "Failed to save images",
            }))
        } finally {
            inFlightRef.current = false
            if (hasPending(pendingRef.current)) void flush()
        }
    }, [save])

    const schedule = useCallback((patch: CafeImagesPatch) => {
        pendingRef.current = { ...pendingRef.current, ...patch }
        setSaveState((state) => ({ ...state, dirty: true, error: null }))
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { void flush() }, debounceMs)
    }, [debounceMs, flush])

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current)
    }, [])

    const setCoverImage = useCallback((url: string | null) => {
        setThumbnail(url)
        schedule({ thumbnail: url })
    }, [schedule])

    const appendGallery = useCallback((urls: string[]) => {
        if (urls.length === 0) return
        const next = [...gallery, ...urls].slice(0, maxGallery)
        setGallery(next)
        schedule({ gallery: next })
    }, [gallery, maxGallery, schedule])

    const replaceGallery = useCallback((urls: string[]) => {
        const next = urls.slice(0, maxGallery)
        setGallery(next)
        schedule({ gallery: next })
    }, [maxGallery, schedule])

    const removeGalleryAt = useCallback(async (index: number) => {
        const removed = gallery[index]
        if (!removed) return

        const next = gallery.filter((_, i) => i !== index)
        setGallery(next)
        setSaveState((state) => ({ ...state, dirty: true, saving: true, error: null }))

        const result = await save({ gallery: next })
        if (!result.success) {
            setGallery(gallery)
            setSaveState((state) => ({ ...state, saving: false, dirty: true, error: result.error ?? "Failed to save images" }))
            return
        }

        setSaveState({ dirty: false, saving: false, lastSavedAt: new Date(), error: null })

        // Only now is it safe to drop the bytes: the database no longer references them
        const deletion = await removeFile(removed)
        if (!deletion.success) {
            console.warn("Cafe image removed from the database but not from storage:", removed, deletion.error)
        }
    }, [gallery, removeFile, save])

    const clearThumbnail = useCallback(async () => {
        const previous = thumbnail
        setThumbnail(null)
        setSaveState((state) => ({ ...state, dirty: true, saving: true, error: null }))

        const result = await save({ thumbnail: null })
        if (!result.success) {
            setThumbnail(previous)
            setSaveState((state) => ({ ...state, saving: false, dirty: true, error: result.error ?? "Failed to save images" }))
            return
        }

        setSaveState({ dirty: false, saving: false, lastSavedAt: new Date(), error: null })

        if (previous) {
            const deletion = await removeFile(previous)
            if (!deletion.success) {
                console.warn("Cafe cover removed from the database but not from storage:", previous, deletion.error)
            }
        }
    }, [removeFile, save, thumbnail])

    const moveGallery = useCallback((from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= gallery.length || to >= gallery.length) return
        const next = [...gallery]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        setGallery(next)
        schedule({ gallery: next })
    }, [gallery, schedule])

    const retrySave = useCallback(() => { void flush() }, [flush])

    return {
        cafeId,
        thumbnail,
        gallery,
        setCoverImage,
        appendGallery,
        replaceGallery,
        removeGalleryAt,
        moveGallery,
        clearThumbnail,
        saveState,
        retrySave,
    }
}

function hasPending(patch: CafeImagesPatch): boolean {
    return patch.thumbnail !== undefined || patch.gallery !== undefined
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test utils/hooks/__tests__/useCafeImages.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add utils/hooks/useCafeImages.ts utils/hooks/__tests__/useCafeImages.test.ts
git commit -m "feat(images): add useCafeImages for debounced, ordered image persistence"
```

---

## Task 12: Rewire `ImageSection` to the queue and the image hooks

**Files:**
- Modify: `components/cafe-editor/ImageSection.tsx`

- [ ] **Step 1: Replace the upload/removal props**

Replace the `onDeleteImage` prop declaration with:

```ts
    /** Delete a gallery image; the caller persists first, then removes the file */
    onDeleteImage: (url: string, index: number) => Promise<void>
    /** Clear the cover image; the caller persists first, then removes the file */
    onRemoveCoverImage?: () => Promise<void>
    /** A single finished upload, so the caller can append it to its own state */
    onImageUploaded?: (url: string) => void
```

- [ ] **Step 2: Replace the gallery upload/handler block**

Replace `uploadingGallery` state and `handleGalleryUpload` (`:70-107`) with the queue, and switch the `Add Photos` label's spinner condition from `uploadingGallery` to `uploadQueue.isBusy` (the label keeps using `Loader2` while any file is in flight):

```ts
    const uploadQueue = useImageUploadQueue({
        purpose: "cafe-gallery",
        cafeId,
        maxFiles: MAX_CAFE_GALLERY - gallery.length,
        onComplete: ({ url }) => onImageUploaded?.(url),
        onReject: (fileName, reason) => {
            console.warn(`Rejected ${fileName}: ${reason}`)
        },
    })
```

- [ ] **Step 3: Replace the removal handlers**

Replace `handleRemoveGalleryImage` and `handleRemoveCover` with:

```ts
    const handleRemoveGalleryImage = async (index: number) => {
        const url = gallery[index]
        if (!url) return
        await onDeleteImage(url, index)
    }

    const handleRemoveCover = async () => {
        if (!onRemoveCoverImage) return
        await onRemoveCoverImage()
    }
```

The `confirm()` calls move to the caller's confirm dialog in Plan B; keep them for now by wrapping the call site instead: in the two button `onClick` handlers, use

```tsx
onClick={() => { if (confirm("Remove this image?")) void handleRemoveGalleryImage(index) }}
```

and

```tsx
onClick={() => { if (confirm("Remove cover image?")) void handleRemoveCover() }}
```

- [ ] **Step 4: Render the upload tiles**

Inside the gallery grid, after the existing `Reorder.Item` elements, add:

```tsx
                        {uploadQueue.items.map((item) => (
                            <div
                                key={item.id}
                                className='relative flex-shrink-0 h-32 w-32 rounded-lg overflow-hidden bg-text/10 border border-text/10'
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={item.previewUrl}
                                    alt={item.fileName}
                                    className='absolute inset-0 w-full h-full object-cover opacity-40'
                                />
                                <div className='absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center'>
                                    {item.status === "error" ? (
                                        <>
                                            <span className='text-[10px] text-red-600 leading-tight'>{item.error}</span>
                                            <div className='flex gap-1'>
                                                <button
                                                    type='button'
                                                    onClick={() => uploadQueue.retry(item.id)}
                                                    className='px-2 py-1 text-[10px] bg-background rounded'
                                                >
                                                    Retry
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={() => uploadQueue.dismiss(item.id)}
                                                    className='px-2 py-1 text-[10px] bg-background rounded'
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span className='text-[10px] text-text/70 truncate w-full'>{item.fileName}</span>
                                            <span className='text-[10px] font-medium text-text'>
                                                {item.status === "compressing" ? "Optimising…" : `${item.progress}%`}
                                            </span>
                                            <div className='w-16 h-1 bg-text/20 rounded-full overflow-hidden'>
                                                <div
                                                    className={`h-full ${colors.bg}`}
                                                    style={{ width: `${item.progress}%` }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
```

Add the imports:

```ts
import { useImageUploadQueue } from "@/utils/hooks/useImageUploadQueue"
import { MAX_CAFE_GALLERY } from "@/utils/validation/cafe-images"
```

and remove the now-unused `uploadingGallery` state, the `compressGalleryImage` and `uploadCafeImage` imports if nothing else in the file uses them.

- [ ] **Step 5: Typecheck, lint, and run the editor test**

Run: `bunx tsc --noEmit && bun lint && bun test components/manage/__tests__/CafeEditor.test.tsx components/owner/__tests__/CafeEdit.test.tsx`
Expected: tsc/eslint no output. The two editor tests may fail until Task 13 updates their mocks; if they do, continue to Task 13 and fix them there (note which assertions failed).

- [ ] **Step 6: Commit**

```bash
git add components/cafe-editor/ImageSection.tsx
git commit -m "feat(cafe): show per-file upload status in the gallery and delegate removal"
```

---

## Task 13: Wire both editors to `useCafeImages`

**Files:**
- Modify: `components/manage/CafeEditor.tsx` (`:700-720` images wiring; `handleSave` ~:146-199)
- Modify: `components/owner/CafeEdit.tsx` (`:448-496` images wiring; `handleSave` `:98-147`)
- Test: `components/manage/__tests__/CafeEditor.test.tsx`, `components/owner/__tests__/CafeEdit.test.tsx` (adjust mocks)

- [ ] **Step 1: Add the hook to the admin editor**

In `components/manage/CafeEditor.tsx`, inside the component, add:

```ts
    const cafeImages = useCafeImages({
        cafeId: cafe.id,
        initial: { thumbnail: cafe.thumbnail, gallery: cafe.gallery || [] },
        save: (patch) => updateCafeImages(cafe.id, patch),
        removeFile: (url) => adminDeleteCafeImage(url, cafe.id),
    })
```

importing `useCafeImages` from `@/utils/hooks/useCafeImages` and `updateCafeImages` from `@/app/api/actions/admin`.

- [ ] **Step 2: Point the admin `ImageSection` at it**

Replace the images wiring (`:700-720`):

```tsx
                                thumbnail={cafeImages.thumbnail}
                                gallery={cafeImages.gallery}
                                onThumbnailChange={(url: string | null) => { cafeImages.setCoverImage(url) }}
                                onGalleryChange={(urls: string[]) => { cafeImages.replaceGallery(urls) }}
                                onImageUploaded={(url: string) => { cafeImages.appendGallery([url]) }}
                                onDeleteImage={async (_url, index) => { await cafeImages.removeGalleryAt(index) }}
                                onRemoveCoverImage={async () => { await cafeImages.clearThumbnail() }}
```

`onImageUploaded` appends one URL at a time, so two uploads finishing out of order cannot clobber each other through a stale array; `onGalleryChange` is only ever a reorder and maps to `replaceGallery`. Add `onImageUploaded` to the component's props destructuring, then add this test to `utils/hooks/__tests__/useCafeImages.test.ts` to cover the reorder path (`replaceGallery` is defined in Task 11):

```ts
    it("persists a reorder through replaceGallery", async () => {
        const saved: unknown[] = []
        const { result } = renderHook(() => useCafeImages({
            cafeId: "c1",
            initial: { thumbnail: thumb, gallery: [thumb, second] },
            save: async (patch) => { saved.push(patch); return { success: true } },
            removeFile: async () => ({ success: true }),
            debounceMs: 5,
        }))

        act(() => result.current.replaceGallery([second, thumb]))
        await waitFor(() => expect(saved).toHaveLength(1))
        expect(saved[0]).toEqual({ gallery: [second, thumb] })
    })
```

- [ ] **Step 3: Stop the main save from touching images**

In the admin `handleSave` payload, delete the `thumbnail,` and `gallery:` entries, since `useCafeImages` owns them. Do the same in the owner `handleSave` payload (which never had them — no change needed there beyond the type, already done in Task 9).

- [ ] **Step 4: Repeat for the owner editor**

In `components/owner/CafeEdit.tsx`, add the same hook wired to the owner actions:

```ts
    const cafeImages = useCafeImages({
        cafeId: cafe.id,
        initial: { thumbnail: cafe.thumbnail, gallery: cafe.gallery || [] },
        save: (patch) => updateCafeImagesAsOwner(cafe.id, patch),
        removeFile: (url) => deleteCafeImageAsOwner(cafe.id, url),
    })
```

and replace the `ImageSection` wiring at `:448-496` with the same six props as the admin editor (`thumbnail`, `gallery`, `onThumbnailChange`, `onGalleryChange` → `replaceGallery`, `onImageUploaded` → `appendGallery`, `onDeleteImage`, `onRemoveCoverImage`), keeping the existing `badgeStampUrl`/`onBadgeStampChange` props untouched.

- [ ] **Step 5: Update the editor test mocks**

In `components/manage/__tests__/CafeEditor.test.tsx` and `components/owner/__tests__/CafeEdit.test.tsx`, add `updateCafeImages` / `updateCafeImagesAsOwner` (and for the owner, `updateCafeImagesAsOwner`) to the mocked action modules:

```ts
    updateCafeImages: () => Promise.resolve({ success: true }),
    updateCafeImagesAsOwner: () => Promise.resolve({ success: true }),
```

- [ ] **Step 6: Verify**

Run: `bunx tsc --noEmit && bun lint && bun test`
Expected: no output from tsc/eslint; 919 pass plus the new tests; the 17 pre-existing failures unchanged. If any previously passing editor test now fails, fix the mock rather than the component.

- [ ] **Step 7: Commit**

```bash
git add components/manage/CafeEditor.tsx components/owner/CafeEdit.tsx utils/hooks/useCafeImages.ts utils/hooks/__tests__/useCafeImages.test.ts components/manage/__tests__/CafeEditor.test.tsx components/owner/__tests__/CafeEdit.test.tsx
git commit -m "feat(cafe): auto-save cafe images on both the admin and owner editors

Cover and gallery changes persist through updateCafeImages as they
happen; the main Save no longer carries image fields. Removal persists
before the storage object is deleted, so a failed save cannot lose data.
Owner image edits persist for the first time."
```

---

## Task 14: Read-only broken-image report

**Files:**
- Create: `utils/storage/cafe-image-audit.ts`
- Create: `scripts/report-broken-cafe-images.ts`
- Test: `utils/storage/__tests__/cafe-image-audit.test.ts` (create the directory)

- [ ] **Step 1: Write the failing test**

Create `utils/storage/__tests__/cafe-image-audit.test.ts`:

```ts
import { describe, it, expect } from "bun:test"
import { collectCafeImageUrls, summarizeBrokenImages } from "@/utils/storage/cafe-image-audit"

const row = {
    id: "cafe-1",
    name: "Kapi & Co.",
    thumbnail: "https://cdn.grounds.ph/cafes/aaa/cover.webp",
    gallery: ["https://cdn.grounds.ph/cafes/aaa/one.webp", "https://cdn.grounds.ph/cafes/aaa/one.webp"],
}

describe("collectCafeImageUrls", () => {
    it("collects the cover and de-duplicated gallery URLs", () => {
        const collected = collectCafeImageUrls([row])
        expect(collected.map((entry) => entry.url)).toEqual([
            "https://cdn.grounds.ph/cafes/aaa/cover.webp",
            "https://cdn.grounds.ph/cafes/aaa/one.webp",
        ])
    })

    it("skips placeholder covers and empty galleries", () => {
        const collected = collectCafeImageUrls([
            { id: "cafe-2", name: "Empty", thumbnail: "placeholder", gallery: null },
        ])
        expect(collected).toEqual([])
    })
})

describe("summarizeBrokenImages", () => {
    it("reports only the unreachable URLs grouped by cafe", () => {
        const summary = summarizeBrokenImages([
            { cafeId: "cafe-1", cafeName: "Kapi", url: "a.webp", status: 404 },
            { cafeId: "cafe-1", cafeName: "Kapi", url: "b.webp", status: 200 },
        ])
        expect(summary).toEqual([{ cafeId: "cafe-1", cafeName: "Kapi", brokenUrls: ["a.webp"] }])
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test utils/storage/__tests__/cafe-image-audit.test.ts`
Expected: FAIL — cannot resolve `@/utils/storage/cafe-image-audit`.

- [ ] **Step 3: Implement the pure helpers**

Create `utils/storage/cafe-image-audit.ts`:

```ts
export interface CafeImageRow {
    id: string
    name: string
    thumbnail: string | null
    gallery: string[] | null
}

export interface CafeImageUrl {
    cafeId: string
    cafeName: string
    url: string
}

export interface CheckedCafeImageUrl extends CafeImageUrl {
    status: number | null
}

export interface BrokenImageSummary {
    cafeId: string
    cafeName: string
    brokenUrls: string[]
}

const PLACEHOLDER_COVERS = new Set(["placeholder", "", "null"])

export function collectCafeImageUrls(rows: CafeImageRow[]): CafeImageUrl[] {
    const seen = new Set<string>()
    const collected: CafeImageUrl[] = []

    for (const row of rows) {
        const candidates = [
            ...(row.thumbnail && !PLACEHOLDER_COVERS.has(row.thumbnail) ? [row.thumbnail] : []),
            ...(row.gallery ?? []),
        ]

        for (const url of candidates) {
            if (!url || seen.has(url)) continue
            seen.add(url)
            collected.push({ cafeId: row.id, cafeName: row.name, url })
        }
    }

    return collected
}

export function summarizeBrokenImages(checked: CheckedCafeImageUrl[]): BrokenImageSummary[] {
    const byCafe = new Map<string, BrokenImageSummary>()

    for (const entry of checked) {
        const broken = entry.status === null || entry.status >= 400
        if (!broken) continue

        const existing = byCafe.get(entry.cafeId) ?? {
            cafeId: entry.cafeId,
            cafeName: entry.cafeName,
            brokenUrls: [],
        }
        existing.brokenUrls.push(entry.url)
        byCafe.set(entry.cafeId, existing)
    }

    return [...byCafe.values()]
}
```

- [ ] **Step 4: Write the script**

Create `scripts/report-broken-cafe-images.ts`:

```ts
/**
 * Read-only report: list cafes whose stored image URLs no longer resolve.
 *
 * Usage:
 *   bun run scripts/report-broken-cafe-images.ts
 *   bun run scripts/report-broken-cafe-images.ts --json
 *
 * This script never writes to the database or to storage.
 */
import "dotenv/config"
import { Pool } from "pg"
import {
    collectCafeImageUrls,
    summarizeBrokenImages,
    type CheckedCafeImageUrl,
} from "../utils/storage/cafe-image-audit"

const CONCURRENCY = 5

async function head(url: string): Promise<number | null> {
    try {
        const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) })
        return response.status
    } catch {
        return null
    }
}

async function checkAll(urls: { cafeId: string; cafeName: string; url: string }[]): Promise<CheckedCafeImageUrl[]> {
    const results: CheckedCafeImageUrl[] = []
    const queue = [...urls]

    async function worker() {
        while (queue.length > 0) {
            const entry = queue.shift()
            if (!entry) return
            results.push({ ...entry, status: await head(entry.url) })
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    return results
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? undefined : { rejectUnauthorized: false },
})

try {
    const { rows } = await pool.query<{
        id: string
        name: string
        thumbnail: string | null
        gallery: string[] | null
    }>('SELECT id, name, thumbnail, gallery FROM cafes')

    const urls = collectCafeImageUrls(rows)
    console.error(`Checking ${urls.length} image URLs across ${rows.length} cafes…`)

    const checked = await checkAll(urls)
    const broken = summarizeBrokenImages(checked)

    if (process.argv.includes("--json")) {
        console.log(JSON.stringify({ checkedCount: urls.length, broken }, null, 2))
    } else if (broken.length === 0) {
        console.log(`No broken images found (checked ${urls.length} URLs).`)
    } else {
        console.log(`${broken.length} cafe(s) have unreachable images:`)
        for (const cafe of broken) {
            console.log(`\n  ${cafe.cafeName} (${cafe.cafeId})`)
            for (const url of cafe.brokenUrls) console.log(`    - ${url}`)
        }
    }
} finally {
    await pool.end()
}
```

- [ ] **Step 5: Run the test and the script**

Run: `bun test utils/storage/__tests__/cafe-image-audit.test.ts`
Expected: PASS (3 tests).

Run: `bun run scripts/report-broken-cafe-images.ts`
Expected: a checklist of cafes and any unreachable URLs, or `No broken images found`. This connects to the developer database read-only; if `DATABASE_URL` is not set in `.env.local`, the script exits with a connection error and that is fine to report rather than fix.

- [ ] **Step 6: Commit**

```bash
git add utils/storage/cafe-image-audit.ts utils/storage/__tests__/cafe-image-audit.test.ts scripts/report-broken-cafe-images.ts
git commit -m "chore(scripts): report cafes with unreachable image URLs"
```

---

## Task 15: Full verification and manual QA

**Files:** none

- [ ] **Step 1: Static checks**

Run: `bunx tsc --noEmit && bun lint`
Expected: no output from either.

- [ ] **Step 2: Test suite against the known baseline**

Run: `bun test`
Expected: the 17 pre-existing failures only (ChatWindow location, ShrinkwrapBubble, CrawlCard, CafeHero claim button, CafeEditor location editing, HeroLocationCheckIn, Pending Submissions). Any other failure is a regression and must be fixed.

- [ ] **Step 3: Confirm no destructive SQL was introduced**

Run: `git diff prod...HEAD -- 'drizzle/migrations/*.sql'`
Expected: exactly one added file containing only `ALTER TABLE "cafes" ALTER COLUMN "thumbnail" DROP NOT NULL;`.

- [ ] **Step 4: Manual QA with the dev server**

Run: `bun dev`, then verify, signed in as an admin on `/manage/preview/<id>` and as an owner on `/owner/cafes/<slug>/edit`:

1. Drop 5 gallery images → tiles appear with names, progress, then the images join the gallery; a toast/log shows no errors; reload → all 5 persisted.
2. Reload mid-upload → no partial rows in the DB (the save is debounced and single-flight).
3. Turn off the network, drop an image → the tile shows an error with Retry; restore the network, Retry → it succeeds.
4. Replace the cover → after the save completes, the R2 object for the old cover is gone and the DB holds the new URL.
5. Remove a gallery image → it stays removed after reload; the file is deleted from R2 (confirm via the R2 dashboard or by requesting the old URL).
6. Remove the cover → the DB `thumbnail` is NULL and the cafe card renders the placeholder.
7. Upload a 6 MB JPEG as a gallery image → the client compresses it, and the stored object is a WebP well under 1 MB.
8. Rename a `.txt` to `.png` and upload it → rejected with a readable error (client type check or the server's content check).
9. Scan Menu on a real menu photo → items stream in; confirm the request URL in the Network tab ends in `/v1/chat/completions`.
10. Break the AI key temporarily (or use a bad base URL) → the UI shows a message containing the provider's status instead of a bare "AI service error: 404".

- [ ] **Step 5: Commit any QA fixes, then report**

```bash
git status --porcelain   # must be clean, or commit the QA fixes with a fix(...) message
git log --oneline prod..HEAD
```
Expected: 14 commits (Tasks 1-14), and a clean tree. Do not merge or push; the PR is opened by the orchestrator after Plan B.

---

## Self-review results

- **Spec coverage:** §6.1 (Task 9), §6.2 (Task 5), §6.3 (Tasks 3-4), §6.4 (Task 7), §4.4 (Task 10), §4.5 (Tasks 11-13), §4.6 `compressImageFor` (Task 6), §5 data flow and ordering rule (Tasks 11-12), §8 B3 (Task 1), B4 (Tasks 2-3), B5/B6 (Task 6), B7 (Task 9), B9/B10 (Tasks 7, 11-13), D12 report script (Task 14), §9 tests (every task), §10 commits 2-7 (Tasks 2-14). §4.1, §4.2, §4.3, §4.6 `ConfirmDialog`, §7 UX, and commits 1 and 8 are Plan B by design.
- **Placeholder scan:** no TBD/TODO. Every code step contains the code to write. The one deliberately deferred item is the exact generated migration filename, which is discovered by running `bun db:generate` in Task 7 Step 4 — that is a discovery step with a stated inspection gate, not a placeholder.
- **Type consistency:** `CafeImagesPatch` (`{thumbnail?: string | null; gallery?: string[]}`) is identical in `utils/validation/cafe-images.ts`, `useCafeImages.ts`, and both actions. `UploadItem`/`UploadStatus`/`UploadResult` are defined once in `useImageUploadQueue.ts` and consumed by `ImageSection` (tiles) and the hook options. The queue's `onComplete` payload `{id, fileName, url}` matches what `ImageSection` reads (`({ url }) => onImageUploaded?.(url)`). `compressImageFor(purpose, file)` matches its call sites; `useCoverImageUpload` keeps using `compressCoverImage` directly. `replaceGallery` is defined and returned in Task 11 and consumed in Task 13, with its test in Task 13 (the hook's own test file).
