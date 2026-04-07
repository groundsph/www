# AI Chat Audit & Improvements Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Comprehensive audit-driven overhaul of the AI Chat feature: fix bugs, eliminate code duplication, add haptics everywhere, enhance micro-animations, improve mobile UX, and polish the overall chat experience.

**Architecture:** Incremental improvements across 12 tasks. Each task is self-contained and testable. Shared types and extracted utilities eliminate duplication before feature work begins. Animation and haptic improvements layer on top of a clean codebase.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), motion v12 (motion/react), web-haptics v0.0.6, Tailwind CSS v4, Bun, Zod v4

---

## Executive Summary

The AI Chat feature is functionally solid but has accumulated technical debt and has significant room for UX polish. This plan addresses **5 critical bugs**, **4 code quality issues**, and **7 UX/animation improvement areas** across 12 implementation tasks.

### Severity Legend
- 🔴 **Critical** - Bugs that affect user-facing behavior
- 🟡 **Important** - Code quality / maintainability issues
- 🟢 **Enhancement** - UX/animation/polish improvements

---

## Audit Findings

### 🔴 Critical Bugs

1. **Hardcoded remaining count in streaming** (`utils/ai/chat-stream.ts:280,322,414,441`): The `complete` chunk always sends `remaining: 10` regardless of actual remaining. The real count only comes in the `remaining` chunk from the route handler, causing a brief flash of incorrect count.

2. **No scroll-to-bottom during streaming** (`components/chat/ChatWindow.tsx:384`): `scrollToBottom()` is only called in the `finally` block after streaming completes. Users must manually scroll to see progress updates.

3. **Fragile auto-send selector** (`components/chat/ChatWindow.tsx:270`): Uses `document.querySelector('form[class*="p-3"]')` which can break if CSS classes change.

4. **Missing haptic on crawl save** (`components/chat/ChatCrawlPreview.tsx`): The "Save Crawl" button has zero haptic feedback.

5. **Missing haptic on assistant message receive**: No haptic fires when a new assistant message appears.

### 🟡 Code Quality Issues

6. **Duplicated stream handler logic**: `handleSubmit` and the pending-message `useEffect` in ChatWindow.tsx contain ~80 lines of identical streaming logic.

7. **Duplicated `Message` interface**: Defined independently in both `ChatWindow.tsx:20-28` and `ChatMessage.tsx:10-18`.

8. **Duplicated tool definitions**: Tools defined in both `chat-stream.ts:56-161` and `chat-tools.ts` with near-identical structures.

9. **Legacy code paths**: `app/api/actions/chat.ts` and `utils/ai/chat-tools.ts` appear unused by the primary UI flow.

### 🟢 UX/Animation Gaps

10. **No motion animations on ChatCafeCarousel**: Only CSS `transition-colors` on hover. No entry animations for cards.

11. **No motion animations on ChatCrawlPreview**: Only CSS `hover:scale-110` on the save button. No entry/exit animations.

12. **No typing indicator**: No animated dots/bubbles while waiting for AI. Only static progress messages.

13. **No safe-area-inset handling**: Widget positioned at `bottom-4 right-4` may overlap with iOS home indicator.

14. **No mobile keyboard handling**: Input doesn't scroll into view when mobile keyboard opens.

15. **Character counter re-renders**: `AnimatePresence` on every keystroke for the char counter (line 694-705) causes unnecessary re-renders.

16. **Console.log left in production** (`utils/ai/chat-stream.ts:265-287`): Debug logging runs in production.

---

## Implementation Tasks

### Task 1: Extract Shared Message Type 🔴🟡

**Files:**
- Modify: `utils/types/chat.ts` (add `ChatMessage` interface)
- Modify: `components/chat/ChatWindow.tsx:20-28` (remove local `Message`, import shared)
- Modify: `components/chat/ChatMessage.tsx:10-18` (remove local `Message`, import shared)

**Step 1: Add shared Message type to `utils/types/chat.ts`**

Add after the existing exports (line ~146):

```ts
export interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
    crawlDraft?: ChatCrawlDraft
}
```

**Step 2: Update `ChatWindow.tsx`**

