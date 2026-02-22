# AI Chat Crawl Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the AI chat experience assemble a temporary cafe crawl (route) from tool results, render it in chat, and allow users to save it by opening the create crawl flow prefilled and set to private.

**Architecture:** Extend the chat response with a `crawlDraft` payload built deterministically from tool-call results and user intent (crawl/route keywords). The chat UI renders a crawl preview card with a “Save Crawl” button that stores the draft in localStorage and navigates to `/community/crawls/create?draft=chat`. The crawl editor reads and applies this draft on load (clearing it afterward) and defaults the crawl to private.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Bun test runner, Zod, motion/react, Drizzle ORM.

---

## Preflight (do once)
- Per request: no separate worktree; use current workspace.
- Run `bun install` if needed.
- Optional baseline: `bun lint`.

---

### Task 1: Add chat crawl draft types + response schema

**Files:**
- Modify: `utils/types/chat.ts`
- Modify: `app/api/actions/chat.ts`
- Test: `utils/__tests__/chat-types.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { chatResponseSchema } from "@/utils/types/chat"

describe("chat response schema", () => {
    it("accepts crawlDraft payload", () => {
        const res = {
            success: true,
            remaining: 9,
            crawlDraft: {
                title: "Cebu Coffee Crawl",
                description: "A short walkable route of top cafes",
                isPublic: false,
                items: [
                    {
                        cafeId: "550e8400-e29b-41d4-a716-446655440000",
                        name: "Cafe Uno",
                        slug: "cafe-uno",
                        thumbnail: null,
                        cityMunicipality: "Cebu City",
                        region: "Central Visayas",
                        lat: 10.3157,
                        lng: 123.8854,
                        sortOrder: 0,
                        note: null,
                    },
                ],
            },
        }

        const parsed = chatResponseSchema.parse(res)
        expect(parsed.crawlDraft?.items?.length).toBe(1)
        expect(parsed.crawlDraft?.isPublic).toBe(false)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/chat-types.test.ts`
Expected: FAIL (schema missing `crawlDraft`).

**Step 3: Write minimal implementation**

Update `utils/types/chat.ts`:

```ts
export const chatCrawlItemSchema = z.object({
    cafeId: z.string(),
    name: z.string(),
    slug: z.string(),
    thumbnail: z.string().nullable(),
    cityMunicipality: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    sortOrder: z.number().int(),
    note: z.string().nullable().optional(),
})

export const chatCrawlDraftSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    isPublic: z.boolean().optional(),
    items: z.array(chatCrawlItemSchema),
})

export const chatResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    remaining: z.number().int().min(0),
    error: z.string().optional(),
    data: z.unknown().optional(),
    cafes: z.array(chatCafeCardSchema).optional(),
    cardContext: chatCardContextSchema.optional(),
    crawlDraft: chatCrawlDraftSchema.optional(),
})

export type ChatCrawlDraft = z.infer<typeof chatCrawlDraftSchema>
export type ChatCrawlItem = z.infer<typeof chatCrawlItemSchema>
```

Update `app/api/actions/chat.ts` result type:

```ts
import type { ChatCafeCard, ChatCardContext, ChatCrawlDraft } from "@/utils/types/chat"

export interface SendChatMessageResult {
    success: boolean
    message?: string
    remaining: number
    error?: string
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
    crawlDraft?: ChatCrawlDraft
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/chat-types.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/types/chat.ts app/api/actions/chat.ts utils/__tests__/chat-types.test.ts
git commit -m "feat: add chat crawl draft response schema"
```

---

### Task 2: Build chat crawl draft mapper

