# Chat Crawl Quality + UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create more meaningful crawl ordering with an explanation, close chat on Save Crawl, and restyle markdown in chat for compact UI consistency.

**Architecture:** Add a crawl ordering utility that creates a walkable route using a centroid + nearest-neighbor path and injects a short rationale. Save Crawl button will trigger a chat-close event dispatched via a lightweight event emitter. Chat markdown will use a compact Tailwind class preset for the chat window.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Bun tests, Zod.

---

### Task 1: Add crawl route ordering + rationale builder

**Files:**
- Create: `utils/crawls/route-planner.ts`
- Test: `utils/__tests__/route-planner.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { buildRoutePlan } from "@/utils/crawls/route-planner"

describe("buildRoutePlan", () => {
    it("orders cafes by centroid + nearest neighbor and returns rationale", () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, rating: 4.6 },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, rating: 4.2 },
            { id: "3", name: "C", slug: "c", lat: 10.3200, lng: 123.8800, rating: 4.8 },
        ]

        const plan = buildRoutePlan(cafes)

        expect(plan.ordered.length).toBe(3)
        expect(plan.reason).toContain("centroid")
        expect(plan.reason).toContain("nearest")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/route-planner.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `utils/crawls/route-planner.ts`:

```ts
interface RouteCafe {
    id: string
    name: string
    slug: string
    lat: number | null
    lng: number | null
    rating?: number | null
}

function distance(a: RouteCafe, b: RouteCafe): number {
    if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Number.POSITIVE_INFINITY
    const dx = a.lat - b.lat
    const dy = a.lng - b.lng
    return Math.hypot(dx, dy)
}

function centroid(cafes: RouteCafe[]) {
    const points = cafes.filter((c) => c.lat != null && c.lng != null)
    if (points.length === 0) return null
    const lat = points.reduce((sum, c) => sum + (c.lat ?? 0), 0) / points.length
    const lng = points.reduce((sum, c) => sum + (c.lng ?? 0), 0) / points.length
    return { lat, lng }
}

export function buildRoutePlan(cafes: RouteCafe[]) {
    if (cafes.length <= 2) {
        return {
            ordered: cafes,
            reason: "With only a couple of stops, the order follows the original listing.",
        }
    }

    const center = centroid(cafes)
    const start = center
        ? cafes
              .filter((c) => c.lat != null && c.lng != null)
              .sort((a, b) => distance({ ...a, ...center } as RouteCafe, a) - distance({ ...a, ...center } as RouteCafe, b))[0]
        : cafes[0]

    const remaining = cafes.filter((c) => c.id !== start.id)
    const ordered = [start]

    while (remaining.length > 0) {
        const last = ordered[ordered.length - 1]
        remaining.sort((a, b) => distance(last, a) - distance(last, b))
        ordered.push(remaining.shift()!)
    }

    return {
        ordered,
        reason: "Started near the route centroid and chose the nearest next stop to keep the path walkable.",
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/route-planner.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
```

---

### Task 2: Apply route ordering + explanation in chat crawl draft

**Files:**
- Modify: `utils/ai/chat-crawl-draft.ts`
- Test: `utils/ai/__tests__/chat-crawl-draft.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { buildChatCrawlDraft } from "@/utils/ai/chat-crawl-draft"

describe("buildChatCrawlDraft rationale", () => {
    it("adds a rationale and orders items", () => {
        const draft = buildChatCrawlDraft(
            [
                {
                    toolName: "query_cafes",
                    params: { city: "Cebu" },
                    result: {
                        cafes: [
                            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854 },
                            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820 },
                        ],
                    },
                },
            ],
            "Build me a crawl in Cebu"
        )

        expect(draft?.description).toBeTruthy()
        expect(draft?.items[0].sortOrder).toBe(0)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: FAIL (no rationale).

**Step 3: Write minimal implementation**

Update `utils/ai/chat-crawl-draft.ts` to use `buildRoutePlan`:

```ts
import { buildRoutePlan } from "@/utils/crawls/route-planner"

const plan = buildRoutePlan(items)
return {
    title: buildTitle(params as Record<string, unknown>),
    description: plan.reason,
    isPublic: false,
    items: plan.ordered.map((item, index) => ({ ...item, sortOrder: index })),
}
```

Also include a short explanation in the AI chat response: ensure the final assistant message includes the rationale text, e.g. “Route rationale: ...”.

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
```

---

### Task 3: Close chat on Save Crawl

**Files:**
- Create: `utils/chat-events.ts`
- Modify: `components/chat/ChatCrawlPreview.tsx`
- Modify: `components/chat/ChatWindow.tsx`

**Step 1: Write minimal event emitter**

Create `utils/chat-events.ts`:

```ts
export type ChatEvent = "close"

const listeners = new Set<(event: ChatEvent) => void>()

export function subscribeChatEvents(listener: (event: ChatEvent) => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function emitChatEvent(event: ChatEvent) {
    for (const listener of listeners) listener(event)
}
```

**Step 2: Emit close event in Save Crawl**

Update `ChatCrawlPreview.tsx`:

```ts
import { emitChatEvent } from "@/utils/chat-events"

const handleSave = () => {
    saveChatCrawlDraft({ ...draft, isPublic: false })
    emitChatEvent("close")
    router.push("/community/crawls/create?draft=chat")
}
```

**Step 3: Listen in ChatWindow**

Update `ChatWindow.tsx`:

```ts
import { subscribeChatEvents } from "@/utils/chat-events"

useEffect(() => {
    return subscribeChatEvents((event) => {
        if (event === "close") onClose()
    })
}, [onClose])
```

**Step 4: Commit**

```bash
```

---

### Task 4: Compact markdown styling for chat

**Files:**
- Modify: `components/ui/MarkdownRender.tsx`
- Modify: `components/chat/ChatMessage.tsx`

**Step 1: Add compact mode to MarkdownRender**

Update `MarkdownRender.tsx`:

```ts
export default function MarkdownRender({ content, compact = false }: { content: string; compact?: boolean }) {
    const base = `w-full h-max ...`
    const compactClasses = compact
        ? `[&_h1]:text-lg [&_h2]:text-base ...`
        : ``

    return (
        <div className={`${base} ${compact ? compactClasses : ""}`}>
            <Markdown>{content}</Markdown>
        </div>
    )
}
```

Use smaller heading sizes, less padding/margins, and project color tokens (primary/text/background).

**Step 2: Use compact mode in ChatMessage**

Update `ChatMessage.tsx`:

```tsx
<MarkdownRender content={message.content} compact />
```

**Step 3: Commit**

```bash
```

---

### Task 5: Manual QA

**Checklist:**
- Ask “Build me a crawl for Cebu” → crawl stops are ordered and the explanation appears in chat + in description
- Crawl preview shows the explanation in the description
- Save Crawl closes the chat and navigates to create page
- “What cafes are near me?” markdown is compact and readable in the chat window

---

Plan complete and saved to `docs/plans/2026-02-22-chat-crawl-quality-and-ui.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