- Remove the local `Message` interface (lines 20-28)
- Add `ChatMessage` to the import from `@/utils/types/chat`
- Replace all `Message` references with `ChatMessage` (state type, function params, etc.)

**Step 3: Update `ChatMessage.tsx`**

- Remove the local `Message` interface (lines 10-18)
- Add `ChatMessage` to the import from `@/utils/types/chat`
- Replace `Message` in `ChatMessageProps` with the imported type

**Step 4: Run tests**

```bash
bun test components/chat/__tests__/
```

**Step 5: Commit**

```bash
git add utils/types/chat.ts components/chat/ChatWindow.tsx components/chat/ChatMessage.tsx
git commit -m "refactor(chat): extract shared ChatMessage type to utils/types/chat"
```

---

### Task 2: Fix Hardcoded Remaining Count 🔴

**Files:**
- Modify: `utils/ai/chat-stream.ts:280,322,414,441` (remove hardcoded `remaining: 10`)

**Step 1: Remove hardcoded remaining from `complete` chunks**

In `utils/ai/chat-stream.ts`, the `complete` chunk type already has `remaining` as required in the schema (`utils/types/chat.ts:134`). The route handler (`app/api/chat/stream/route.ts:70-75`) already sends the correct `remaining` chunk after `incrementChatUsage`.

The fix: Remove `remaining: 10` from all 4 `complete` chunk emissions in `chat-stream.ts` and make it `remaining: 0` (a placeholder that will be overridden by the `remaining` chunk). Alternatively, update the schema to make `remaining` optional on `complete` chunks since the real value comes from the `remaining` chunk.

**Recommended approach:** Make `remaining` optional on the `complete` chunk type and stop sending it from `chat-stream.ts`.

**Step 2: Update the stream chunk schema in `utils/types/chat.ts`**

Change line 134 from:
```ts
remaining: z.number().int(),
```
to:
```ts
remaining: z.number().int().optional(),
```

**Step 3: Update all `complete` emissions in `chat-stream.ts`**

Remove `remaining: 10` from lines ~280, ~322, ~414, ~441.

**Step 4: Update `ChatWindow.tsx` chunk handler**

In the `case "complete"` handler, only set `finalMessage` and skip `remaining` (it comes from the `remaining` chunk):
```ts
case "complete":
    finalMessage = chunk.message
    break
```

**Step 5: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/
```

**Step 6: Commit**

```bash
git add utils/types/chat.ts utils/ai/chat-stream.ts components/chat/ChatWindow.tsx
git commit -m "fix(chat): remove hardcoded remaining count from stream complete chunks"
```

---

### Task 3: Extract Duplicated Stream Handler Logic 🟡

**Files:**
- Create: `utils/chat-stream-client.ts` (extract `sendChatMessageStream` + shared processing)
- Modify: `components/chat/ChatWindow.tsx` (remove duplicated logic, use extracted function)

**Step 1: Create `utils/chat-stream-client.ts`**

```ts
import type { ChatCafeCard, ChatCardContext, ChatCrawlDraft, ChatStreamChunk } from "@/utils/types/chat"

export interface StreamContext {
    recentCafes: ChatCafeCard[]
    recentToolCalls: { toolName: string; params: unknown; result: unknown }[]
    pathname: string
    pageTitle: string
}

export interface StreamResult {
    message: string
    cafes: ChatCafeCard[]
    cardContext?: ChatCardContext
    crawlDraft?: ChatCrawlDraft
    remaining: number
}

