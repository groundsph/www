# Chat Streaming + Progress Messages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert chat from server action to streaming API route with real-time progress updates (Searching cafes..., Building crawl..., etc.)

**Architecture:** Create `/api/chat/stream` route using ReadableStream with Server-Sent Events (SSE) format. Client uses EventSource or fetch with reader to consume chunks. Each chunk is a JSON object with `type: "progress" | "tool" | "complete" | "error"` and relevant data.

**Tech Stack:** Next.js API Routes, ReadableStream, React useEffect for stream consumption, Zod for chunk validation.

---

### Task 1: Create streaming response types

**Files:**
- Modify: `utils/types/chat.ts`
- Test: `utils/__tests__/chat-types.test.ts`

**Step 1: Add streaming chunk types**

Add to `utils/types/chat.ts`:

```ts
export const chatStreamChunkSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("progress"),
        message: z.string(),
        step: z.number().int().optional(),
    }),
    z.object({
        type: z.literal("tool"),
        toolName: z.string(),
        params: z.unknown(),
    }),
    z.object({
        type: z.literal("cafes"),
        cafes: z.array(chatCafeCardSchema),
        cardContext: chatCardContextSchema.optional(),
    }),
    z.object({
        type: z.literal("crawlDraft"),
        crawlDraft: chatCrawlDraftSchema,
    }),
    z.object({
        type: z.literal("complete"),
        message: z.string(),
        remaining: z.number().int(),
    }),
    z.object({
        type: z.literal("error"),
        error: z.string(),
    }),
])

export type ChatStreamChunk = z.infer<typeof chatStreamChunkSchema>
```

**Step 2: Run tests**

All existing tests should pass.

**Step 3: Commit**

```bash
git add utils/types/chat.ts
git commit -m "feat: add streaming chunk types"
```

---

### Task 2: Create streaming chat function

**Files:**
- Create: `utils/ai/chat-stream.ts`
- Test: `utils/ai/__tests__/chat-stream.test.ts`

**Step 1: Create streaming function**

Create `utils/ai/chat-stream.ts`:

```ts
"use server"

import { runCafeQuery } from "@/utils/ai/tools/cafe-query-runner"
import {
    getCafeBySlug,
    compareCafes,
    listCitiesWithCounts,
    getNearbyCafes,
    getTopRatedCafes,
} from "@/utils/ai/tools/cafe-insights"
import { CafeQueryInput } from "@/utils/ai/tools/cafe-query"
import { GeoPoint } from "@/utils/ai/tools/cafe-geo"
import { chatCompletionWithTools } from "@/utils/ai/openai-compatible"
import { buildChatCafeCards } from "@/utils/ai/chat-cafe-cards"
import { buildChatCrawlDraft } from "@/utils/ai/chat-crawl-draft"
import type { ChatStreamChunk } from "@/utils/types/chat"

const MAX_TOOL_CALLS = 6

const CHAT_SYSTEM_PROMPT = `You are a helpful assistant for Grounds...`

interface ToolCall {
    id: string
    type: "function"
    function: { name: string; arguments: string }
}

export interface ChatStreamOptions {
    message: string
    sessionId: string
    onChunk: (chunk: ChatStreamChunk) => void | Promise<void>
}

async function executeTool(toolName: string, args: string): Promise<unknown> {
    const parsed = JSON.parse(args)
    switch (toolName) {
        case "query_cafes":
            return runCafeQuery(parsed as CafeQueryInput)
        case "get_cafe_by_slug":
            return getCafeBySlug(parsed.slug)
        case "compare_cafes":
            return compareCafes(parsed.slugA, parsed.slugB)
        case "list_cities":
            return listCitiesWithCounts()
        case "get_nearby_cafes":
            return getNearbyCafes(
                { lat: parsed.lat, lng: parsed.lng },
                parsed.radiusKm
            )
        case "get_top_rated":
            return getTopRatedCafes(parsed.city, parsed.limit ?? 10)
        default:
            throw new Error(`Unknown tool: ${toolName}`)
    }
}

export async function runChatStream(options: ChatStreamOptions): Promise<void> {
    const { message, sessionId, onChunk } = options

    if (!message?.trim()) {
        await onChunk({ type: "error", error: "Please enter a message" })
        return
    }

    await onChunk({ type: "progress", message: "Thinking...", step: 1 })

    const messages = [
        { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
        { role: "user" as const, content: message },
    ]

    const toolCallRecords: { toolName: string; params: unknown; result: unknown }[] = []

    try {
        for (let callCount = 0; callCount < MAX_TOOL_CALLS; callCount++) {
            const response = await chatCompletionWithTools(messages, tools, {
                temperature: 0.7,
                maxTokens: 1000,
                timeoutMs: 60000,
                toolChoice: "auto",
            })

            if (!response) {
                await onChunk({
                    type: "error",
                    error: "No response from AI",
                })
                return
            }

            if (response.toolCalls && response.toolCalls.length > 0) {
                for (const toolCall of response.toolCalls) {
                    await onChunk({
                        type: "progress",
                        message: `Searching ${toolCall.function.name}...`,
                        step: callCount + 2,
                    })

                    const result = await executeTool(
                        toolCall.function.name,
                        toolCall.function.arguments
                    )

                    toolCallRecords.push({
                        toolName: toolCall.function.name,
                        params: JSON.parse(toolCall.function.arguments),
                        result,
                    })

                    await onChunk({
                        type: "tool",
                        toolName: toolCall.function.name,
                        params: JSON.parse(toolCall.function.arguments),
                    })
                }
            } else {
                // Final response
                const { cafes, cardContext } = buildChatCafeCards(toolCallRecords)
                const crawlDraft = buildChatCrawlDraft(toolCallRecords, message)

                if (cafes.length > 0) {
                    await onChunk({ type: "cafes", cafes, cardContext })
                }

                if (crawlDraft) {
                    await onChunk({ type: "crawlDraft", crawlDraft })
                }

                await onChunk({
                    type: "complete",
                    message: response.content ?? "I don't have a response for that.",
                    remaining: 10, // Will be updated by rate limit logic
                })
                return
            }
        }

        // Max tool calls reached
        const { cafes, cardContext } = buildChatCafeCards(toolCallRecords)
        const crawlDraft = buildChatCrawlDraft(toolCallRecords, message)

        if (cafes.length > 0) {
            await onChunk({ type: "cafes", cafes, cardContext })
        }

        if (crawlDraft) {
            await onChunk({ type: "crawlDraft", crawlDraft })
        }

        await onChunk({
            type: "complete",
            message: "I needed to look up more information than expected. Here's what I found so far.",
            remaining: 10,
        })
    } catch (error) {
        console.error(`Chat error for session ${sessionId}:`, error)
        await onChunk({
            type: "error",
            error: "An error occurred while processing your message",
        })
    }
}
```

**Step 2: Commit**

```bash
git add utils/ai/chat-stream.ts
git commit -m "feat: add streaming chat function"
```

---

### Task 3: Create streaming API route

**Files:**
- Create: `app/api/chat/stream/route.ts`
- Test: Manual testing

**Step 1: Create API route**

Create `app/api/chat/stream/route.ts`:

```ts
import { NextRequest } from "next/server"
import { runChatStream } from "@/utils/ai/chat-stream"
import { getCurrentUser } from "@/lib/auth"
import { getOrCreateChatSessionId } from "@/utils/chat-session"
import { checkChatLimit, incrementChatUsage } from "@/utils/chat-rate-limit"
import { getChatEnabled } from "@/utils/feature-flags"
import { z } from "zod"

const requestSchema = z.object({
    message: z.string().min(1).max(2000),
})

export async function POST(request: NextRequest) {
    try {
        // Check if chat is enabled
        if (!(await getChatEnabled())) {
            return new Response(
                JSON.stringify({ type: "error", error: "Chat is temporarily unavailable" }),
                { status: 503, headers: { "Content-Type": "application/json" } }
            )
        }

        // Parse request
        const body = await request.json()
        const validated = requestSchema.safeParse(body)
        if (!validated.success) {
            return new Response(
                JSON.stringify({ type: "error", error: "Invalid message" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        // Get user and session
        const user = await getCurrentUser()
        const sessionId = user?.id ?? (await getOrCreateChatSessionId(null))

        // Check rate limit
        const { canSend, remaining } = await checkChatLimit(sessionId)
        if (!canSend) {
            return new Response(
                JSON.stringify({ type: "error", error: "Rate limit exceeded" }),
                { status: 429, headers: { "Content-Type": "application/json" } }
            )
        }

        // Create streaming response
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()

                try {
                    await runChatStream({
                        message: validated.data.message,
                        sessionId,
                        onChunk: async (chunk) => {
                            const data = JSON.stringify(chunk)
                            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                        },
                    })

                    // Increment usage after successful completion
                    await incrementChatUsage(sessionId)

                    // Send final remaining count
                    const finalChunk = JSON.stringify({
                        type: "remaining",
                        remaining: Math.max(0, remaining - 1),
                    })
                    controller.enqueue(encoder.encode(`data: ${finalChunk}\n\n`))
                } catch (error) {
                    console.error("Stream error:", error)
                    const errorChunk = JSON.stringify({
                        type: "error",
                        error: "Stream processing failed",
                    })
                    controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`))
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        })
    } catch (error) {
        console.error("API error:", error)
        return new Response(
            JSON.stringify({ type: "error", error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}
```

**Step 2: Commit**

```bash
git add app/api/chat/stream/route.ts
git commit -m "feat: add streaming chat API route"
```

---

### Task 4: Update ChatWindow to use streaming

**Files:**
- Modify: `components/chat/ChatWindow.tsx`
- Modify: `components/chat/ChatMessage.tsx`

**Step 1: Create streaming hook**

Add to `components/chat/ChatWindow.tsx`:

```ts
interface StreamState {
    isStreaming: boolean
    progressMessage: string | null
    progressStep: number
}

async function sendChatMessageStream(
    message: string,
    onChunk: (chunk: ChatStreamChunk) => void
): Promise<void> {
    const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send message")
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    const chunk = JSON.parse(line.slice(6))
                    onChunk(chunk)
                } catch {
                    // Ignore parse errors
                }
            }
        }
    }
}
```

**Step 2: Update handleSubmit to use streaming**

Replace the `sendChatMessage` call in `handleSubmit` with streaming:

```ts
const [streamState, setStreamState] = useState<StreamState>({
    isStreaming: false,
    progressMessage: null,
    progressStep: 0,
})

// In handleSubmit:
setStreamState({ isStreaming: true, progressMessage: "Starting...", progressStep: 0 })

const cafes: ChatCafeCard[] = []
let cardContext: ChatCardContext | undefined
let crawlDraft: ChatCrawlDraft | undefined
let finalMessage = ""

await sendChatMessageStream(`${userMessage.content}${locationHint}`, (chunk) => {
    switch (chunk.type) {
        case "progress":
            setStreamState({
                isStreaming: true,
                progressMessage: chunk.message,
                progressStep: chunk.step ?? 0,
            })
            break
        case "cafes":
            cafes.push(...chunk.cafes)
            cardContext = chunk.cardContext
            break
        case "crawlDraft":
            crawlDraft = chunk.crawlDraft
            break
        case "complete":
            finalMessage = chunk.message
            break
        case "error":
            throw new Error(chunk.error)
    }
})

const assistantMessage: Message = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: finalMessage,
    timestamp: new Date(),
    cafes: cafes.length > 0 ? cafes : undefined,
    cardContext,
    crawlDraft,
}

setMessages((prev) => [...prev, assistantMessage])
setStreamState({ isStreaming: false, progressMessage: null, progressStep: 0 })
```

**Step 3: Update loading UI**

Replace the loading indicator with progress:

```tsx
{isLoading && streamState.progressMessage && (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className='flex items-center gap-3 p-3 bg-secondary/5 rounded-xl w-fit'
    >
        <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
        >
            <Loader2 className='w-4 h-4 text-secondary animate-spin' />
        </motion.div>
        <div className='flex flex-col'>
            <span className='text-sm text-text/70'>
                {streamState.progressMessage}
            </span>
            {streamState.progressStep > 0 && (
                <span className='text-xs text-text/40'>
                    Step {streamState.progressStep}
                </span>
            )}
        </div>
    </motion.div>
)}
```

**Step 4: Commit**

```bash
git add components/chat/ChatWindow.tsx
git commit -m "feat: update ChatWindow to use streaming with progress"
```

---

### Task 5: Test and verify

**Manual QA:**
1. Open chat
2. Type: "Build me a crawl for Cebu"
3. Verify you see progress messages:
   - "Thinking..."
   - "Searching query_cafes..."
   - "Building crawl..."
   - Final response with crawl preview
4. Verify crawl cards appear
5. Verify Save Crawl button works

**Step 1: Commit any final fixes**

```bash
git commit -m "fix: streaming chat improvements"
```

---

Plan complete. Ready for implementation.