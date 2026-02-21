# AI Chat Module + Roadmap Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Return structured cafe card data from AI chat responses, render activity-feed style horizontal cards with filters/flags, fix location usage for near-me queries, and update the roadmap to show AI Chat in progress.

**Architecture:** Use tool-call results to build typed `ChatCafeCard` arrays plus a `ChatCardContext` summary (including a custom label for query-specific rendering). The server action returns these fields alongside the text response. The chat UI renders cards using Activity Feed styling with scroll snapping and shows filter/flag chips derived from card data. Location queries wait for or reuse `useUserLocation` data before sending the prompt. Roadmap copy is updated in the page module and covered by a lightweight render test.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Bun test runner, Zod, motion/react, Drizzle ORM.

---

## Preflight (do once)
- Per request: no separate worktree; use current workspace.
- Run `bun install` if needed.
- Optional baseline: `bun lint`.

---

### Task 1: Add chat card types + response schema

**Files:**
- Modify: `utils/types/chat.ts`
- Modify: `app/api/actions/chat.ts`
- Test: `utils/__tests__/chat-types.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test"
import { chatResponseSchema } from "@/utils/types/chat"

describe("chat response schema", () => {
    it("accepts cafe cards and card context", () => {
        const res = {
            success: true,
            remaining: 9,
            cafes: [
                {
                    id: "c1",
                    slug: "demo-cafe",
                    title: "Demo Cafe",
                    coverImageUrl: "https://cdn.example.com/demo.jpg",
                    city: "Manila",
                    province: "Metro Manila",
                    rating: 4.6,
                    reviewCount: 120,
                    filters: ["WiFi", "Sockets"],
                    flags: ["Halal"],
                    custom: "Near you",
                },
            ],
            cardContext: {
                queryType: "nearby",
                title: "Near you",
                subtitle: "Based on your location",
                custom: "Near you",
            },
        }
        const parsed = chatResponseSchema.parse(res)
        expect(parsed.cafes?.length).toBe(1)
        expect(parsed.cardContext?.queryType).toBe("nearby")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/chat-types.test.ts`
Expected: FAIL (schema missing cafes/cardContext).

**Step 3: Write minimal implementation**

Update `utils/types/chat.ts`:

```ts
export const chatCafeCardSchema = z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    coverImageUrl: z.string().url().nullable(),
    city: z.string().nullable().optional(),
    province: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    reviewCount: z.number().nullable().optional(),
    filters: z.array(z.string()).optional(),
    flags: z.array(z.string()).optional(),
    custom: z.string().optional(),
})

export const chatCardContextSchema = z.object({
    queryType: z.enum(["search", "nearby", "top_rated", "details", "compare", "unknown"]),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    custom: z.string().optional(),
    filters: z.array(z.string()).optional(),
})

export const chatResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    remaining: z.number().int().min(0),
    error: z.string().optional(),
    data: z.unknown().optional(),
    cafes: z.array(chatCafeCardSchema).optional(),
    cardContext: chatCardContextSchema.optional(),
})

export type ChatCafeCard = z.infer<typeof chatCafeCardSchema>
export type ChatCardContext = z.infer<typeof chatCardContextSchema>
```

Update `app/api/actions/chat.ts` to include the new fields in the return type:

```ts
import type { ChatCafeCard, ChatCardContext } from "@/utils/types/chat"

export interface SendChatMessageResult {
    success: boolean
    message?: string
    remaining: number
    error?: string
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/chat-types.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/types/chat.ts app/api/actions/chat.ts utils/__tests__/chat-types.test.ts
git commit -m "feat: add chat cafe card response types"
```

---

### Task 2: Build chat cafe card mapper + context builder