export async function sendChatMessageStream(
    message: string,
    context: StreamContext
): Promise<StreamResult> {
    const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context }),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send message")
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""
    const cafes: ChatCafeCard[] = []
    let cardContext: ChatCardContext | undefined
    let crawlDraft: ChatCrawlDraft | undefined
    let finalMessage = ""
    let finalRemaining = 0

    const onProgress?: (chunk: ChatStreamChunk) => void

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    const chunk = JSON.parse(line.slice(6)) as ChatStreamChunk
                    switch (chunk.type) {
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
                        case "remaining":
                            finalRemaining = chunk.remaining
                            break
                        case "error":
                            throw new Error(chunk.error)
                    }
                } catch {
                    // Ignore parse errors
                }
            }
        }
    }

    return { message: finalMessage, cafes, cardContext, crawlDraft, remaining: finalRemaining }
}
```

Wait -- this removes the progress/tool callbacks that the UI needs for streaming state updates. Better approach: Keep the callback-based `sendChatMessageStream` but extract it, and extract the "build result from chunks" logic into a shared helper that both `handleSubmit` and the pending-message handler use.

**Revised Step 1:** Extract `sendChatMessageStream` to `utils/chat-stream-client.ts` as-is (keeping the callback pattern). Then extract the duplicated "process stream into Message" logic.

```ts
// utils/chat-stream-client.ts
import type { ChatStreamChunk } from "@/utils/types/chat"

export async function sendChatMessageStream(
    message: string,
    onChunk: (chunk: ChatStreamChunk) => void,
    context: {
        recentCafes: unknown[]
        recentToolCalls: { toolName: string; params: unknown; result: unknown }[]
        pathname: string
        pageTitle: string
    }
): Promise<void> {
    const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context }),
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

**Step 2: Update `ChatWindow.tsx`**

- Remove the local `sendChatMessageStream` function (lines 43-89)
- Import it from `@/utils/chat-stream-client`
- Extract the duplicated stream-processing logic (used in both `handleSubmit` and the pending-message `useEffect`) into a shared helper function within ChatWindow:

```ts
const processStreamResponse = useCallback(async (
    content: string,
    locationHint: string
) => {
    const cafes: ChatCafeCard[] = []
    let cardContext: ChatCardContext | undefined
    let crawlDraft: ChatCrawlDraft | undefined
    let finalMessage = ""
    let finalRemaining = currentRemaining

    await sendChatMessageStream(
        `${content}${locationHint}`,
        (chunk) => {
            switch (chunk.type) {
                case "progress":
                    setStreamState({
                        isStreaming: true,
                        progressMessage: chunk.message,
                        progressStep: chunk.step ?? 0,
                    })
                    break
                case "tool":
                    setStreamState((prev) => ({
                        isStreaming: true,
                        progressMessage: `Searching ${chunk.toolName}...`,
                        progressStep: prev.progressStep + 1,
                    }))
                    setRecentToolCalls((prev) => [
                        ...prev,
                        { toolName: chunk.toolName, params: chunk.params, result: {} },
                    ])
                    break
                case "cafes":
                    cafes.push(...chunk.cafes)
                    cardContext = chunk.cardContext
                    setRecentCafes((prev) => [...prev, ...chunk.cafes])
                    break
                case "crawlDraft":
                    crawlDraft = chunk.crawlDraft
                    break
                case "complete":
                    finalMessage = chunk.message
                    break
                case "remaining":
                    finalRemaining = chunk.remaining
                    break
                case "error":
                    throw new Error(chunk.error)
            }
        },
        {
            recentCafes,
            recentToolCalls,
            pathname: window.location.pathname,
            pageTitle: document.title,
        }
    )

    return { cafes, cardContext, crawlDraft, finalMessage, finalRemaining }
}, [currentRemaining, recentCafes, recentToolCalls])
```

Then both `handleSubmit` and the pending-message `useEffect` call `processStreamResponse` and build the assistant message from the result.

**Step 3: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/
```

**Step 4: Commit**

```bash
git add utils/chat-stream-client.ts components/chat/ChatWindow.tsx
git commit -m "refactor(chat): extract sendChatMessageStream and deduplicate stream processing"
```

---

### Task 4: Add Missing Haptics 🟢

**Files:**
- Modify: `components/chat/ChatCrawlPreview.tsx` (add haptics to Save Crawl button)
- Modify: `components/chat/ChatWindow.tsx` (add haptics on assistant message receive, on stream progress)

**Step 1: Add haptics to ChatCrawlPreview Save button**

In `ChatCrawlPreview.tsx`:
- Import `useHaptics` from `@/hooks/useHaptics`
- Add `const { trigger } = useHaptics()` in the component
- Add `onClick={() => { trigger("success"); handleSave() }}` to the Save button

```tsx
import { useHaptics } from "@/hooks/useHaptics"