**Files:**
- Create: `utils/ai/chat-crawl-draft.ts`
- Test: `utils/ai/__tests__/chat-crawl-draft.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { buildChatCrawlDraft } from "@/utils/ai/chat-crawl-draft"

describe("buildChatCrawlDraft", () => {
    it("builds a draft when crawl intent is present", () => {
        const draft = buildChatCrawlDraft(
            [
                {
                    toolName: "query_cafes",
                    params: { city: "Cebu" },
                    result: {
                        cafes: [
                            {
                                id: "1",
                                name: "Cafe Uno",
                                slug: "cafe-uno",
                                thumbnail: null,
                                cityMunicipality: "Cebu City",
                                region: "Central Visayas",
                                lat: 10.3157,
                                lng: 123.8854,
                            },
                        ],
                    },
                },
            ],
            "Build me a crawl in Cebu"
        )

        expect(draft?.title).toContain("Cebu")
        expect(draft?.items.length).toBe(1)
        expect(draft?.isPublic).toBe(false)
    })

    it("returns null when no crawl intent", () => {
        const draft = buildChatCrawlDraft([], "Top cafes in Cebu")
        expect(draft).toBeNull()
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `utils/ai/chat-crawl-draft.ts`:

```ts
import type { ChatCrawlDraft, ChatCrawlItem } from "@/utils/types/chat"
import type { ToolCallRecord } from "@/utils/ai/chat-tools"

const CRAWL_KEYWORDS = ["crawl", "route", "trail", "itinerary", "tour"]
const MAX_ITEMS = 8

function hasCrawlIntent(message: string): boolean {
    const text = message.toLowerCase()
    return CRAWL_KEYWORDS.some((k) => text.includes(k))
}

function toDraftItems(items: Record<string, unknown>[]): ChatCrawlItem[] {
    return items.slice(0, MAX_ITEMS).map((cafe, index) => ({
        cafeId: String(cafe.id ?? ""),
        name: String(cafe.name ?? cafe.title ?? ""),
        slug: String(cafe.slug ?? ""),
        thumbnail: typeof cafe.thumbnail === "string" ? cafe.thumbnail : null,
        cityMunicipality: typeof cafe.cityMunicipality === "string" ? cafe.cityMunicipality : null,
        region: typeof cafe.region === "string" ? cafe.region : null,
        lat: typeof cafe.lat === "number" ? cafe.lat : null,
        lng: typeof cafe.lng === "number" ? cafe.lng : null,
        sortOrder: index,
        note: null,
    }))
}

function buildTitle(params: Record<string, unknown>): string {
    if (typeof params.city === "string" && params.city) return `${params.city} Coffee Crawl`
    if (typeof params.province === "string" && params.province) return `${params.province} Coffee Crawl`
    if (typeof params.region === "string" && params.region) return `${params.region} Coffee Crawl`
    return "Custom Coffee Crawl"
}

export function buildChatCrawlDraft(
    records: ToolCallRecord[],
    message: string
): ChatCrawlDraft | null {
    if (!hasCrawlIntent(message)) return null

    for (const record of records) {
        if (!record || typeof record !== "object") continue
        const { toolName, params, result } = record
        if (!result || typeof result !== "object") continue

        if (toolName === "query_cafes" && Array.isArray((result as any).cafes)) {
            const items = toDraftItems((result as any).cafes)
            if (!items.length) return null
            return {
                title: buildTitle(params as Record<string, unknown>),
                description: "A short crawl curated from your request.",
                isPublic: false,
                items,
            }
        }

        if ((toolName === "get_nearby_cafes" || toolName === "get_top_rated") && Array.isArray(result)) {
            const items = toDraftItems(result as Record<string, unknown>[])
            if (!items.length) return null
            return {
                title: buildTitle(params as Record<string, unknown>),
                description: "A short crawl curated from your request.",
                isPublic: false,
                items,
            }
        }
    }

    return null
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/ai/chat-crawl-draft.ts utils/ai/__tests__/chat-crawl-draft.test.ts
git commit -m "feat: build chat crawl draft from tool results"
```

---

### Task 3: Wire crawl draft into chat tools + server action

**Files:**
- Modify: `utils/ai/chat-tools.ts`
- Modify: `app/api/actions/chat.ts`
- Test: `utils/ai/__tests__/chat-tools.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, mock } from "bun:test"