**Files:**
- Create: `utils/ai/chat-cafe-cards.ts`
- Test: `utils/ai/__tests__/chat-cafe-cards.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "bun:test"
import { buildChatCafeCards } from "@/utils/ai/chat-cafe-cards"

describe("buildChatCafeCards", () => {
    it("maps query_cafes results to cards with context", () => {
        const result = buildChatCafeCards([
            {
                toolName: "query_cafes",
                params: { city: "Cebu" },
                result: {
                    cafes: [
                        {
                            id: "1",
                            name: "Cafe Uno",
                            slug: "cafe-uno",
                            thumbnail: "uno.jpg",
                            cityMunicipality: "Cebu City",
                            province: "Cebu",
                            rating: 4.4,
                            totalReviews: 14,
                            hasWifi: true,
                            hasSockets: true,
                            isHalalCertified: false,
                        },
                    ],
                },
            },
        ])

        expect(result.cafes.length).toBe(1)
        expect(result.cafes[0].title).toBe("Cafe Uno")
        expect(result.cardContext?.title).toBe("Cebu")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-cafe-cards.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `utils/ai/chat-cafe-cards.ts`:

```ts
import type { ChatCafeCard, ChatCardContext } from "@/utils/types/chat"
import type { ToolCallRecord } from "@/utils/ai/chat-tools"

type CardResult = { cafes: ChatCafeCard[]; cardContext?: ChatCardContext }

function buildFilters(cafe: Record<string, unknown>): string[] {
    const filters: string[] = []
    if (cafe.hasWifi) filters.push("WiFi")
    if (cafe.hasSockets) filters.push("Sockets")
    if (cafe.isWorkFriendly) filters.push("Work-friendly")
    if (cafe.isPetFriendly) filters.push("Pet-friendly")
    if (cafe.servesFood) filters.push("Food")
    if (cafe.hasOutdoorSeating) filters.push("Outdoor")
    return filters
}

function buildFlags(cafe: Record<string, unknown>): string[] {
    const flags: string[] = []
    if (cafe.isHalalCertified) flags.push("Halal")
    return flags
}

function buildContext(toolName: string, params: Record<string, unknown>): ChatCardContext {
    if (toolName === "get_nearby_cafes") {
        return {
            queryType: "nearby",
            title: "Near you",
            subtitle: "Based on your location",
            custom: "Near you",
        }
    }
    if (toolName === "get_top_rated") {
        return {
            queryType: "top_rated",
            title: typeof params.city === "string" ? params.city : "Top rated",
            subtitle: "Top rated cafes",
            custom: "Top rated",
        }
    }
    if (toolName === "query_cafes") {
        const label =
            (typeof params.city === "string" && params.city) ||
            (typeof params.province === "string" && params.province) ||
            (typeof params.region === "string" && params.region) ||
            "Search results"
        return {
            queryType: "search",
            title: label,
            subtitle: "Matching cafes",
            custom: label,
        }
    }
    return { queryType: "unknown" }
}

function toCard(cafe: Record<string, unknown>, custom?: string): ChatCafeCard {
    return {
        id: String(cafe.id ?? ""),
        slug: String(cafe.slug ?? ""),
        title: String(cafe.name ?? cafe.title ?? ""),
        coverImageUrl: typeof cafe.thumbnail === "string" ? cafe.thumbnail : null,
        city: typeof cafe.cityMunicipality === "string" ? cafe.cityMunicipality : null,
        province: typeof cafe.province === "string" ? cafe.province : null,
        rating: typeof cafe.rating === "number" ? cafe.rating : null,
        reviewCount: typeof cafe.totalReviews === "number" ? cafe.totalReviews : null,
        filters: buildFilters(cafe),
        flags: buildFlags(cafe),
        custom,
    }
}

