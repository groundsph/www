# AI Chat Crawl Routing + Agent Powers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver crawl routing that uses a TSP solver with OSRM walking distances and open-hours scheduling, plus a chat agent that can ask for missing context, consume runtime UI/navigation context, and answer Grounds.Ph product questions.

**Architecture:** Add an OSRM table client to produce walking distance matrices, solve TSP (exact for <= 10 stops) and schedule visits against operating hours. Convert chat crawl drafting to async planning (with OSRM + hours) and inject planned visit notes. Introduce a typed chat context pipeline (client -> API -> LLM) and a “Grounds info” tool to answer product questions.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Bun test runner, Zod, Drizzle ORM, OSRM public APIs.

---

## Preflight (do once)
- Per request: no separate worktree; use current workspace.
- Run `bun install` if needed.
- Optional baseline: `bun lint`.
- If tests fail, follow @systematic-debugging.
- Before declaring complete, use @verification-before-completion.

---

### Task 1: Add OSRM table URL helper

**Files:**
- Modify: `utils/map/osrm.ts`
- Test: `utils/__tests__/osrm.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { buildOsrmTableUrl } from "@/utils/map/osrm"

describe("buildOsrmTableUrl", () => {
    it("builds a foot profile table URL with annotations", () => {
        const url = buildOsrmTableUrl(
            [
                { lat: 10.3157, lng: 123.8854 },
                { lat: 10.3170, lng: 123.8820 },
            ],
            "foot",
            "duration"
        )
        expect(url).toContain("/table/v1/foot/")
        expect(url).toContain("annotations=duration")
        expect(url).toContain("123.8854,10.3157;123.882,10.317")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/osrm.test.ts`
Expected: FAIL (buildOsrmTableUrl missing).

**Step 3: Write minimal implementation**

Update `utils/map/osrm.ts`:

```ts
export type OsrmProfile = "driving" | "foot"
export type OsrmTableAnnotation = "duration" | "distance"

function formatCoords(points: { lat: number; lng: number }[]) {
    return points.map((p) => `${p.lng},${p.lat}`).join(";")
}

export function buildOsrmTableUrl(
    points: { lat: number; lng: number }[],
    profile: OsrmProfile = "foot",
    annotations: OsrmTableAnnotation = "duration"
) {
    const coords = formatCoords(points)
    return `https://router.project-osrm.org/table/v1/${profile}/${coords}?annotations=${annotations}`
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/osrm.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/map/osrm.ts utils/__tests__/osrm.test.ts
git commit -m "feat: add osrm table url helper"
```

---

### Task 2: Implement a small exact TSP solver

**Files:**
- Create: `utils/crawls/tsp-solver.ts`
- Test: `utils/__tests__/tsp-solver.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { solveTspExact } from "@/utils/crawls/tsp-solver"