mock.module("@/utils/ai/chat-crawl-draft", () => ({
    buildChatCrawlDraft: () => ({
        title: "Custom Coffee Crawl",
        description: "Draft",
        isPublic: false,
        items: [],
    }),
}))

const { runChatWithTools } = await import("@/utils/ai/chat-tools")

describe("runChatWithTools crawl draft", () => {
    it("returns crawlDraft when builder provides one", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        choices: [{ message: { content: "Here you go" } }],
                    }),
            } as Response)
        )
        global.fetch = mockFetch

        const result = await runChatWithTools({
            message: "Build a crawl",
            sessionId: "test",
        })

        expect(result.crawlDraft).toBeDefined()
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-tools.test.ts`
Expected: FAIL (crawlDraft missing).

**Step 3: Write minimal implementation**

In `utils/ai/chat-tools.ts`:

```ts
import { buildChatCrawlDraft } from "@/utils/ai/chat-crawl-draft"
import type { ChatCafeCard, ChatCardContext, ChatCrawlDraft } from "@/utils/types/chat"

export interface ChatToolResult {
    message: string
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
    crawlDraft?: ChatCrawlDraft
    toolCalls?: ToolCallRecord[]
}
```

After tool execution, build crawl draft alongside cafe cards:

```ts
const { cafes, cardContext } = buildChatCafeCards(toolCallRecords)
const crawlDraft = buildChatCrawlDraft(toolCallRecords, message)

return {
    message: response.content ?? "I don't have a response for that.",
    cafes,
    cardContext,
    crawlDraft,
    toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
}
```

Update `app/api/actions/chat.ts` return payload to include `crawlDraft`.

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/chat-tools.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/ai/chat-tools.ts app/api/actions/chat.ts utils/ai/__tests__/chat-tools.test.ts
git commit -m "feat: return crawl drafts from chat tools"
```

---

### Task 4: Add chat crawl draft storage helper

**Files:**
- Create: `utils/chat-crawl-draft.ts`
- Test: `utils/__tests__/chat-crawl-draft.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "bun:test"
import { saveChatCrawlDraft, loadChatCrawlDraft, clearChatCrawlDraft } from "@/utils/chat-crawl-draft"

describe("chat crawl draft storage", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it("round-trips draft data", () => {
        saveChatCrawlDraft({ title: "Draft", items: [], isPublic: false })
        const loaded = loadChatCrawlDraft()
        expect(loaded?.title).toBe("Draft")
        clearChatCrawlDraft()
        expect(loadChatCrawlDraft()).toBeNull()
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/chat-crawl-draft.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `utils/chat-crawl-draft.ts`:

```ts
import type { ChatCrawlDraft } from "@/utils/types/chat"

const CHAT_CRAWL_DRAFT_KEY = "chat-crawl-draft"

export function saveChatCrawlDraft(draft: ChatCrawlDraft) {
    if (typeof window === "undefined") return
    localStorage.setItem(CHAT_CRAWL_DRAFT_KEY, JSON.stringify(draft))
}

export function loadChatCrawlDraft(): ChatCrawlDraft | null {
    if (typeof window === "undefined") return null
    const raw = localStorage.getItem(CHAT_CRAWL_DRAFT_KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw) as ChatCrawlDraft
    } catch {
        return null
    }
}