export function buildChatCafeCards(records: ToolCallRecord[]): CardResult {
    for (const record of records) {
        if (!record || typeof record !== "object") continue
        const { toolName, params, result } = record
        if (!result || typeof result !== "object") continue

        if (toolName === "query_cafes" && Array.isArray((result as any).cafes)) {
            const context = buildContext(toolName, params as Record<string, unknown>)
            const cafes = (result as any).cafes.map((cafe: Record<string, unknown>) =>
                toCard(cafe, context.custom)
            )
            return { cafes, cardContext: context }
        }

        if ((toolName === "get_nearby_cafes" || toolName === "get_top_rated") && Array.isArray(result)) {
            const context = buildContext(toolName, params as Record<string, unknown>)
            const cafes = (result as any).map((cafe: Record<string, unknown>) => toCard(cafe, context.custom))
            return { cafes, cardContext: context }
        }

        if (toolName === "get_cafe_by_slug" && result) {
            const context = buildContext(toolName, params as Record<string, unknown>)
            return { cafes: [toCard(result as Record<string, unknown>, context.custom)], cardContext: context }
        }

        if (toolName === "compare_cafes" && result && typeof result === "object") {
            const context = buildContext(toolName, params as Record<string, unknown>)
            const cafes = [
                (result as any).cafeA ? toCard((result as any).cafeA, context.custom) : null,
                (result as any).cafeB ? toCard((result as any).cafeB, context.custom) : null,
            ].filter(Boolean) as ChatCafeCard[]
            return { cafes, cardContext: context }
        }
    }

    return { cafes: [] }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/chat-cafe-cards.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/ai/chat-cafe-cards.ts utils/ai/__tests__/chat-cafe-cards.test.ts
git commit -m "feat: map tool results to chat cafe cards"
```

---

### Task 3: Extend cafe query results for card rendering

**Files:**
- Modify: `utils/ai/tools/cafe-query-runner.ts`

**Step 1: Write the failing test**

Use the mapper test from Task 2 to enforce fields in the query result (already failing if fields are missing). No extra test needed.

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-cafe-cards.test.ts`
Expected: FAIL if new fields are not selected.

**Step 3: Write minimal implementation**

Update `utils/ai/tools/cafe-query-runner.ts`:

```ts
export interface CafeResult {
    id: string
    name: string
    slug: string
    thumbnail: string | null
    lat: number | null
    lng: number | null
    cityMunicipality: string
    province: string
    rating: number | null
    totalReviews: number | null
    hasWifi: boolean | null
    hasSockets: boolean | null
    isWorkFriendly: boolean | null
    isPetFriendly: boolean | null
    servesFood: boolean | null
    hasOutdoorSeating: boolean | null
    isHalalCertified: boolean | null
}
```

```ts
let query = db
    .select({
        id: cafes.id,
        name: cafes.name,
        slug: cafes.slug,
        thumbnail: cafes.thumbnail,
        lat: cafes.lat,
        lng: cafes.lng,
        cityMunicipality: cafes.cityMunicipality,
        province: cafes.province,
        rating: cafeRatingStats.averageRating,
        totalReviews: cafeRatingStats.totalReviews,
        hasWifi: cafes.hasWifi,
        hasSockets: cafes.hasSockets,
        isWorkFriendly: cafes.isWorkFriendly,
        isPetFriendly: cafes.isPetFriendly,
        servesFood: cafes.servesFood,
        hasOutdoorSeating: cafes.hasOutdoorSeating,
        isHalalCertified: cafes.isHalalCertified,
    })
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/chat-cafe-cards.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/ai/tools/cafe-query-runner.ts
git commit -m "feat: include card fields in cafe query results"
```

---

### Task 4: Return structured cafe cards from chat tools

**Files:**
- Modify: `utils/ai/chat-tools.ts`
- Modify: `app/api/actions/chat.ts`
- Test: `utils/ai/__tests__/chat-tools.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, mock } from "bun:test"
import { runChatWithTools } from "@/utils/ai/chat-tools"

describe("runChatWithTools cafe cards", () => {
    it("returns cafes when tool calls resolve", async () => {
        const mockFetch = mock(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        choices: [
                            {
                                message: {
                                    content: null,
                                    tool_calls: [
                                        {
                                            id: "call_1",
                                            type: "function",
                                            function: {
                                                name: "list_cities",
                                                arguments: "{}",
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    }),
            } as Response)
        )
        global.fetch = mockFetch

        const result = await runChatWithTools({
            message: "List cities",
            sessionId: "test-cards",
        })
        expect(result.cafes).toBeDefined()
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/chat-tools.test.ts`
Expected: FAIL (cafes missing).

**Step 3: Write minimal implementation**

Update `utils/ai/chat-tools.ts`:

```ts
import { buildChatCafeCards } from "@/utils/ai/chat-cafe-cards"
import type { ChatCafeCard, ChatCardContext } from "@/utils/types/chat"

export interface ChatToolResult {
    message: string
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
    toolCalls?: ToolCallRecord[]
}
```

Add a guard to enforce tool usage on cafe queries (simple keyword check):

```ts
function shouldForceCafeTool(text: string): boolean {
    const query = text.toLowerCase()
    return query.includes("cafe") || query.includes("cafes") || query.includes("near me") || query.includes("nearby")
}
```

After tool execution, build cafes and context:

```ts
const { cafes, cardContext } = buildChatCafeCards(toolCallRecords)
```

Return with cafes/context when sending final response:

```ts
return {
    message: response.content ?? "I don't have a response for that.",
    cafes,
    cardContext,
    toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
}
```

If no tool calls for a cafe query, re-run once with forced `toolChoice`:

```ts
const response = await chatCompletionWithTools(messages, tools, {
    temperature: 0.7,
    maxTokens: 1000,
    timeoutMs: 60000,
    toolChoice: shouldForceCafeTool(message) ? { type: "function", function: { name: "query_cafes" } } : "auto",
})
```

Update `app/api/actions/chat.ts` to forward `cafes` and `cardContext` from `runChatWithTools`:

```ts
return {
    success: true,
    message: result.message,
    remaining: Math.max(0, remainingAfter),
    cafes: result.cafes,
    cardContext: result.cardContext,
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/chat-tools.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/ai/chat-tools.ts app/api/actions/chat.ts utils/ai/__tests__/chat-tools.test.ts
git commit -m "feat: return structured cafe cards from chat"
```

---

### Task 5: Render cafe cards with Activity Feed styling + filter chips

**Files:**
- Modify: `components/chat/ChatCafeCarousel.tsx`
- Modify: `components/chat/ChatMessage.tsx`
- Modify: `components/chat/ChatWindow.tsx`
- Test: `components/chat/__tests__/chat-message-cafe-cards.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "bun:test"
import { render } from "@testing-library/react"
import ChatMessage from "@/components/chat/ChatMessage"

describe("ChatMessage cafe cards", () => {
    it("renders a snapping carousel", () => {
        const { container, getByText } = render(
            <ChatMessage
                message={{
                    id: "msg-1",
                    role: "assistant",
                    content: "Here are cafes",
                    timestamp: new Date(),
                    cafes: [
                        {
                            id: "1",
                            slug: "demo",
                            title: "Demo Cafe",
                            coverImageUrl: null,
                            filters: ["WiFi"],
                            flags: ["Halal"],
                            custom: "Near you",
                        },
                    ],
                }}
            />
        )

        expect(getByText("Demo Cafe")).toBeTruthy()
        expect(container.querySelector(".snap-x")).toBeTruthy()
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/chat/__tests__/chat-message-cafe-cards.test.tsx`
Expected: FAIL (new card type and snap styles missing).

**Step 3: Write minimal implementation**

Update `components/chat/ChatCafeCarousel.tsx` to use the Activity Feed layout and show filter/flag chips:

```tsx
import { Coffee, MapPin, Star } from "lucide-react"
import { getCafeThumbnailUrl } from "@/utils/extras"
import type { ChatCafeCard, ChatCardContext } from "@/utils/types/chat"

interface ChatCafeCarouselProps {
    cafes: ChatCafeCard[]
    cardContext?: ChatCardContext
}

export default function ChatCafeCarousel({ cafes, cardContext }: ChatCafeCarouselProps) {
    if (!cafes.length) return null
    return (
        <div className="mt-3">
            {cardContext?.title && (
                <p className="text-xs text-text/60 mb-2">{cardContext.title}</p>
            )}
            <div className="flex flex-row gap-4 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-2 pb-4 snap-x snap-mandatory scroll-px-4">
                {cafes.map((cafe) => (
                    <a
                        key={cafe.id}
                        href={`/cafes/${cafe.slug}`}
                        className="group shrink-0 w-[320px] max-w-[85svw] bg-text/5 rounded-xl p-4 hover:bg-text/10 transition-colors border border-text/5 hover:border-text/10 snap-start flex flex-col gap-3"
                    >
                        <div className="flex items-center gap-3 bg-background rounded-lg p-2">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-text/5 shrink-0">
                                {cafe.coverImageUrl ? (
                                    <img
                                        src={getCafeThumbnailUrl(cafe.coverImageUrl)}
                                        alt={cafe.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Coffee className="w-6 h-6 text-text opacity-30" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-text group-hover:text-primary transition-colors truncate">
                                    {cafe.title}
                                </h3>
                                {(cafe.city || cafe.province) && (
                                    <p className="flex items-center gap-1 text-xs text-text/60 truncate">
                                        <MapPin className="w-3 h-3" />
                                        {cafe.city ?? cafe.province}
                                    </p>
                                )}
                                {cafe.rating != null && (
                                    <div className="flex items-center gap-1 text-xs text-text/60 mt-1">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        <span>{cafe.rating.toFixed(1)}</span>
                                        {cafe.reviewCount != null && (
                                            <span className="text-text/40">({cafe.reviewCount})</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {(cafe.filters?.length || cafe.flags?.length) && (
                            <div className="flex flex-wrap gap-2">
                                {cafe.flags?.map((flag) => (
                                    <span key={flag} className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
                                        {flag}
                                    </span>
                                ))}
                                {cafe.filters?.slice(0, 3).map((filter) => (
                                    <span key={filter} className="text-xs px-2 py-1 rounded-full bg-text/5 text-text/60">
                                        {filter}
                                    </span>
                                ))}
                            </div>
                        )}
                    </a>
                ))}
            </div>
        </div>
    )
}
```

Update `components/chat/ChatMessage.tsx` and `components/chat/ChatWindow.tsx` to use `ChatCafeCard` and pass `cardContext`:

```ts
import type { ChatCafeCard, ChatCardContext } from "@/utils/types/chat"

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
}
```

```tsx
{message.cafes && message.cafes.length > 0 && (
    <ChatCafeCarousel cafes={message.cafes} cardContext={message.cardContext} />
)}
```

```ts
const assistantMessage: Message = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: result.message,
    timestamp: new Date(),
    cafes: result.cafes,
    cardContext: result.cardContext,
}
```

**Step 4: Run test to verify it passes**

Run: `bun test components/chat/__tests__/chat-message-cafe-cards.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/chat/ChatCafeCarousel.tsx components/chat/ChatMessage.tsx components/chat/ChatWindow.tsx components/chat/__tests__/chat-message-cafe-cards.test.tsx
git commit -m "feat: render chat cafe cards with feed styling"
```

---

### Task 6: Fix location usage for near-me queries

**Files:**
- Modify: `components/chat/ChatWindow.tsx`
- Test: `components/chat/__tests__/chat-window-location.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, mock } from "bun:test"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ChatWindow from "@/components/chat/ChatWindow"

const mockSendChatMessage = mock(() =>
    Promise.resolve({ success: true, message: "ok", remaining: 9 })
)

mock.module("@/app/api/actions/chat", () => ({
    sendChatMessage: mockSendChatMessage,
}))

const mockUseUserLocation = mock(() => ({
    location: { city: "Cebu City", region: "Central Visayas", lat: 10.3157, lng: 123.8854 },
    loading: false,
    error: null,
    permissionState: "granted",
    isEstimate: false,
    source: "gps",
    refresh: mock(() => {}),
}))

mock.module("@/hooks/useUserLocation", () => ({
    useUserLocation: mockUseUserLocation,
}))

describe("ChatWindow location usage", () => {
    it("includes location hint when available", async () => {
        render(<ChatWindow remainingMessages={10} onClose={() => {}} />)
        const input = screen.getByPlaceholderText(
            "Ask about cafes, locations, or recommendations..."
        )
        fireEvent.change(input, { target: { value: "cafes near me" } })
        fireEvent.submit(input.closest("form") as HTMLFormElement)

        await waitFor(() => {
            expect(mockSendChatMessage).toHaveBeenCalled()
        })

        const call = mockSendChatMessage.mock.calls[0][0]
        expect(call.message).toContain("User location")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/chat/__tests__/chat-window-location.test.tsx`
Expected: FAIL (no location hint in message).

**Step 3: Write minimal implementation**

In `components/chat/ChatWindow.tsx`:

- Initialize location fetch on mount by removing `skipInitialFetch: true`.
- For near-me queries, if location is missing or loading, queue the message until location is available or an error is returned.

```ts
const [pendingMessage, setPendingMessage] = useState<Message | null>(null)

const sendWithLocationHint = useCallback(
    async (message: Message) => {
        const locationHint = location.lat && location.lng
            ? `\n\nUser location: ${location.lat}, ${location.lng}. Use get_nearby_cafes.`
            : locationSummary
                ? `\n\nUser location context: ${locationSummary}.`
                : ""
        const result = await sendChatMessage({
            message: `${message.content}${locationHint}`,
        })
        return result
    },
    [location.lat, location.lng, locationSummary]
)

useEffect(() => {
    if (!pendingMessage) return
    if (locationLoading) return
    if (!locationSummary && !location.lat && !location.lng && !locationError) return
    void (async () => {
        const result = await sendWithLocationHint(pendingMessage)
        // existing success/error handling
    })()
    setPendingMessage(null)
}, [pendingMessage, locationLoading, locationSummary, location.lat, location.lng, locationError, sendWithLocationHint])
```

In `handleSubmit`, when near-me and location is missing or loading:

```ts
if (shouldRequestLocation(userMessage.content) && (!locationSummary || locationLoading)) {
    refreshLocation()
    setPendingMessage(userMessage)
    setIsLoading(false)
    return
}
```

**Step 4: Run test to verify it passes**

Run: `bun test components/chat/__tests__/chat-window-location.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/chat/ChatWindow.tsx components/chat/__tests__/chat-window-location.test.tsx
git commit -m "fix: include location hints for near-me chat"
```

---

### Task 7: Update Roadmap page for AI Chat in progress

**Files:**
- Modify: `app/roadmap/page.tsx`
- Test: `app/roadmap/__tests__/roadmap-page.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import RoadmapPage from "@/app/roadmap/page"

test("roadmap shows AI Chat in progress", () => {
    render(<RoadmapPage />)
    expect(screen.getByText("AI Chat")).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/roadmap/__tests__/roadmap-page.test.tsx`
Expected: FAIL (AI Chat not present).

**Step 3: Write minimal implementation**

Update `app/roadmap/page.tsx`:

- Add an "AI Chat" entry to `inProgress`.
- Keep "Continued Cafe Additions" in `inProgress`.
- Move "Proper Social Sharing w/ Previews" and "Dark Mode" to `upNext` (or `exploring`).
- Update metadata description to mention AI Chat in progress.

Example entry:

```ts
{
    title: "AI Chat",
    description: "A conversational cafe concierge with smart recommendations and structured cafe cards.",
    icon: <Sparkles className="w-5 h-5" />,
},
```

**Step 4: Run test to verify it passes**

Run: `bun test app/roadmap/__tests__/roadmap-page.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/roadmap/page.tsx app/roadmap/__tests__/roadmap-page.test.tsx
git commit -m "chore: update roadmap for AI chat"
```

---

### Task 8: Documentation + QA checklist

**Files:**
- Modify: `docs/ai.md`

**Step 1: Write the failing test**

No automated test required; documentation update only.

**Step 2: Run test to verify it fails**

Skip.

**Step 3: Write minimal implementation**

Update `docs/ai.md` with a "Chat Response Structure" section describing:

```json
{
  "success": true,
  "message": "...",
  "remaining": 9,
  "cafes": [
    {
      "id": "...",
      "slug": "...",
      "title": "...",
      "coverImageUrl": "...",
      "filters": ["WiFi"],
      "flags": ["Halal"],
      "custom": "Near you"
    }
  ],
  "cardContext": {
    "queryType": "nearby",
    "title": "Near you",
    "custom": "Near you"
  }
}
```

**Step 4: Run test to verify it passes**

Skip.

**Step 5: Commit**

```bash
git add docs/ai.md
git commit -m "docs: describe chat cafe card payload"
```

---

## Manual QA checklist
- Chat: ask for "cafes near me" and confirm prompt includes location, results render as horizontal cards with scroll snap.
- Chat: ask for "top cafes in Cebu" and verify cards show image, rating, and filter chips.
- Chat: ensure the assistant response is concise and not repeating cafe lists in text.
- Chat: verify cards include flags like Halal where applicable.
- Roadmap page renders AI Chat in the In Progress section and other modules moved down.

## Additional suggestions (optional)
- Persist user location (lat/lng + city) to localStorage to avoid repeated prompts.
- Add card skeletons for loading state to make the carousel feel responsive.
- Track chat query analytics by queryType to see most requested filters.
- Consider a small badge showing queryType (nearby/top/search) above the carousel.

---

Plan complete and saved to `docs/plans/2026-02-21-ai-chat-module-roadmap-update.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