export default function ChatCrawlPreview({ draft }: ChatCrawlPreviewProps) {
    const { trigger } = useHaptics()
    // ... existing code ...
    <button
        onClick={() => { trigger("success"); handleSave() }}
        className='px-3 py-2 text-xs font-bold rounded-lg bg-text text-background hover:bg-text/90 hover:scale-110 hover:shadow-2xs shadow-none transition-all text-nowrap'
    >
        Save Crawl
    </button>
```

**Step 2: Add haptic on assistant message receive**

In `ChatWindow.tsx`, after the assistant message is added to state (in `processStreamResponse` or `handleSubmit`), add:

```ts
trigger("success")
```

This fires when the full assistant message is received and added to the messages list.

**Step 3: Add haptic on stream progress step change**

In the `case "progress"` handler, optionally add a light haptic:

```ts
case "progress":
    setStreamState({
        isStreaming: true,
        progressMessage: chunk.message,
        progressStep: chunk.step ?? 0,
    })
    trigger("selection")
    break
```

**Step 4: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/
```

**Step 5: Commit**

```bash
git add components/chat/ChatCrawlPreview.tsx components/chat/ChatWindow.tsx
git commit -m "feat(chat): add haptic feedback to crawl save, message receive, and stream progress"
```

---

### Task 5: Add Micro-Animations to ChatCafeCarousel 🟢

**Files:**
- Modify: `components/chat/ChatCafeCarousel.tsx` (add motion animations)

**Step 1: Add motion/react import and entry animations**

Add `import { motion } from "motion/react"` to the carousel.

Wrap each cafe card `<a>` with a `motion.a` that has staggered entry animation:

```tsx
{cafes.map((cafe, index) => (
    <motion.a
        key={cafe.id}
        href={`/cafes/${cafe.slug}`}
        onClick={() => trigger("light")}
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{
            delay: index * 0.08,
            type: "spring",
            stiffness: 300,
            damping: 25,
        }}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="group shrink-0 w-4/5 max-w-[85svw] snap-start flex flex-col gap-3"
    >
        {/* card content */}
    </motion.a>
))}
```

**Step 2: Add AnimatePresence wrapper for the carousel container**

Wrap the entire carousel in `<AnimatePresence>` so cards animate in/out when cafes change:

```tsx
<AnimatePresence mode="popLayout">
    <motion.div
        className="mt-3 max-w-full"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
        {/* existing carousel content */}
    </motion.div>
</AnimatePresence>
```

**Step 3: Add subtle hover animation to the cafe image**

Wrap the image container div in a `motion.div` with a subtle scale on hover:

```tsx
<motion.div
    className="w-14 h-14 rounded-lg overflow-hidden bg-text/5 shrink-0"
    whileHover={{ scale: 1.05 }}
    transition={{ type: "spring", stiffness: 400, damping: 20 }}
>
    {/* image content */}
</motion.div>
```

**Step 4: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/chat-message-cafe-cards.test.tsx
```

**Step 5: Commit**

```bash
git add components/chat/ChatCafeCarousel.tsx
git commit -m "feat(chat): add staggered entry and hover animations to cafe carousel"
```

---

### Task 6: Add Micro-Animations to ChatCrawlPreview 🟢

**Files:**
- Modify: `components/chat/ChatCrawlPreview.tsx` (add motion animations)

**Step 1: Add motion import and container animation**

```tsx
import { motion, AnimatePresence } from "motion/react"
```

Wrap the outer `<div>` in `motion.div` with entry animation:

```tsx
<motion.div
    initial={{ opacity: 0, y: 15, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 25 }}
    className='mt-3 border border-primary/10 rounded-xl p-3 bg-secondary/5'
>
```

**Step 2: Add staggered entry for crawl stop items**

Replace the stop items `<div>` with `motion.div`:

```tsx
{draft.items.slice(0, 4).map((item, index) => (
    <motion.div
        key={item.cafeId}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.06, type: "spring", stiffness: 400, damping: 25 }}
        className='flex items-center gap-2 text-xs text-text/70'
    >
        {/* stop content */}
    </motion.div>
))}
```

**Step 3: Add motion to the Save Crawl button**

Replace the `<button>` with `motion.button`:

```tsx
<motion.button
    onClick={() => { trigger("success"); handleSave() }}
    whileHover={{ scale: 1.08 }}
    whileTap={{ scale: 0.95 }}
    className='px-3 py-2 text-xs font-bold rounded-lg bg-text text-background shadow-none transition-colors text-nowrap'