export function clearChatCrawlDraft() {
    if (typeof window === "undefined") return
    localStorage.removeItem(CHAT_CRAWL_DRAFT_KEY)
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/chat-crawl-draft.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/chat-crawl-draft.ts utils/__tests__/chat-crawl-draft.test.ts
git commit -m "feat: add chat crawl draft storage"
```

---

### Task 5: Render crawl preview in chat + Save Crawl button

**Files:**
- Create: `components/chat/ChatCrawlPreview.tsx`
- Modify: `components/chat/ChatMessage.tsx`
- Modify: `components/chat/ChatWindow.tsx`
- Test: `components/chat/__tests__/chat-message-crawl-preview.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"
import ChatMessage from "@/components/chat/ChatMessage"

describe("ChatMessage crawl preview", () => {
    it("renders Save Crawl button", () => {
        const { getByText } = render(
            <ChatMessage
                message={{
                    id: "1",
                    role: "assistant",
                    content: "Here is your crawl",
                    timestamp: new Date(),
                    crawlDraft: {
                        title: "Custom Coffee Crawl",
                        isPublic: false,
                        items: [],
                    },
                }}
            />
        )

        expect(getByText("Save Crawl")).toBeTruthy()
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/chat/__tests__/chat-message-crawl-preview.test.tsx`
Expected: FAIL (component missing).

**Step 3: Write minimal implementation**

Create `components/chat/ChatCrawlPreview.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { MapPin, Route } from "lucide-react"
import type { ChatCrawlDraft } from "@/utils/types/chat"
import { saveChatCrawlDraft } from "@/utils/chat-crawl-draft"

interface ChatCrawlPreviewProps {
    draft: ChatCrawlDraft
}

export default function ChatCrawlPreview({ draft }: ChatCrawlPreviewProps) {
    const router = useRouter()

    const handleSave = () => {
        saveChatCrawlDraft({ ...draft, isPublic: false })
        router.push("/community/crawls/create?draft=chat")
    }

    return (
        <div className="mt-3 border border-primary/10 rounded-xl p-3 bg-secondary/5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-text">{draft.title}</p>
                    {draft.description && (
                        <p className="text-xs text-text/60 mt-1">{draft.description}</p>
                    )}
                    <p className="text-xs text-text/60 mt-2 flex items-center gap-1">
                        <Route className="w-3 h-3" />
                        {draft.items.length} stops
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    className="px-3 py-2 text-xs font-medium rounded-full bg-primary text-primary-foreground"
                >
                    Save Crawl
                </button>
            </div>

            {draft.items.length > 0 && (
                <div className="mt-3 space-y-2">
                    {draft.items.slice(0, 4).map((item) => (
                        <div key={item.cafeId} className="flex items-center gap-2 text-xs text-text/70">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                {item.sortOrder + 1}
                            </span>
                            <span className="truncate">{item.name}</span>
                            {(item.cityMunicipality || item.region) && (
                                <span className="ml-auto flex items-center gap-1 text-text/40">
                                    <MapPin className="w-3 h-3" />
                                    {item.cityMunicipality ?? item.region}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
```

Update `components/chat/ChatMessage.tsx` message type and render:

```tsx
import type { ChatCafeCard, ChatCardContext, ChatCrawlDraft } from "@/utils/types/chat"
import ChatCrawlPreview from "./ChatCrawlPreview"

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
    crawlDraft?: ChatCrawlDraft
}

{message.crawlDraft && <ChatCrawlPreview draft={message.crawlDraft} />}
```

Update `components/chat/ChatWindow.tsx` to attach `crawlDraft` to assistant messages:

```ts
const assistantMessage: Message = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: result.message,
    timestamp: new Date(),
    cafes: result.cafes,
    cardContext: result.cardContext,
    crawlDraft: result.crawlDraft,
}
```

**Step 4: Run test to verify it passes**

Run: `bun test components/chat/__tests__/chat-message-crawl-preview.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/chat/ChatCrawlPreview.tsx components/chat/ChatMessage.tsx components/chat/ChatWindow.tsx components/chat/__tests__/chat-message-crawl-preview.test.tsx
git commit -m "feat: render chat crawl preview with save button"
```

---

### Task 6: Prefill CrawlEditor from chat draft and default private

**Files:**
- Modify: `components/crawls/CrawlEditor.tsx`
- Test: `utils/__tests__/chat-crawl-draft.test.ts`

**Step 1: Write the failing test**

Add a new test case to `utils/__tests__/chat-crawl-draft.test.ts`:

```ts
it("returns null when no draft exists", () => {
    localStorage.clear()
    expect(loadChatCrawlDraft()).toBeNull()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/chat-crawl-draft.test.ts`
Expected: FAIL until helper handles empty state.

**Step 3: Write minimal implementation**

In `components/crawls/CrawlEditor.tsx`, load the draft when `draft=chat` is present:

```ts
import { useSearchParams } from "next/navigation"
import { loadChatCrawlDraft, clearChatCrawlDraft } from "@/utils/chat-crawl-draft"

const searchParams = useSearchParams()

useEffect(() => {
    if (searchParams.get("draft") !== "chat") return
    const draft = loadChatCrawlDraft()
    if (!draft) return

    setTitle(draft.title)
    setDescription(draft.description ?? "")
    setItems(
        draft.items.map((item) => ({
            cafeId: item.cafeId,
            sortOrder: item.sortOrder,
            note: item.note ?? null,
            name: item.name,
            slug: item.slug,
            thumbnail: item.thumbnail,
            cityMunicipality: item.cityMunicipality ?? undefined,
            region: item.region ?? undefined,
            lat: item.lat ?? undefined,
            lng: item.lng ?? undefined,
        }))
    )
    setIsPublic(false)
    clearChatCrawlDraft()
}, [searchParams])
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/chat-crawl-draft.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/crawls/CrawlEditor.tsx utils/__tests__/chat-crawl-draft.test.ts
git commit -m "feat: prefill crawl editor from chat draft"
```

---

### Task 7: Document crawl drafts in AI chat docs

**Files:**
- Modify: `docs/ai.md`

**Step 1: Write the failing test**

No automated test required.

**Step 2: Run test to verify it fails**

Skip.

**Step 3: Write minimal implementation**

Add a section to `docs/ai.md` describing `crawlDraft`:

```md
## Crawl Drafts in Chat

When a user asks for a crawl/route, the chat response may include a `crawlDraft` payload.

```json
{
  "crawlDraft": {
    "title": "Cebu Coffee Crawl",
    "description": "A short crawl curated from your request.",
    "isPublic": false,
    "items": [
      {
        "cafeId": "...",
        "name": "Cafe Uno",
        "slug": "cafe-uno",
        "thumbnail": null,
        "cityMunicipality": "Cebu City",
        "region": "Central Visayas",
        "lat": 10.3157,
        "lng": 123.8854,
        "sortOrder": 0,
        "note": null
      }
    ]
  }
}
```

The chat UI renders a crawl preview card and provides a “Save Crawl” button that opens `/community/crawls/create?draft=chat` with the draft prefilled and set to private.
```

**Step 4: Run test to verify it passes**

Skip.

**Step 5: Commit**

```bash
git add docs/ai.md
git commit -m "docs: add chat crawl draft response"
```

---

## Manual QA checklist
- Chat: ask “Build a crawl in Cebu” and confirm a crawl preview renders with a “Save Crawl” button.
- Chat: click “Save Crawl” and confirm navigation to `/community/crawls/create?draft=chat`.
- Create Crawl: confirm title/description/items are prefilled and visibility defaults to Private.
- Create Crawl: save and verify crawl is created and only visible to the owner.
- Chat: ask non-crawl questions and confirm no crawl preview appears.

## Additional suggestions (optional)
- Add a compact mini-map preview inside the chat crawl card once performance permits.
- Add a “Refine this crawl” button to re-run the query with constraints (distance, number of stops).
- Provide a default stop limit selector (3/5/8) before saving.
- Track analytics on crawl intent rate and save conversion.
- Consider a “draft” status for chat-sourced crawls to avoid publishing by default.

---

Plan complete and saved to `docs/plans/2026-02-22-ai-chat-crawl-tool.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