describe("solveTspExact", () => {
    it("returns a shortest route order", () => {
        const matrix = [
            [0, 2, 9, 10],
            [1, 0, 6, 4],
            [15, 7, 0, 8],
            [6, 3, 12, 0],
        ]
        const order = solveTspExact(matrix, 0)
        expect(order[0]).toBe(0)
        expect(order.length).toBe(4)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/tsp-solver.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `utils/crawls/tsp-solver.ts`:

```ts
export function solveTspExact(matrix: number[][], startIndex = 0): number[] {
    const n = matrix.length
    if (n <= 1) return [0]

    const fullMask = (1 << n) - 1
    const dp = new Map<string, { cost: number; prev: number }>()

    for (let i = 0; i < n; i++) {
        if (i === startIndex) continue
        const mask = (1 << startIndex) | (1 << i)
        dp.set(`${mask}:${i}`, { cost: matrix[startIndex][i], prev: startIndex })
    }

    for (let mask = 0; mask <= fullMask; mask++) {
        if ((mask & (1 << startIndex)) === 0) continue
        for (let last = 0; last < n; last++) {
            if (last === startIndex || (mask & (1 << last)) === 0) continue
            const entry = dp.get(`${mask}:${last}`)
            if (!entry) continue
            for (let next = 0; next < n; next++) {
                if (mask & (1 << next)) continue
                const nextMask = mask | (1 << next)
                const nextCost = entry.cost + matrix[last][next]
                const key = `${nextMask}:${next}`
                const existing = dp.get(key)
                if (!existing || nextCost < existing.cost) {
                    dp.set(key, { cost: nextCost, prev: last })
                }
            }
        }
    }

    let bestLast = startIndex
    let bestCost = Number.POSITIVE_INFINITY
    for (let last = 0; last < n; last++) {
        if (last === startIndex) continue
        const entry = dp.get(`${fullMask}:${last}`)
        if (entry && entry.cost < bestCost) {
            bestCost = entry.cost
            bestLast = last
        }
    }

    const order = [bestLast]
    let mask = fullMask
    let last = bestLast
    while (last !== startIndex) {
        const entry = dp.get(`${mask}:${last}`)
        if (!entry) break
        order.push(entry.prev)
        mask = mask & ~(1 << last)
        last = entry.prev
    }
    return order.reverse()
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/tsp-solver.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/crawls/tsp-solver.ts utils/__tests__/tsp-solver.test.ts
git commit -m "feat: add exact tsp solver"
```

---

### Task 3: Add opening-hours scheduling utilities

**Files:**
- Create: `utils/crawls/opening-hours.ts`
- Test: `utils/__tests__/opening-hours.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { isOpenAt, nextOpenWindow } from "@/utils/crawls/opening-hours"
import type { OperatingHours } from "@/utils/types/cafe"

describe("opening hours", () => {
    const hours: OperatingHours = [
        { day: "mon", open: "08:00", close: "18:00", is_24_hours: false },
        { day: "tue", open: "08:00", close: "18:00", is_24_hours: false },
    ]

    it("checks open state for a given day/time", () => {
        expect(isOpenAt(hours, "mon", "09:30")).toBe(true)
        expect(isOpenAt(hours, "mon", "19:00")).toBe(false)
    })

    it("finds the next open window", () => {
        const window = nextOpenWindow(hours, "mon", "19:00")
        expect(window?.day).toBe("tue")
        expect(window?.open).toBe("08:00")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/opening-hours.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `utils/crawls/opening-hours.ts`:

```ts
import type { OperatingHours, OperatingHour } from "@/utils/types/cafe"

const DAYS: OperatingHour["day"][] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

function toMinutes(time: string) {
    const [h, m] = time.split(":").map(Number)
    return h * 60 + m
}

export function isOpenAt(hours: OperatingHours, day: OperatingHour["day"], time: string): boolean {
    const entry = hours.find((h) => h.day === day)
    if (!entry || entry.is_closed) return false
    if (entry.is_24_hours) return true
    const open = toMinutes(entry.open)
    const close = toMinutes(entry.close)
    const t = toMinutes(time)
    if (close < open) {
        return t >= open || t < close
    }
    return t >= open && t < close
}

export function nextOpenWindow(
    hours: OperatingHours,
    day: OperatingHour["day"],
    time: string
): OperatingHour | null {
    const startIndex = DAYS.indexOf(day)
    for (let i = 0; i < DAYS.length; i++) {
        const idx = (startIndex + i) % DAYS.length
        const entry = hours.find((h) => h.day === DAYS[idx] && !h.is_closed)
        if (!entry) continue
        if (i === 0 && isOpenAt(hours, day, time)) return entry
        if (i > 0) return entry
    }
    return null
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/opening-hours.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/crawls/opening-hours.ts utils/__tests__/opening-hours.test.ts
git commit -m "feat: add opening hours helpers"
```

---

### Task 4: Expand cafe query results with operating hours

**Files:**
- Modify: `utils/ai/tools/cafe-query-runner.ts`
- Test: `utils/ai/__tests__/chat-crawl-draft.test.ts`

**Step 1: Write the failing test**

Update `utils/ai/__tests__/chat-crawl-draft.test.ts` to expect `operatingHours` to be used for scheduling (new test added in Task 6). No code change here yet.

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: FAIL (draft scheduling missing).

**Step 3: Write minimal implementation**

Update `utils/ai/tools/cafe-query-runner.ts`:

```ts
export interface CafeResult {
    // ...existing fields
    operatingHours: { day: string; open: string; close: string; is_24_hours: boolean; is_closed?: boolean }[] | null
}

// In select:
operatingHours: cafes.operatingHours,
```

**Step 4: Run test to verify it still fails (expected until Task 6)**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: FAIL.

**Step 5: Commit**

```bash
git add utils/ai/tools/cafe-query-runner.ts
git commit -m "feat: include operating hours in cafe query results"
```

---

### Task 5: Make route planner OSRM + TSP + hours aware (async)

**Files:**
- Modify: `utils/crawls/route-planner.ts`
- Test: `utils/__tests__/route-planner.test.ts`

**Step 1: Write the failing test**

Update `utils/__tests__/route-planner.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { buildRoutePlan } from "@/utils/crawls/route-planner"

describe("buildRoutePlan", () => {
    it("returns an OSRM-based order and visit notes", async () => {
        const cafes = [
            { id: "1", name: "A", slug: "a", lat: 10.3157, lng: 123.8854, operatingHours: [] },
            { id: "2", name: "B", slug: "b", lat: 10.3170, lng: 123.8820, operatingHours: [] },
        ]

        const plan = await buildRoutePlan(cafes, {
            startDay: "mon",
            startTime: "09:00",
            travelMode: "foot",
        })

        expect(plan.ordered.length).toBe(2)
        expect(plan.reason).toContain("walking")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/route-planner.test.ts`
Expected: FAIL (buildRoutePlan is sync and missing new features).

**Step 3: Write minimal implementation**

Update `utils/crawls/route-planner.ts`:

```ts
import { buildOsrmTableUrl } from "@/utils/map/osrm"
import { solveTspExact } from "@/utils/crawls/tsp-solver"
import { isOpenAt, nextOpenWindow } from "@/utils/crawls/opening-hours"
import type { OperatingHours } from "@/utils/types/cafe"

interface RouteCafe {
    id: string
    name: string
    slug: string
    lat: number | null
    lng: number | null
    operatingHours?: OperatingHours | null
}

interface RoutePlanOptions {
    startDay: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
    startTime: string
    travelMode?: "foot" | "driving"
    dwellMinutes?: number
}

export async function buildRoutePlan(cafes: RouteCafe[], options: RoutePlanOptions) {
    // 1) Build OSRM distance matrix (foot by default)
    // 2) Solve TSP exact for <= 10 nodes, fallback to centroid+nearest neighbor
    // 3) Build schedule notes using operating hours and options
    // 4) Return ordered cafes + rationale
}
```

Implementation notes:
- Use OSRM table `annotations=duration` and treat durations (seconds) -> minutes.
- Cap to 10 stops for exact TSP; fallback to nearest-neighbor for more.
- If OSRM fails, fallback to centroid+nearest-neighbor using Euclidean distance.
- Schedule: start at `startDay/startTime`, add travel minutes + `dwellMinutes` (default 45). If a stop is closed at arrival, try to shift to the next open window; if no window, set a note like “Closed at planned time” and keep order (do not drop stop).

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/route-planner.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/crawls/route-planner.ts utils/__tests__/route-planner.test.ts
git commit -m "feat: add osrm + tsp route planner"
```

---

### Task 6: Update chat crawl draft builder to use async route planning

**Files:**
- Modify: `utils/ai/chat-crawl-draft.ts`
- Modify: `utils/ai/chat-stream.ts`
- Modify: `utils/ai/chat-tools.ts`
- Test: `utils/ai/__tests__/chat-crawl-draft.test.ts`

**Step 1: Write the failing test**

Update `utils/ai/__tests__/chat-crawl-draft.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { buildChatCrawlDraft } from "@/utils/ai/chat-crawl-draft"

describe("buildChatCrawlDraft", () => {
    it("adds visit notes when hours are present", async () => {
        const draft = await buildChatCrawlDraft(
            [
                {
                    toolName: "query_cafes",
                    params: { city: "Cebu" },
                    result: {
                        cafes: [
                            {
                                id: "1",
                                name: "A",
                                slug: "a",
                                lat: 10.3157,
                                lng: 123.8854,
                                operatingHours: [
                                    { day: "mon", open: "08:00", close: "18:00", is_24_hours: false },
                                ],
                            },
                        ],
                    },
                },
            ],
            "Build me a crawl in Cebu on Monday at 9am"
        )

        expect(draft?.items[0].note).toContain("Visit")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: FAIL (buildChatCrawlDraft is sync and no notes).

**Step 3: Write minimal implementation**

Update `utils/ai/chat-crawl-draft.ts`:

```ts
import { buildRoutePlan } from "@/utils/crawls/route-planner"
import { parseCrawlTimePreferences } from "@/utils/ai/parse-crawl-time"

export async function buildChatCrawlDraft(
    records: ToolCallRecord[],
    message: string
): Promise<ChatCrawlDraft | null> {
    // ...find cafes
    const prefs = parseCrawlTimePreferences(message)
    const plan = await buildRoutePlan(routeCafes, {
        startDay: prefs.day,
        startTime: prefs.time,
        travelMode: "foot",
    })
    // map cafes by id to preserve thumbnails and metadata after reordering
    // set item.note from plan.schedule
}
```

Update call sites in `utils/ai/chat-stream.ts` and `utils/ai/chat-tools.ts` to `await buildChatCrawlDraft(...)`.

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/ai/chat-crawl-draft.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/chat-crawl-draft.test.ts
git commit -m "feat: make chat crawl draft async with scheduling"
```

---

### Task 7: Add crawl time parsing helpers

**Files:**
- Create: `utils/ai/parse-crawl-time.ts`
- Test: `utils/ai/__tests__/parse-crawl-time.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { parseCrawlTimePreferences } from "@/utils/ai/parse-crawl-time"

describe("parseCrawlTimePreferences", () => {
    it("extracts day and time", () => {
        const result = parseCrawlTimePreferences("Build a crawl on Saturday at 9:30am")
        expect(result.day).toBe("sat")
        expect(result.time).toBe("09:30")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/parse-crawl-time.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `utils/ai/parse-crawl-time.ts`:

```ts
const DAY_MAP: Record<string, "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"> = {
    sunday: "sun",
    sun: "sun",
    monday: "mon",
    mon: "mon",
    tuesday: "tue",
    tue: "tue",
    wednesday: "wed",
    wed: "wed",
    thursday: "thu",
    thu: "thu",
    friday: "fri",
    fri: "fri",
    saturday: "sat",
    sat: "sat",
}

export function parseCrawlTimePreferences(text: string) {
    const lower = text.toLowerCase()
    const dayMatch = Object.keys(DAY_MAP).find((d) => lower.includes(d))
    const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
    const day = dayMatch ? DAY_MAP[dayMatch] : "sat"
    let time = "09:00"
    if (timeMatch) {
        const h = Number(timeMatch[1]) % 12
        const m = Number(timeMatch[2] ?? "00")
        const isPm = timeMatch[3] === "pm"
        const hh = String(h + (isPm ? 12 : 0)).padStart(2, "0")
        const mm = String(m).padStart(2, "0")
        time = `${hh}:${mm}`
    }
    return { day, time }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/parse-crawl-time.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/ai/parse-crawl-time.ts utils/ai/__tests__/parse-crawl-time.test.ts
git commit -m "feat: add crawl time parser"
```

---

### Task 8: Add chat context types and request schema

**Files:**
- Modify: `utils/types/chat.ts`
- Modify: `app/api/chat/stream/route.ts`
- Test: `utils/__tests__/chat-types.test.ts`

**Step 1: Write the failing test**

Update `utils/__tests__/chat-types.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { chatRequestSchema } from "@/utils/types/chat"

describe("chat request schema", () => {
    it("accepts optional context", () => {
        const parsed = chatRequestSchema.parse({
            message: "hello",
            sessionId: "session-12345",
            context: { pathname: "/cafes/demo" },
        })
        expect(parsed.context?.pathname).toBe("/cafes/demo")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/chat-types.test.ts`
Expected: FAIL (context missing).

**Step 3: Write minimal implementation**

Update `utils/types/chat.ts`:

```ts
export const chatContextSchema = z.object({
    pathname: z.string().optional(),
    pageTitle: z.string().optional(),
    cafeSlug: z.string().optional(),
    crawlSlug: z.string().optional(),
    location: z.object({
        lat: z.number().optional(),
        lng: z.number().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        isEstimate: z.boolean().optional(),
    }).optional(),
    navigationHistory: z.array(z.string()).optional(),
    uiContext: z.record(z.unknown()).optional(),
    recentCafes: z.array(chatCafeCardSchema).optional(),
    recentToolCalls: z.array(z.object({
        toolName: z.string(),
        params: z.unknown(),
        result: z.unknown(),
    })).optional(),
})

export const chatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().min(8),
    context: chatContextSchema.optional(),
})

export type ChatContext = z.infer<typeof chatContextSchema>
```

Update `app/api/chat/stream/route.ts` request schema to allow `context` and pass through to `runChatStream` options.

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/chat-types.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/types/chat.ts app/api/chat/stream/route.ts utils/__tests__/chat-types.test.ts
git commit -m "feat: add chat context schema"
```

---

### Task 9: Track recent chat results for in-window reuse

**Files:**
- Modify: `components/chat/ChatWindow.tsx`
- Modify: `utils/chat-context.ts`
- Test: `components/chat/__tests__/chat-window-location.test.tsx`

**Step 1: Add in-memory recent results (not persisted)**

Update `components/chat/ChatWindow.tsx` to keep `recentCafes` and `recentToolCalls` in component state. Do not save these to sessionStorage/localStorage.

```ts
const [recentCafes, setRecentCafes] = useState<ChatCafeCard[]>([])
const [recentToolCalls, setRecentToolCalls] = useState<
    { toolName: string; params: unknown; result: unknown }[]
>([])
```

Update stream handling to capture new cafes and append tool calls if needed.

**Step 2: Expose to chat context store**

Update `utils/chat-context.ts` to accept partial updates from ChatWindow for `recentCafes` and `recentToolCalls` (still memory-only).

**Step 3: Send recent context with requests**

Update `components/chat/ChatWindow.tsx` request body:

```ts
body: JSON.stringify({ message, context: { ...getChatContext(), recentCafes, recentToolCalls } })
```

**Step 4: Test adjustment**

Update `components/chat/__tests__/chat-window-location.test.tsx` to assert the request payload includes `context.recentCafes` when cafes are available.

**Step 5: Commit**

```bash
git add components/chat/ChatWindow.tsx utils/chat-context.ts components/chat/__tests__/chat-window-location.test.tsx
git commit -m "feat: include recent chat results in context"
```

---

### Task 10: Use recent chat context to avoid redundant tool calls

**Files:**
- Modify: `utils/ai/chat-stream.ts`
- Modify: `utils/ai/chat-tools.ts`
- Test: `utils/ai/__tests__/chat-crawl-draft.test.ts`

**Step 1: Write the failing test**

Add a test in `utils/ai/__tests__/chat-crawl-draft.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { buildChatCrawlDraft } from "@/utils/ai/chat-crawl-draft"

describe("chat crawl from recent cafes", () => {
    it("builds a crawl from recent cafes without new tool calls", async () => {
        const recent = [
            { id: "1", slug: "a", title: "Cafe A", coverImageUrl: null, city: "Cebu" },
            { id: "2", slug: "b", title: "Cafe B", coverImageUrl: null, city: "Cebu" },
        ]
        const draft = await buildChatCrawlDraft(
            [],
            "Make a crawl from those",
            { recentCafes: recent }
        )
        expect(draft?.items.length).toBe(2)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: FAIL (no context parameter).

**Step 3: Write minimal implementation**

Update `utils/ai/chat-crawl-draft.ts` signature to accept optional `context` and prefer `context.recentCafes` when crawl intent is present. Map `ChatCafeCard` into the same route planning pipeline.

Update `utils/ai/chat-stream.ts` and `utils/ai/chat-tools.ts` to:
- Accept `context` on input.
- Seed `toolCallRecords` with `context.recentToolCalls` for reuse.
- If crawl intent is present and `context.recentCafes` exists, skip new tool calls and build crawl from context.
- Add prompt guidance: “If the user refers to the previous list, use recent context rather than calling tools again.”

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/chat-crawl-draft.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/ai/chat-crawl-draft.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/chat-crawl-draft.test.ts
git commit -m "feat: reuse recent chat results for crawl creation"
```

---

### Task 11: Add client-side chat context store + sender

**Files:**
- Create: `utils/chat-context.ts`
- Create: `hooks/useChatContext.ts`
- Modify: `components/chat/ChatWindow.tsx`
- Modify: `components/layout/LayoutWrapper.tsx`

**Step 1: Write minimal context store**

Create `utils/chat-context.ts`:

```ts
import type { ChatContext } from "@/utils/types/chat"

let current: ChatContext = {}
const listeners = new Set<(ctx: ChatContext) => void>()

export function setChatContext(next: ChatContext) {
    current = { ...current, ...next }
    for (const l of listeners) l(current)
}

export function getChatContext() {
    return current
}

export function subscribeChatContext(listener: (ctx: ChatContext) => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}
```

**Step 2: Add hook for components**

Create `hooks/useChatContext.ts`:

```ts
import { useEffect } from "react"
import type { ChatContext } from "@/utils/types/chat"
import { setChatContext } from "@/utils/chat-context"

export function useChatContext(ctx: ChatContext) {
    useEffect(() => {
        setChatContext(ctx)
    }, [ctx])
}
```

**Step 3: Wire context into ChatWindow**

Update `components/chat/ChatWindow.tsx` to import `getChatContext()` and include it in the request body:

```ts
const context = getChatContext()

body: JSON.stringify({ message, context })
```

Also add `pathname` and `document.title` as defaults if not already in store.

**Step 4: Track navigation context**

Update `components/layout/LayoutWrapper.tsx`:

```ts
useEffect(() => {
    setChatContext({ pathname, pageTitle: document.title })
}, [pathname])
```

**Step 5: Commit**

```bash
git add utils/chat-context.ts hooks/useChatContext.ts components/chat/ChatWindow.tsx components/layout/LayoutWrapper.tsx
git commit -m "feat: add client chat context store"
```

---

### Task 12: Inject UI context from crawl pages

**Files:**
- Modify: `components/crawls/CrawlEditor.tsx`
- Modify: `components/crawls/CrawlView.tsx`

**Step 1: Update CrawlEditor to publish context**

In `components/crawls/CrawlEditor.tsx`:

```ts
import { useChatContext } from "@/hooks/useChatContext"

useChatContext({
    uiContext: {
        pageType: "crawl_editor",
        crawlTitle: title,
        itemCount: items.length,
        items: items.map((i) => ({ name: i.name, slug: i.slug })),
    },
})
```

**Step 2: Update CrawlView to publish context**

In `components/crawls/CrawlView.tsx`:

```ts
import { useChatContext } from "@/hooks/useChatContext"

useChatContext({
    crawlSlug: crawl.slug,
    uiContext: {
        pageType: "crawl_view",
        crawlTitle: crawl.title,
        itemCount: crawl.cafes.length,
    },
})
```

**Step 3: Commit**

```bash
git add components/crawls/CrawlEditor.tsx components/crawls/CrawlView.tsx
git commit -m "feat: publish crawl ui context to chat"
```

---

### Task 13: Add Grounds info tool + prompt updates

**Files:**
- Create: `utils/ai/grounds-info.ts`
- Modify: `utils/ai/chat-stream.ts`
- Modify: `utils/ai/chat-tools.ts`
- Test: `utils/ai/__tests__/chat-tools.test.ts`

**Step 1: Write the failing test**

Update `utils/ai/__tests__/chat-tools.test.ts` to assert `get_grounds_info` is available.

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-tools.test.ts`
Expected: FAIL (tool missing).

**Step 3: Write minimal implementation**

Create `utils/ai/grounds-info.ts`:

```ts
export function getGroundsInfo() {
    return {
        platform: "Grounds.ph",
        focus: "Philippines coffee discovery",
        features: ["Cafe listings", "Crawl routes", "Community posts", "Maps"],
        notes: ["Data is community maintained", "Some details may be user-submitted"],
    }
}
```

Update `chat-stream.ts` and `chat-tools.ts` to add tool definition and `executeTool` case:

```ts
name: "get_grounds_info",
description: "Return general information about Grounds.ph features and how to use the platform",
parameters: { type: "object", properties: {} },
```

Prompt update: add a rule to use `get_grounds_info` for platform questions; add “Ask clarifying questions if day/time or start location is missing for crawl requests.”

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/chat-tools.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/ai/grounds-info.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/chat-tools.test.ts
git commit -m "feat: add grounds info tool"
```

---

### Task 14: Switch crawl map routing to walking

**Files:**
- Modify: `components/map/CrawlRouteMapInternal.tsx`

**Step 1: Update OSRM profile**

Change `buildOsrmUrl(start, end, "driving")` to `buildOsrmUrl(start, end, "foot")` and optionally add a prop to allow future profile toggles.

**Step 2: Manual check**

Run the app (`bun dev`) and open a crawl map. Confirm the route lines follow walking paths.

**Step 3: Commit**

```bash
git add components/map/CrawlRouteMapInternal.tsx
git commit -m "feat: use osrm walking profile for crawl routes"
```

---

### Task 15: Manual QA checklist

**Checklist:**
- Ask: “Build a crawl in Cebu on Saturday at 9am” → chat returns crawl draft with planned visit notes that align with open hours.
- Ask: “Build me a crawl in Cebu” → assistant asks for day/time before building.
- Save Crawl from chat → draft opens in editor with notes preserved.
- Crawl map uses walking routes (foot profile).
- Chat can answer “What is Grounds.ph?” using `get_grounds_info` tool.
- Ask: “What cafes are nearby?” then “Make a crawl from those” → no new nearby tool call, uses previous list.

---

## Improvements & Suggestions
- Add OSRM response caching (memory + optional DB) to reduce public API calls and improve performance.
- Provide a UI selector for crawl start time/day and walking vs driving to avoid repeated clarifications.
- Add a time-window badge UI in CrawlEditor for planned arrival times.
- Allow user to cap total crawl duration (e.g., 3 hours) and trim stops automatically.
- Consider a background job to precompute crawl routes for popular cities.

---

Plan complete and saved to `docs/plans/2026-02-23-ai-chat-crawl-routing-agent-powers.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