>
    Save Crawl
</motion.button>
```

Note: Remove `hover:scale-110 hover:shadow-2xs` from className since `whileHover` handles scale now.

**Step 4: Add number badge pulse animation**

Wrap the stop number badge in a `motion.span` with a subtle pulse on entry:

```tsx
<motion.span
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ delay: index * 0.06 + 0.1, type: "spring", stiffness: 500, damping: 20 }}
    className='w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center'
>
    {item.sortOrder + 1}
</motion.span>
```

**Step 5: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/chat-message-crawl-preview.test.tsx
```

**Step 6: Commit**

```bash
git add components/chat/ChatCrawlPreview.tsx
git commit -m "feat(chat): add spring animations and staggered stops to crawl preview"
```

---

### Task 7: Add Typing Indicator / Thinking Bubble 🟢

**Files:**
- Modify: `components/chat/ChatWindow.tsx` (add animated typing dots)

**Step 1: Create a TypingIndicator component inline or extract**

Add a `TypingIndicator` component (can be inline in ChatWindow or as a separate file):

```tsx
function TypingIndicator() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex justify-start"
        >
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-background border border-primary/10">
                <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <motion.span
                            key={i}
                            className="w-2 h-2 rounded-full bg-text/40"
                            animate={{
                                opacity: [0.3, 1, 0.3],
                                scale: [0.8, 1, 0.8],
                            }}
                            transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: "easeInOut",
                            }}
                        />
                    ))}
                </div>
            </div>
        </motion.div>
    )
}
```

**Step 2: Show typing indicator when loading and no progress message yet**

In the `<AnimatePresence>` for messages, add the typing indicator conditionally:

```tsx
{isLoading && !streamState.progressMessage && (
    <TypingIndicator key="typing-indicator" />
)}
```

This shows the bouncing dots right after the user sends a message, before the first "Thinking..." progress message arrives. Once `streamState.progressMessage` is set, the progress indicator replaces it (via AnimatePresence exit animation).

**Step 3: Ensure the typing indicator is in the right position**

Place it after the messages map and before the stream progress indicator:

```tsx
{messages.map((message, index) => (
    <motion.div key={message.id} ...>
        <ChatMessage message={message} />
    </motion.div>
))}
{isLoading && !streamState.progressMessage && (
    <TypingIndicator key="typing-indicator" />
)}
{isLoading && streamState.progressMessage && (
    <motion.div key="stream-progress" ...>
```

**Step 4: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/
```

**Step 5: Commit**

```bash
git add components/chat/ChatWindow.tsx
git commit -m "feat(chat): add animated typing indicator with bouncing dots"
```

---

### Task 8: Fix Auto-Send Selector and Remove Console.logs 🟡

**Files:**
- Modify: `components/chat/ChatWindow.tsx:270-275` (fix fragile selector)
- Modify: `utils/ai/chat-stream.ts:265-287` (remove debug console.log)

**Step 1: Fix auto-send selector in ChatWindow.tsx**

Replace the fragile `document.querySelector('form[class*="p-3"]')` with a ref-based approach:

Add a ref for the form:
```tsx
const formRef = useRef<HTMLFormElement>(null)
```

Add the ref to the form element:
```tsx
<form
    ref={formRef}
    onSubmit={handleSubmit}
    className='p-3 border-t border-primary/10 bg-background/80 backdrop-blur-sm'
>
```

Update the auto-send `useEffect`:
```tsx
useEffect(() => {
    if (!autoSend || !prefillMessage || !input.trim()) return
    if (isLoading || currentRemaining <= 0) return

    formRef.current?.requestSubmit()
}, [autoSend, prefillMessage, input, isLoading, currentRemaining])
```

**Step 2: Remove console.log from chat-stream.ts**

Remove all `console.log` debug statements in `utils/ai/chat-stream.ts` (lines 265-287):

```ts
// Remove these lines:
console.log("[runChatStream] Checking for context:", { ... })
console.log("[runChatStream] Attempting to build crawl from context...")
console.log("[runChatStream] ✅ Successfully built crawl from context")
console.log("[runChatStream] ❌ buildChatCrawlDraft returned null, continuing to tool calls")
console.log("[runChatStream] No context available or empty message, proceeding to tool calls")
```

Keep only `console.error` for actual error conditions.

**Step 3: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/
```

**Step 4: Commit**

```bash
git add components/chat/ChatWindow.tsx utils/ai/chat-stream.ts
git commit -m "fix(chat): replace fragile auto-send selector with ref, remove debug console.logs"
```

---

### Task 9: Progressive Scroll-to-Bottom During Streaming 🔴

**Files:**
- Modify: `components/chat/ChatWindow.tsx` (add scroll on progress updates)

**Step 1: Add scroll-to-bottom on stream state changes**

Currently `scrollToBottom` only fires in the `finally` block (line 384). Add it to the stream chunk handler so the view follows progress updates:

In the `processStreamResponse` helper, after handling `progress`, `tool`, `cafes`, and `crawlDraft` chunks, call `scrollToBottom()`:

```ts
case "progress":
    setStreamState({
        isStreaming: true,
        progressMessage: chunk.message,
        progressStep: chunk.step ?? 0,
    })
    trigger("selection")
    setTimeout(scrollToBottom, 50)
    break
case "tool":
    // ... existing tool handling ...
    setTimeout(scrollToBottom, 50)
    break
case "cafes":
    // ... existing cafes handling ...
    setTimeout(scrollToBottom, 50)
    break
```

The `setTimeout` ensures the DOM has updated before scrolling.

**Step 2: Also scroll when the assistant message is added**

After `setMessages((prev) => [...prev, assistantMessage])`, add:

```ts
setTimeout(scrollToBottom, 100)
```

**Step 3: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/
```

**Step 4: Commit**

```bash
git add components/chat/ChatWindow.tsx
git commit -m "fix(chat): add progressive scroll-to-bottom during streaming"
```

---

### Task 10: Mobile UX - Safe Area and Keyboard Handling 🟢

**Files:**
- Modify: `components/chat/ChatWidget.tsx` (safe area insets)
- Modify: `components/chat/ChatWindow.tsx` (input scroll on focus)

**Step 1: Add safe-area-inset padding to the widget**

In `ChatWidget.tsx`, update the widget container class to account for iOS home indicator:

```tsx
className='fixed bottom-4 right-4 z-55 flex flex-col items-end pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]'
```

**Step 2: Add safe-area-inset to the chat window input area**

In `ChatWindow.tsx`, add safe area to the input form:

```tsx
className='p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-primary/10 bg-background/80 backdrop-blur-sm'
```

**Step 3: Scroll input into view on mobile focus**

Add an `onFocus` handler to the input that scrolls it into view when the mobile keyboard opens:

```tsx
<input
    type='text'
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onFocus={() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 300)
    }}
    // ... rest of props
/>
```

The 300ms delay allows the keyboard animation to complete before scrolling.

**Step 4: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/
```

**Step 5: Commit**

```bash
git add components/chat/ChatWidget.tsx components/chat/ChatWindow.tsx
git commit -m "feat(chat): add safe-area-inset handling and mobile keyboard scroll"
```

---

### Task 11: Optimize Character Counter and Input Animations 🟢

**Files:**
- Modify: `components/chat/ChatWindow.tsx` (optimize char counter, add input focus animation)

**Step 1: Replace AnimatePresence char counter with CSS transition**

The current `AnimatePresence` wrapping the character counter (lines 694-705) causes re-renders on every keystroke. Replace with a CSS-only approach:

```tsx
<span
    className={cn(
        "absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text/30 font-medium transition-all duration-200",
        input.trim() ? "opacity-100 scale-100" : "opacity-0 scale-80 pointer-events-none"
    )}
>
    {input.length}/2000
</span>
```

Remove the `<AnimatePresence>` wrapper and `motion.span` for the counter.

**Step 2: Add focus ring animation to input**

Add a subtle focus animation to the input using CSS instead of motion:

```tsx
className={cn(
    "w-full px-4 py-3 pr-12 border rounded-xl text-sm",
    "transition-all duration-200 ease-out",
    "bg-background",
    "focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none",
    "focus:shadow-md focus:shadow-primary/5",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    input.trim()
        ? "border-primary/30"
        : "border-text/20 hover:border-text/30",
)}
```

**Step 3: Run lint and tests**

```bash
bun lint
bun test components/chat/__tests__/
```

**Step 4: Commit**

```bash
git add components/chat/ChatWindow.tsx
git commit -m "perf(chat): replace AnimatePresence char counter with CSS transition"
```

---

### Task 12: Update Tests and Final Verification 🟢

**Files:**
- Modify: All test files in `components/chat/__tests__/` as needed

**Step 1: Verify existing tests still pass after all changes**

```bash
bun test components/chat/__tests__/ --timeout 30000
```

**Step 2: Fix any broken tests**

Common breakages to expect:
- Import path changes (shared `ChatMessage` type)
- Missing `sendChatMessageStream` import (moved to `utils/chat-stream-client`)
- Snapshot updates for new motion animations

**Step 3: Add test for typing indicator**

In `chat-window.test.tsx` or a new file, add:

```tsx
it("shows typing indicator when loading and no progress message", async () => {
    // Mock fetch to delay response
    // Send a message
    // Assert typing indicator dots appear
    // Assert typing indicator disappears when progress message arrives
})
```

**Step 4: Add test for haptic on crawl save**

In `chat-message-crawl-preview.test.tsx`:

```tsx
it("triggers haptic feedback when save crawl is clicked", async () => {
    const mockTrigger = vi.fn()
    // Mock useHaptics to return mockTrigger
    // Render ChatCrawlPreview with a draft
    // Click save button
    // Assert mockTrigger was called with "success"
})
```

**Step 5: Run full lint check**

```bash
bun lint
```

**Step 6: Run full test suite**

```bash
bun test
```

**Step 7: Final commit**

```bash
git add components/chat/__tests__/
git commit -m "test(chat): update tests for chat audit improvements"
```

---

## Execution Order

Tasks should be executed in this order due to dependencies:

1. **Task 1** (Shared types) -- no dependencies, enables Task 3
2. **Task 2** (Hardcoded remaining) -- independent
3. **Task 3** (Extract stream logic) -- depends on Task 1
4. **Task 4** (Missing haptics) -- depends on Task 3 for cleaner code
5. **Task 5** (Carousel animations) -- independent
6. **Task 6** (Crawl preview animations) -- independent, can parallel with 5
7. **Task 7** (Typing indicator) -- depends on Task 3
8. **Task 8** (Auto-send fix + console.logs) -- independent
9. **Task 9** (Progressive scroll) -- depends on Task 3
10. **Task 10** (Mobile UX) -- independent
11. **Task 11** (Char counter optimization) -- independent
12. **Task 12** (Tests) -- depends on all above

**Parallelization:** Tasks 2, 5, 6, 8, 10, 11 are fully independent and can be done in parallel. Tasks 1, 3, 4, 7, 9 should be sequential.

---

## Post-Implementation Checklist

- [ ] Version bumped to `2026.15.0` in `package.json`
- [ ] All `console.log` debug statements removed from production code
- [ ] No duplicated interfaces or functions remain
- [ ] Haptics fire on: open, close, send, receive, save, cafe card tap, error, rate limit, stream progress
- [ ] All chat components have motion/react entry animations
- [ ] Typing indicator shows during AI response wait
- [ ] Scroll follows streaming progress
- [ ] Safe area insets handled for iOS
- [ ] Auto-send uses ref instead of querySelector
- [ ] Character counter uses CSS transitions instead of AnimatePresence
- [ ] All existing tests pass
- [ ] `bun lint` passes clean
- [ ] `bun build` succeeds
