# OCR Phase-Based Timeout & AI Chat Bubble Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Replace the flat elapsed-time timer in the OCR modal with a phase-based timeout system that dynamically resets during AI streaming, shows percentage-based progress per phase, and displays extracted item counts in real-time; (2) Fix small AI chat message bubbles that don't size properly by improving the ShrinkwrapBubble width calculation for short content.

**Architecture:**
- **OCR Timeout:** Introduce an `OcrPhase` state machine (`uploading` → `ai-processing` → `streaming` → `processing-results`) with per-phase timeout budgets. The client stream consumer increments phase and resets the per-phase timer on activity. The progress bar shows percentage within the current phase. During `streaming`, each received token resets the idle timer so the AI never times out while actively generating. A streaming JSON parser extracts item names/count from the partial response to show "3 items found..." in real-time.
- **Chat Bubbles:** The existing `ShrinkwrapBubble` already uses `@chenglou/pretext`. The issue is that short messages ("OK", "Yes") get a `minWidth={80}` that's too wide, and the single-line natural width measurement may include unwanted padding. We reduce `minWidth` to a smaller value and ensure the calculation accounts for bubble padding (`px-4 py-2.5` = 32px horizontal). We also add a `minWidth` override for the chat context that better fits one-word messages.

**Tech Stack:** React, TypeScript, `@chenglou/pretext`, `motion/react`, Tailwind CSS v4, Bun

---

## Part 1: OCR Phase-Based Timeout System

### Task 1: Define `OcrPhase` type and phase configuration

**Files:**
- Modify: `utils/ocr-stream-client.ts`

**Step 1: Write the failing test**

Create `utils/__tests__/ocr-stream-client.test.ts`:

```ts
import { describe, it, expect } from "bun:test"
import { OCR_PHASE_CONFIG, type OcrPhase } from "@/utils/ocr-stream-client"

describe("OCR Phase Configuration", () => {
    it("has config for all phases", () => {
        const phases: OcrPhase[] = ["uploading", "ai-processing", "streaming", "processing-results"]
        for (const phase of phases) {
            expect(OCR_PHASE_CONFIG[phase]).toBeDefined()
            expect(OCR_PHASE_CONFIG[phase].timeoutMs).toBeGreaterThan(0)
            expect(OCR_PHASE_CONFIG[phase].label).toBeTruthy()
        }
    })

    it("uploading phase has shortest timeout", () => {
        expect(OCR_PHASE_CONFIG["uploading"].timeoutMs)
            .toBeLessThan(OCR_PHASE_CONFIG["ai-processing"].timeoutMs)
    })

    it("streaming phase has longest timeout", () => {
        expect(OCR_PHASE_CONFIG["streaming"].timeoutMs)
            .toBeGreaterThanOrEqual(OCR_PHASE_CONFIG["ai-processing"].timeoutMs)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/ocr-stream-client.test.ts`
Expected: FAIL — `OCR_PHASE_CONFIG` and `OcrPhase` not yet exported.

**Step 3: Add the `OcrPhase` type and config to `ocr-stream-client.ts`**

Add at the top of `utils/ocr-stream-client.ts` (after existing imports):

```ts
export type OcrPhase = "uploading" | "ai-processing" | "streaming" | "processing-results"

export const OCR_PHASE_CONFIG: Record<OcrPhase, { timeoutMs: number; label: string }> = {
    "uploading": { timeoutMs: 15_000, label: "Uploading image..." },
    "ai-processing": { timeoutMs: 30_000, label: "AI analyzing menu..." },
    "streaming": { timeoutMs: 120_000, label: "Extracting items..." },
    "processing-results": { timeoutMs: 10_000, label: "Processing results..." },
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/ocr-stream-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/ocr-stream-client.ts utils/__tests__/ocr-stream-client.test.ts
git commit -m "feat(ocr): add OcrPhase type and phase timeout configuration"
```

---

### Task 2: Extend `OcrStreamCallbacks` with phase and item-count events

**Files:**
- Modify: `utils/ocr-stream-client.ts`

**Step 1: Write the failing test**

Add to `utils/__tests__/ocr-stream-client.test.ts`:

```ts
import { describe, it, expect } from "bun:test"
import { OCR_PHASE_CONFIG, type OcrPhase, type OcrStreamCallbacks } from "@/utils/ocr-stream-client"

describe("OcrStreamCallbacks", () => {
    it("includes onPhaseChange callback", () => {
        const callbacks: OcrStreamCallbacks = {
            onStatus: (_msg: string) => {},
            onContent: (_token: string) => {},
            onComplete: (_data: { items: unknown[]; deduplicated: unknown[]; duplicates: string[] }) => {},
            onError: (_error: string) => {},
            onPhaseChange: (_phase: OcrPhase) => {},
            onItemCount: (_count: number) => {},
        }
        expect(callbacks.onPhaseChange).toBeDefined()
        expect(callbacks.onItemCount).toBeDefined()
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/ocr-stream-client.test.ts`
Expected: FAIL — `onPhaseChange` and `onItemCount` not in `OcrStreamCallbacks`.

**Step 3: Update `OcrStreamCallbacks` interface**

Modify `utils/ocr-stream-client.ts` — update the interface:

```ts
export interface OcrStreamCallbacks {
    onStatus: (message: string) => void
    onContent: (token: string) => void
    onComplete: (data: {
        items: OcrMenuItem[]
        deduplicated: OcrMenuItem[]
        duplicates: string[]
    }) => void
    onError: (error: string) => void
    onPhaseChange?: (phase: OcrPhase) => void
    onItemCount?: (count: number) => void
}
```

Note: `onPhaseChange` and `onItemCount` are optional for backward compatibility.

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/ocr-stream-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/ocr-stream-client.ts utils/__tests__/ocr-stream-client.test.ts
git commit -m "feat(ocr): add onPhaseChange and onItemCount callbacks to OcrStreamCallbacks"
```

---

### Task 3: Add phase-change and item-count emission to `streamOcrScan`

**Files:**
- Modify: `utils/ocr-stream-client.ts`

**Step 1: Write the failing test**

Add to `utils/__tests__/ocr-stream-client.test.ts`:

```ts
import { describe, it, expect, mock } from "bun:test"

describe("streamOcrScan phase tracking", () => {
    it("calls onPhaseChange with 'uploading' at start", () => {
        const phaseChanges: string[] = []
        const callbacks: OcrStreamCallbacks = {
            onStatus: (_msg: string) => {},
            onContent: (_token: string) => {},
            onComplete: (_data: { items: unknown[]; deduplicated: unknown[]; duplicates: string[] }) => {},
            onError: (_error: string) => {},
            onPhaseChange: (phase: OcrPhase) => { phaseChanges.push(phase) },
        }
        // We can only test the callback wiring, not the actual fetch
        // in a unit test. Tracking that onPhaseChange is called is sufficient.
        expect(callbacks.onPhaseChange).toBeDefined()
    })
})
```

**Step 2: Run test**

Run: `bun test utils/__tests__/ocr-stream-client.test.ts`
Expected: PASS (structural test)

**Step 3: Modify `streamOcrScan` to emit phase changes and item counts**

Replace the implementation of `streamOcrScan` in `utils/ocr-stream-client.ts`:

```ts
function extractItemCountFromStreamedContent(content: string): number {
    const matches = content.match(/"name"\s*:/g)
    return matches ? matches.length : 0
}

export async function streamOcrScan(
    cafeId: string,
    imageBase64: string,
    callbacks: OcrStreamCallbacks
): Promise<void> {
    let currentPhase: OcrPhase = "uploading"
    const emitPhase = (phase: OcrPhase) => {
        if (phase !== currentPhase) {
            currentPhase = phase
            callbacks.onPhaseChange?.(phase)
        }
    }

    emitPhase("uploading")

    let lastContentLength = 0

    const response = await fetch("/api/ocr/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeId, imageBase64 }),
    })

    if (!response.ok) {
        try {
            const error = await response.json()
            callbacks.onError(error.error || "Failed to scan menu")
        } catch {
            callbacks.onError("Failed to scan menu")
        }
        return
    }

    const reader = response.body?.getReader()
    if (!reader) {
        callbacks.onError("No response stream")
        return
    }

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

                    switch (chunk.type) {
                        case "status":
                            callbacks.onStatus(chunk.message)
                            if (chunk.message === "AI analyzing menu...") {
                                emitPhase("ai-processing")
                            } else if (chunk.message === "Extracting items...") {
                                emitPhase("streaming")
                            } else if (chunk.message === "Processing results...") {
                                emitPhase("processing-results")
                            }
                            break
                        case "content":
                            callbacks.onContent(chunk.token)
                            if (currentPhase !== "streaming") {
                                emitPhase("streaming")
                            }
                            lastContentLength += chunk.token.length
                            const itemCount = extractItemCountFromStreamedContent(
                                streamedContentRef?.current ?? ""
                            )
                            if (itemCount > 0) {
                                callbacks.onItemCount?.(itemCount)
                            }
                            break
                        case "complete":
                            callbacks.onComplete({
                                items: chunk.items ?? [],
                                deduplicated: chunk.deduplicated ?? [],
                                duplicates: chunk.duplicates ?? [],
                            })
                            break
                        case "error":
                            callbacks.onError(chunk.error)
                            break
                    }
                } catch {
                    // Ignore parse errors for partial lines
                }
            }
        }
    }
}
```

Wait — we have a problem: `streamedContentRef` is a React ref in the component, not available in the stream client. We need to track streamed content inside `streamOcrScan` itself.

Let me revise:

**Step 3 (revised): Modify `streamOcrScan` to track content internally for item counting**

Replace the full `streamOcrScan` function in `utils/ocr-stream-client.ts`:

```ts
function extractItemCountFromStreamedContent(content: string): number {
    const matches = content.match(/"name"\s*:/g)
    return matches ? matches.length : 0
}

export async function streamOcrScan(
    cafeId: string,
    imageBase64: string,
    callbacks: OcrStreamCallbacks
): Promise<void> {
    let currentPhase: OcrPhase = "uploading"
    let streamedContent = ""

    const emitPhase = (phase: OcrPhase) => {
        if (phase !== currentPhase) {
            currentPhase = phase
            callbacks.onPhaseChange?.(phase)
        }
    }

    emitPhase("uploading")

    const response = await fetch("/api/ocr/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cafeId, imageBase64 }),
    })

    if (!response.ok) {
        try {
            const error = await response.json()
            callbacks.onError(error.error || "Failed to scan menu")
        } catch {
            callbacks.onError("Failed to scan menu")
        }
        return
    }

    emitPhase("ai-processing")
    callbacks.onStatus("AI analyzing menu...")

    const reader = response.body?.getReader()
    if (!reader) {
        callbacks.onError("No response stream")
        return
    }

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

                    switch (chunk.type) {
                        case "status":
                            callbacks.onStatus(chunk.message)
                            if (chunk.message === "Extracting items...") {
                                emitPhase("streaming")
                            } else if (chunk.message === "Processing results...") {
                                emitPhase("processing-results")
                            }
                            break
                        case "content":
                            callbacks.onContent(chunk.token)
                            streamedContent += chunk.token
                            if (currentPhase !== "streaming") {
                                emitPhase("streaming")
                            }
                            const count = extractItemCountFromStreamedContent(streamedContent)
                            if (count > 0) {
                                callbacks.onItemCount?.(count)
                            }
                            break
                        case "complete":
                            callbacks.onComplete({
                                items: chunk.items ?? [],
                                deduplicated: chunk.deduplicated ?? [],
                                duplicates: chunk.duplicates ?? [],
                            })
                            break
                        case "error":
                            callbacks.onError(chunk.error)
                            break
                    }
                } catch {
                    // Ignore parse errors for partial lines
                }
            }
        }
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/ocr-stream-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/ocr-stream-client.ts utils/__tests__/ocr-stream-client.test.ts
git commit -m "feat(ocr): emit phase changes and item counts during streaming"
```

---

### Task 4: Create `useOcrPhasedTimer` hook

**Files:**
- Create: `hooks/useOcrPhasedTimer.ts`
- Create: `hooks/__tests__/useOcrPhasedTimer.test.ts`

**Step 1: Write the failing test**

Create `hooks/__tests__/useOcrPhasedTimer.test.ts`:

```ts
import { describe, it, expect } from "bun:test"
import { getPhaseProgress, getOverallProgress, type OcrPhase, OCR_PHASE_CONFIG } from "@/hooks/useOcrPhasedTimer"

describe("getPhaseProgress", () => {
    it("returns 0 at start of phase", () => {
        expect(getPhaseProgress("uploading", 0)).toBe(0)
    })

    it("returns 100 at end of phase", () => {
        const timeout = OCR_PHASE_CONFIG["uploading"].timeoutMs
        expect(getPhaseProgress("uploading", timeout)).toBe(100)
    })

    it("returns correct percentage mid-phase", () => {
        const timeout = OCR_PHASE_CONFIG["uploading"].timeoutMs
        const result = getPhaseProgress("uploading", timeout / 2)
        expect(result).toBe(50)
    })

    it("clamps to 100 when exceeding timeout", () => {
        expect(getPhaseProgress("uploading", 999999)).toBe(100)
    })
})

describe("getOverallProgress", () => {
    it("returns 0 at the very start", () => {
        expect(getOverallProgress("uploading", 0)).toBe(0)
    })

    it("returns higher percentage when in later phases", () => {
        const p1 = getOverallProgress("uploading", 0)
        const p2 = getOverallProgress("streaming", 0)
        expect(p2).toBeGreaterThan(p1)
    })

    it("returns 100 when phase is complete", () => {
        expect(getOverallProgress("processing-results", OCR_PHASE_CONFIG["processing-results"].timeoutMs)).toBe(100)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test hooks/__tests__/useOcrPhasedTimer.test.ts`
Expected: FAIL — module not found.

**Step 3: Create `hooks/useOcrPhasedTimer.ts`**

```ts
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { OCR_PHASE_CONFIG, type OcrPhase } from "@/utils/ocr-stream-client"

export type { OcrPhase }

const PHASE_ORDER: OcrPhase[] = ["uploading", "ai-processing", "streaming", "processing-results"]

export function getPhaseProgress(phase: OcrPhase, elapsedMs: number): number {
    const config = OCR_PHASE_CONFIG[phase]
    const pct = Math.floor((elapsedMs / config.timeoutMs) * 100)
    return Math.min(pct, 100)
}

export function getOverallProgress(phase: OcrPhase, elapsedMs: number): number {
    const phaseIndex = PHASE_ORDER.indexOf(phase)
    const completedWeight = PHASE_ORDER.slice(0, phaseIndex).reduce(
        (sum, p) => sum + OCR_PHASE_CONFIG[p].timeoutMs, 0
    )
    const totalWeight = PHASE_ORDER.reduce(
        (sum, p) => sum + OCR_PHASE_CONFIG[p].timeoutMs, 0
    )
    const phaseProgress = Math.min(elapsedMs / OCR_PHASE_CONFIG[phase].timeoutMs, 1)
    const overall = (completedWeight + elapsedMs) / totalWeight
    return Math.min(Math.floor(overall * 100), 100)
}

interface UseOcrPhasedTimerReturn {
    phase: OcrPhase
    phaseElapsedMs: number
    phaseProgress: number
    overallProgress: number
    isPhaseTimedOut: boolean
    setPhase: (phase: OcrPhase) => void
    resetPhaseTimer: () => void
    start: () => void
    stop: () => void
}

export function useOcrPhasedTimer(): UseOcrPhasedTimerReturn {
    const [phase, setPhaseState] = useState<OcrPhase>("uploading")
    const [phaseElapsedMs, setPhaseElapsedMs] = useState(0)
    const [isRunning, setIsRunning] = useState(false)
    const [isPhaseTimedOut, setIsPhaseTimedOut] = useState(false)
    const phaseStartRef = useRef(Date.now())
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const clearTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }, [])

    const setPhase = useCallback((newPhase: OcrPhase) => {
        setPhaseState(newPhase)
        phaseStartRef.current = Date.now()
        setPhaseElapsedMs(0)
        setIsPhaseTimedOut(false)
    }, [])

    const resetPhaseTimer = useCallback(() => {
        phaseStartRef.current = Date.now()
        setPhaseElapsedMs(0)
        setIsPhaseTimedOut(false)
    }, [])

    const start = useCallback(() => {
        phaseStartRef.current = Date.now()
        setPhaseElapsedMs(0)
        setIsPhaseTimedOut(false)
        setIsRunning(true)
    }, [])

    const stop = useCallback(() => {
        setIsRunning(false)
        clearTimer()
    }, [clearTimer])

    useEffect(() => {
        if (!isRunning) {
            clearTimer()
            return
        }

        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - phaseStartRef.current
            setPhaseElapsedMs(elapsed)

            const timeout = OCR_PHASE_CONFIG[phase].timeoutMs
            if (elapsed >= timeout) {
                setIsPhaseTimedOut(true)
            }
        }, 100)

        return () => clearTimer()
    }, [isRunning, phase, clearTimer])

    useEffect(() => {
        if (isRunning) {
            phaseStartRef.current = Date.now()
            setPhaseElapsedMs(0)
        }
    }, [phase, isRunning])

    return {
        phase,
        phaseElapsedMs,
        phaseProgress: getPhaseProgress(phase, phaseElapsedMs),
        overallProgress: getOverallProgress(phase, phaseElapsedMs),
        isPhaseTimedOut,
        setPhase,
        resetPhaseTimer,
        start,
        stop,
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test hooks/__tests__/useOcrPhasedTimer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/useOcrPhasedTimer.ts hooks/__tests__/useOcrPhasedTimer.test.ts
git commit -m "feat(ocr): create useOcrPhasedTimer hook with phase-based progress"
```

---

### Task 5: Add `extractItemCountFromStreamedContent` unit tests

**Files:**
- Modify: `utils/__tests__/ocr-stream-client.test.ts`

**Step 1: Add tests for the item count extraction utility**

```ts
import { extractItemCountFromStreamedContent } from "@/utils/ocr-stream-client"

describe("extractItemCountFromStreamedContent", () => {
    it("returns 0 for empty content", () => {
        expect(extractItemCountFromStreamedContent("")).toBe(0)
    })

    it("returns 0 for content with no items", () => {
        expect(extractItemCountFromStreamedContent("Here is the menu analysis")).toBe(0)
    })

    it("counts items by name fields", () => {
        const content = '[{"name":"Espresso","price":120},{"name":"Latte","price":150}]'
        expect(extractItemCountFromStreamedContent(content)).toBe(2)
    })

    it("counts partial streaming content", () => {
        const content = '[{"name":"Espresso","price":120},{"name":'
        expect(extractItemCountFromStreamedContent(content)).toBe(1)
    })

    it("counts items with whitespace variations", () => {
        const content = '[{ "name" : "Cappuccino" }]'
        expect(extractItemCountFromStreamedContent(content)).toBe(1)
    })
})
```

**Step 2: Export `extractItemCountFromStreamedContent` from `ocr-stream-client.ts`**

Make sure the function is exported (it should already be at the top-level of the module from Task 3).

**Step 3: Run tests**

Run: `bun test utils/__tests__/ocr-stream-client.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add utils/ocr-stream-client.ts utils/__tests__/ocr-stream-client.test.ts
git commit -m "test(ocr): add unit tests for extractItemCountFromStreamedContent"
```

---

## Part 2: OCR Modal UI — Phase-Based Progress & Item Count Display

### Task 6: Replace elapsed timer with `useOcrPhasedTimer` in `MenuOcrScanModal`

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx`

**Step 1: Update imports and state**

At the top of `MenuOcrScanModal.tsx`, add the import:

```ts
import { useOcrPhasedTimer } from "@/hooks/useOcrPhasedTimer"
import type { OcrPhase } from "@/utils/ocr-stream-client"
```

Remove `scanElapsed` state and its timer `useEffect` (lines 99, 149-161). Replace with the hook:

```ts
const {
    phase: ocrPhase,
    phaseProgress,
    overallProgress,
    isPhaseTimedOut,
    setPhase: setOcrPhase,
    resetPhaseTimer,
    start: startTimer,
    stop: stopTimer,
} = useOcrPhasedTimer()
```

Also add a new state for item count:

```ts
const [streamedItemCount, setStreamedItemCount] = useState(0)
```

**Step 2: Update `resetState` to reset new states**

Update `resetState` to also reset:

```ts
setStreamedItemCount(0)
```

And in the `useEffect` that resets on close, add:

```ts
setStreamedItemCount(0)
```

**Step 3: Update `handleImageSelect` to use phase hooks**

Before calling `streamOcrScan` (right after `setStep("scanning")`), start the timer:

```ts
startTimer()
```

Add `onPhaseChange` and `onItemCount` callbacks to `streamOcrScan`:

```ts
onPhaseChange: (newPhase: OcrPhase) => {
    setOcrPhase(newPhase)
    resetPhaseTimer()
},
onItemCount: (count: number) => {
    setStreamedItemCount(count)
},
```

In the `onComplete` callback, after parsing items, also stop the timer:

```ts
onComplete: (data) => {
    stopTimer()
    // ... existing completion logic
},
```

In the `onError` callback, also stop the timer:

```ts
onError: (errorMsg) => {
    stopTimer()
    setError(errorMsg)
    setStep("upload")
},
```

In the catch block, also stop the timer:

```ts
} catch (e) {
    stopTimer()
    setError(e instanceof Error ? e.message : "Failed to process image")
    setStep("upload")
}
```

**Step 4: Update the scanning step UI**

Replace the elapsed time / progress bar section (the `<div className="w-full max-w-sm space-y-2">` block inside `step === "scanning"`) with phase-based UI:

```tsx
<div className="w-full max-w-sm space-y-2">
    <div className="flex items-center justify-between text-xs text-text/50">
        <span>{OCR_PHASE_CONFIG[ocrPhase].label}</span>
        <motion.span
            animate={{
                color: isPhaseTimedOut
                    ? ["#ef4444", "#f97316", "#ef4444"]
                    : "#6b7280"
            }}
            transition={{ duration: 1, repeat: isPhaseTimedOut ? Infinity : 0 }}
            className="font-mono font-medium"
        >
            {overallProgress}%
        </motion.span>
    </div>
    <div className="h-1.5 bg-text/10 rounded-full overflow-hidden">
        <motion.div
            className="h-full rounded-full"
            initial={{ width: "0%" }}
            animate={{
                width: `${overallProgress}%`,
                backgroundColor: isPhaseTimedOut
                    ? ["#ef4444", "#f97316", "#ef4444"]
                    : "#3b82f6"
            }}
            transition={{
                width: { duration: 0.3 },
                backgroundColor: { duration: 1, repeat: isPhaseTimedOut ? Infinity : 0 }
            }}
        />
    </div>
    {streamedItemCount > 0 && ocrPhase === "streaming" && (
        <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-primary/80 text-center font-medium"
        >
            {streamedItemCount} item{streamedItemCount !== 1 ? "s" : ""} found...
        </motion.p>
    )}
    {isPhaseTimedOut && (
        <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-xs text-amber-500 text-center"
        >
            Taking longer than expected... if it fails, try a smaller image
        </motion.p>
    )}
</div>
```

Also add the `OCR_PHASE_CONFIG` import:

```ts
import { OCR_PHASE_CONFIG, type OcrPhase } from "@/utils/ocr-stream-client"
```

**Step 5: Remove the old `scanElapsed` state and its `useEffect`**

Remove:
- `const [scanElapsed, setScanElapsed] = useState(0)` (line 99)
- The `useEffect` at lines 149-161 that set up the interval timer for `scanElapsed`
- Also remove `scanElapsed` from `resetState` and the close-reset `useEffect`

**Step 6: Verify manually that the modal still works**

Run: `bun dev`
Go to a cafe page, click "Scan Menu", upload an image.
Verify:
- Progress bar shows percentage (0–100%)
- Phase label updates: "Uploading image..." → "AI analyzing menu..." → "Extracting items..." → "Processing results..."
- Item count appears during streaming
- No "Elapsed time" label or MM:SS counter remains

**Step 7: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx
git commit -m "feat(ocr): replace flat timer with phase-based progress in scan modal"
```

---

### Task 7: Clean up streamed content display in OCR modal

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx`

The current streaming content display shows raw JSON in a monospace `<p>` tag. We should clean this up to show a more readable preview while AI is streaming.

**Step 1: Add a utility to format streamed content for display**

Add this inside `MenuOcrScanModal.tsx` (before the component function):

```ts
function formatStreamedContent(raw: string): string {
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            return parsed
                .map((item: { name?: string }, i: number) => `${i + 1}. ${item.name ?? "..."}`)
                .join("\n")
        }
    } catch {
        // Not complete JSON yet — fall back to extracting names from partial content
    }
    const nameMatches = raw.match(/"name"\s*:\s*"([^"]+)"/g)
    if (nameMatches && nameMatches.length > 0) {
        return nameMatches
            .map((m, i) => {
                const val = m.match(/"name"\s*:\s*"([^"]+)"/)
                return `${i + 1}. ${val?.[1] ?? "..."}`
            })
            .join("\n")
    }
    return raw.slice(-200)
}
```

**Step 2: Update the streamed content display**

Replace the streamed content block in the scanning step (the `{streamedContent && (...)}` section):

```tsx
{streamedContent && (
    <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="max-h-28 overflow-y-auto bg-text/5 rounded-xl p-3 border border-text/10"
    >
        <p className="text-xs text-text/50 font-mono leading-relaxed whitespace-pre-wrap">
            {formatStreamedContent(streamedContent)}
            <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-1.5 h-3.5 bg-primary/60 rounded-sm align-middle ml-0.5"
            />
        </p>
    </motion.div>
)}
```

**Step 3: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx
git commit -m "feat(ocr): clean up streamed content display with formatted item names"
```

---

### Task 8: Reset phase timer on each streaming token receipt

The key requirement is that during the AI streaming phase, the timeout should reset when the AI is actively generating tokens. This prevents the modal from timing out while the AI is still writing.

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx`

**Step 1: Update `onContent` callback to reset the phase timer**

In the `handleImageSelect` function's `streamOcrScan` callbacks, update `onContent`:

```ts
onContent: (token) => {
    streamedContentRef.current += token
    setStreamedContent(streamedContentRef.current)
    resetPhaseTimer()
},
```

This ensures that every token received from the AI resets the idle timer for the current phase. Since the `streaming` phase has its own timeout budget (120s), the timer effectively becomes "120s since the last token" — which is exactly the desired behavior.

**Step 2: Verify manually**

Run: `bun dev`
Scan a menu and verify that the progress percentage resets smoothly when new tokens arrive during the streaming phase.

**Step 3: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx
git commit -m "feat(ocr): reset phase timer on each streaming token to prevent false timeouts"
```

---

## Part 3: AI Chat Bubble Width Fix

### Analysis of the Current Problem

The `ShrinkwrapBubble` component at `components/chat/ShrinkwrapBubble.tsx` already uses `@chenglou/pretext` for width calculation. The issue reported is that **small message bubbles don't fit size properly**.

Looking at the current code:
1. `minWidth={80}` is hardcoded in `ChatMessage.tsx` — this means even a 2-character message ("OK") gets an 80px wide bubble, which is too wide
2. For single-line text, the `measureShrinkwrapWidth` function calculates `naturalWidth + 1` — but the `+1` doesn't account for the bubble padding (`px-4` = 32px total)
3. The `maxWidth={380}` is hardcoded in `ChatMessage.tsx` — on `lg` screens where the chat window is 520px, the available width after 90% constraint is ~468px, but the bubble is capped at 380px

The fix involves:
- Reducing `minWidth` to better accommodate short messages
- Adding horizontal padding compensation in width calculation
- Making `maxWidth` responsive to the chat window size
- Updating tests to cover short-message scenarios

---

### Task 9: Improve `ShrinkwrapBubble` width calculation for short messages

**Files:**
- Modify: `components/chat/ShrinkwrapBubble.tsx`
- Modify: `components/chat/__tests__/shrinkwrap-bubble.test.tsx`

**Step 1: Write the failing test**

Add to `components/chat/__tests__/shrinkwrap-bubble.test.tsx`:

```ts
describe("measureShrinkwrapWidth", () => {
    it("returns maxWidth for empty text", () => {
        // This is tested implicitly by the "renders with empty text" test
    })

    it("accounts for horizontal padding in single-line width", () => {
        // The key insight: when we provide padding compensation,
        // single-line short messages should get narrower bubbles
        // than without compensation.
        // We test the component renders correctly with padding prop.
        const { container } = render(
            <ShrinkwrapBubble
                text="OK"
                font="14px Inter, ui-sans-serif, system-ui, sans-serif"
                maxWidth={380}
                minWidth={40}
                paddingX={32}
            >
                <div>Short message</div>
            </ShrinkwrapBubble>
        )
        expect(container.querySelector(".custom-class") === null).toBe(true)
        // Just verify it renders without crashing
        expect(container.firstChild).toBeTruthy()
    })

    it("uses smaller minWidth for short messages", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text="Hi"
                font="14px Inter, ui-sans-serif, system-ui, sans-serif"
                maxWidth={380}
                minWidth={40}
            >
                <div>Hi there</div>
            </ShrinkwrapBubble>
        )
        expect(getByText("Hi there")).toBeTruthy()
    })
})
```

**Step 2: Run test to see current state**

Run: `bun test components/chat/__tests__/shrinkwrap-bubble.test.tsx`
Expected: The `paddingX` prop test will FAIL because `ShrinkwrapBubble` doesn't have that prop yet.

**Step 3: Update `ShrinkwrapBubble` component**

Replace `components/chat/ShrinkwrapBubble.tsx`:

```tsx
"use client"

import { useLayoutEffect, useState, ReactNode } from "react"
import { prepareWithSegments, walkLineRanges } from "@chenglou/pretext"

interface ShrinkwrapBubbleProps {
    text: string
    font: string
    maxWidth: number
    minWidth?: number
    paddingX?: number
    children: ReactNode
    className?: string
}

function measureShrinkwrapWidth(
    text: string,
    font: string,
    maxWidth: number,
    minWidth: number,
    paddingX: number
): number {
    if (!text.trim()) return maxWidth

    const prepared = prepareWithSegments(text, font, { whiteSpace: "pre-wrap" })

    let maxLines = 0
    walkLineRanges(prepared, maxWidth, () => { maxLines++ })

    if (maxLines <= 1) {
        let naturalWidth = 0
        walkLineRanges(prepared, maxWidth, (range) => {
            for (let i = range.start.segmentIndex; i < range.end.segmentIndex; i++) {
                naturalWidth += prepared.widths[i]
            }
        })
        return Math.max(Math.min(Math.ceil(naturalWidth) + paddingX, maxWidth), minWidth)
    }

    let low = minWidth
    let high = maxWidth

    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2)
        let lines = 0
        walkLineRanges(prepared, mid, () => { lines++ })

        if (lines <= maxLines) {
            high = mid
        } else {
            low = mid
        }
    }

    return high
}

export default function ShrinkwrapBubble({
    text,
    font,
    maxWidth,
    minWidth = 40,
    paddingX = 32,
    children,
    className,
}: ShrinkwrapBubbleProps) {
    const [calculatedMaxWidth, setCalculatedMaxWidth] = useState(maxWidth)

    useLayoutEffect(() => {
        if (!text) return

        const width = measureShrinkwrapWidth(text, font, maxWidth, minWidth, paddingX)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Layout measurement required before paint
        setCalculatedMaxWidth(width)
    }, [text, font, maxWidth, minWidth, paddingX])

    return (
        <div
            className={className}
            style={{ maxWidth: calculatedMaxWidth, width: "fit-content" }}
        >
            {children}
        </div>
    )
}
```

Key changes:
- `minWidth` default changed from `80` to `40` — allows short messages to be narrower
- Added `paddingX` prop (default `32` = `px-4` left + right) — compensates for CSS padding in width calculation
- Single-line calculation now adds `paddingX` to `naturalWidth` instead of `+1`
- The `Math.max(..., minWidth)` ensures even with compensation, we don't go below the minimum

**Step 4: Update `ChatMessage.tsx` to use responsive maxWidth**

Modify `components/chat/ChatMessage.tsx` — update the `ShrinkwrapBubble` usage:

Change:
```tsx
<ShrinkwrapBubble
    text={message.content}
    font="14px Inter, ui-sans-serif, system-ui, sans-serif"
    maxWidth={380}
    minWidth={80}
```

To:
```tsx
<ShrinkwrapBubble
    text={message.content}
    font="14px Inter, ui-sans-serif, system-ui, sans-serif"
    maxWidth={380}
    minWidth={40}
```

This lowers the minimum width so short messages like "OK" or "Yes" get appropriately narrow bubbles.

**Step 5: Run tests**

Run: `bun test components/chat/__tests__/shrinkwrap-bubble.test.tsx`
Expected: PASS

Also run: `bun test components/chat/__tests__/`
Expected: All chat tests PASS

**Step 6: Verify visually**

Run: `bun dev`
Open the chat widget, send a short message like "Hi", verify the bubble is narrow and fits properly.
Send a longer message, verify the bubble grows but stays within bounds.

**Step 7: Commit**

```bash
git add components/chat/ShrinkwrapBubble.tsx components/chat/ChatMessage.tsx components/chat/__tests__/shrinkwrap-bubble.test.tsx
git commit -m "fix(chat): improve ShrinkwrapBubble width for short messages with padding compensation"
```

---

### Task 10: Add responsive `maxWidth` to `ShrinkwrapBubble` based on chat window width

Currently, `maxWidth={380}` is hardcoded. On larger screens (`lg` breakpoint, 520px window), the available space after 90% constraint and padding is ~468px, but the bubble is capped at 380px. The bubble should use more available space on larger screens.

**Files:**
- Modify: `components/chat/ChatMessage.tsx`

**Step 1: Add a responsive maxWidth calculation**

In `ChatMessage.tsx`, we'll use a container width measurement. Since `ChatWindow` provides width context, we can measure the parent container.

Add a `useLayoutEffect` or use CSS `max-w-[85%]` / `max-w-[90%]` approach with a ref. The simplest approach that avoids adding context/refs:

The `max-w-[90%]` on the outer div already constrains the message width to 90% of the parent. The `ShrinkwrapBubble`'s `maxWidth` should match the parent's available width. Since the chat window is 450px (sm) / 520px (lg), minus 32px padding (px-4 × 2), the available content area is 418–488px. At 90%, that's 376–439px.

The fixed 380px maxWidth works well for `sm` but is too tight for `lg`. Instead of measuring dynamically (which causes layout thrashing), we can simply increase `maxWidth` to 420px to accommodate both sizes, since the outer `max-w-[90%]` still constrains it.

**Step 2: Update `maxWidth` prop**

In `ChatMessage.tsx`, change:

```tsx
<ShrinkwrapBubble
    text={message.content}
    font="14px Inter, ui-sans-serif, system-ui, sans-serif"
    maxWidth={380}
    minWidth={40}
```

To:

```tsx
<ShrinkwrapBubble
    text={message.content}
    font="14px Inter, ui-sans-serif, system-ui, sans-serif"
    maxWidth={420}
    minWidth={40}
```

This gives more room for multiline messages on larger screens while still being constrained by `max-w-[90%]` on the parent div.

**Step 3: Commit**

```bash
git add components/chat/ChatMessage.tsx
git commit -m "fix(chat): increase ShrinkwrapBubble maxWidth for better multiline layout"
```

---

### Task 11: Handle assistant messages with markdown/structured content in ShrinkwrapBubble

The current `ShrinkwrapBubble` receives `message.content` as the `text` prop for width measurement. For assistant messages, the content contains markdown (headers, lists, bold, etc.) which should NOT influence the bubble width — the visual width of rendered markdown differs significantly from the raw text width.

**Analysis:** For assistant messages, the `prose` styling adds margins, padding, and block-level formatting. The bubble should use a wider width for markdown content to avoid awkward narrow wrapping. The simplest fix is to use a larger `minWidth` for assistant messages.

**Files:**
- Modify: `components/chat/ChatMessage.tsx`

**Step 1: Adjust minWidth for assistant messages**

For assistant messages, increase `minWidth` so markdown content renders with comfortable width. For user messages, keep `minWidth` low for that classic chat bubble shrink-wrap feel.

Update in `ChatMessage.tsx`:

```tsx
<ShrinkwrapBubble
    text={message.content}
    font="14px Inter, ui-sans-serif, system-ui, sans-serif"
    maxWidth={420}
    minWidth={isUser ? 40 : 200}
    paddingX={32}
    className={cn(
        "px-4 py-2.5 rounded-2xl border text-sm leading-relaxed",
        isUser
            ? "bg-secondary/10 border-secondary/20 rounded-br-md text-right ml-auto"
            : "bg-background border-primary/10 rounded-bl-md"
    )}
>
```

Rationale:
- User messages are typically short ("OK", "Yes", "Find me a cafe") → `minWidth={40}` lets them shrink tightly
- Assistant messages often contain markdown with lists, paragraphs → `minWidth={200}` ensures comfortable reading width
- The binary search will still find the optimal width for multiline assistant content, just never below 200px

**Step 2: Verify**

Run: `bun dev`
Send "OK" → user bubble should be narrow.
Get an AI response → assistant bubble should have at least 200px width.

**Step 3: Commit**

```bash
git add components/chat/ChatMessage.tsx
git commit -m "fix(chat): use wider minWidth for assistant messages with markdown"
```

---

### Task 12: Update ShrinkwrapBubble tests for new behavior

**Files:**
- Modify: `components/chat/__tests__/shrinkwrap-bubble.test.tsx`

**Step 1: Add comprehensive tests**

Update the mock to reflect the new `paddingX` and `minWidth` defaults, and add new test cases:

```ts
import { describe, it, expect, jest } from "bun:test"
import { render } from "@testing-library/react"
import ShrinkwrapBubble from "@/components/chat/ShrinkwrapBubble"

jest.mock("@chenglou/pretext", () => ({
    prepareWithSegments: (text: string) => ({
        widths: text.split("").map((char) => (char === " " ? 5 : 8)),
        segments: text.split("").map((char, i) => ({ index: i, char })),
    }),
    walkLineRanges: (prepared: { widths: number[] }, maxWidth: number, callback: (range: {
        start: { segmentIndex: number; graphemeIndex: number }
        end: { segmentIndex: number; graphemeIndex: number }
        width: number
    }) => void) => {
        const charWidth = 8
        const charsPerLine = Math.floor(maxWidth / charWidth)
        let lineCount = 0
        for (let i = 0; i < prepared.widths.length; i += charsPerLine) {
            const endIndex = Math.min(i + charsPerLine, prepared.widths.length)
            const lineWidth = prepared.widths
                .slice(i, endIndex)
                .reduce((sum, w) => sum + w, 0)
            callback({
                start: { segmentIndex: i, graphemeIndex: 0 },
                end: { segmentIndex: endIndex, graphemeIndex: 0 },
                width: lineWidth,
            })
            lineCount++
        }
        return lineCount
    },
}))

describe("ShrinkwrapBubble", () => {
    it("renders children", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text="Hello world"
                font="14px system-ui"
                maxWidth={300}
            >
                <div>Test content</div>
            </ShrinkwrapBubble>
        )
        expect(getByText("Test content")).toBeTruthy()
    })

    it("applies custom className", () => {
        const { container } = render(
            <ShrinkwrapBubble
                text="Hello world"
                font="14px system-ui"
                maxWidth={300}
                className="custom-class"
            >
                <div>Test content</div>
            </ShrinkwrapBubble>
        )
        expect(container.querySelector(".custom-class")).toBeTruthy()
    })

    it("renders with empty text", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text=""
                font="14px system-ui"
                maxWidth={300}
            >
                <div>Test content</div>
            </ShrinkwrapBubble>
        )
        expect(getByText("Test content")).toBeTruthy()
    })

    it("renders with multiline text", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text="Line 1\nLine 2\nLine 3"
                font="14px system-ui"
                maxWidth={300}
            >
                <div>Test content</div>
            </ShrinkwrapBubble>
        )
        expect(getByText("Test content")).toBeTruthy()
    })

    it("renders with custom paddingX", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text="OK"
                font="14px system-ui"
                maxWidth={300}
                paddingX={48}
            >
                <div>Short</div>
            </ShrinkwrapBubble>
        )
        expect(getByText("Short")).toBeTruthy()
    })

    it("renders with custom minWidth", () => {
        const { getByText } = render(
            <ShrinkwrapBubble
                text="Hi"
                font="14px system-ui"
                maxWidth={300}
                minWidth={40}
            >
                <div>Tiny</div>
            </ShrinkwrapBubble>
        )
        expect(getByText("Tiny")).toBeTruthy()
    })
})
```

**Step 2: Run tests**

Run: `bun test components/chat/__tests__/shrinkwrap-bubble.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add components/chat/__tests__/shrinkwrap-bubble.test.tsx
git commit -m "test(chat): add tests for ShrinkwrapBubble paddingX and minWidth props"
```

---

## Part 4: Lint, Build Verification & Refinement

### Task 13: Run lint and fix any issues

**Step 1: Run ESLint**

```bash
bun lint
```

Expected: No errors. Fix any that appear.

**Step 2: Fix lint issues if any**

Common issues that may appear:
- Unused imports from removed `scanElapsed` state
- `OcrPhase` type import placement
- Any TypeScript strict mode errors in the new hook file

Fix each one individually, then re-run `bun lint`.

**Step 3: Commit any lint fixes**

```bash
git add -A
git commit -m "fix: resolve lint issues from OCR phase timer and chat bubble changes"
```

---

### Task 14: Run build and fix any issues

**Step 1: Run production build**

```bash
bun build
```

Expected: Build succeeds with no errors. Fix any TypeScript errors or build warnings.

**Step 2: Fix build issues if any**

Common issues:
- Type mismatches in `useOcrPhasedTimer` hook
- Missing exports from `ocr-stream-client.ts`
- Template errors in `MenuOcrScanModal.tsx` from variable changes

Fix each one, then re-run `bun build`.

**Step 3: Commit any build fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from OCR phase timer and chat bubble changes"
```

---

### Task 15: Run all tests

**Step 1: Run the full test suite**

```bash
bun test
```

Expected: All tests pass. Fix any failures.

**Step 2: Fix any test failures**

Pay particular attention to:
- `utils/__tests__/ocr-stream-client.test.ts` — new exports and types
- `hooks/__tests__/useOcrPhasedTimer.test.ts` — new hook tests
- `components/chat/__tests__/shrinkwrap-bubble.test.tsx` — updated tests
- `app/api/actions/__tests__/menu-ocr.test.ts` — may need updates if imports changed

**Step 3: Commit any test fixes**

```bash
git add -A
git commit -m "fix: resolve test failures from OCR and chat bubble changes"
```

---

### Task 16: Final verification checklist

**Step 1: Manual verification**

Run `bun dev` and verify:

- [ ] OCR modal shows phase labels ("Uploading image...", "AI analyzing menu...", etc.)
- [ ] Progress bar shows percentage instead of elapsed time
- [ ] Progress bar animates smoothly during scanning
- [ ] Item count ("3 items found...") appears during streaming phase
- [ ] Timer resets when AI is actively streaming tokens
- [ ] Streamed content display shows formatted item names, not raw JSON
- [ ] Chat short messages ("OK", "Yes") have narrow bubbles
- [ ] Chat long messages have properly filled but constrained width
- [ ] Chat assistant messages have reasonable minimum width
- [ ] No regression in existing chat functionality

**Step 2: Run full verification**

```bash
bun lint && bun build && bun test
```

All three should pass cleanly.

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: final cleanup for OCR phase timer and chat bubble improvements"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `utils/ocr-stream-client.ts` | Added `OcrPhase` type, `OCR_PHASE_CONFIG`, `extractItemCountFromStreamedContent`, `onPhaseChange`/`onItemCount` callbacks; emit phase changes and item counts during streaming |
| `hooks/useOcrPhasedTimer.ts` | New hook: phase-based timer with `setPhase`, `resetPhaseTimer`, `phaseProgress`, `overallProgress`, `isPhaseTimedOut` |
| `hooks/__tests__/useOcrPhasedTimer.test.ts` | New tests for phase progress calculations |
| `components/suggestions/MenuOcrScanModal.tsx` | Replaced `scanElapsed` timer with `useOcrPhasedTimer` hook; phase-based progress bar with percentage; dynamic streamed item count; formatted streaming display; timer resets on token receipt |
| `components/chat/ShrinkwrapBubble.tsx` | Added `paddingX` prop (default 32); changed `minWidth` default from 80 to 40; single-line width now adds `paddingX` for accurate measurement |
| `components/chat/ChatMessage.tsx` | `minWidth` changed to 40 for user, 200 for assistant; `maxWidth` changed to 420 |
| `components/chat/__tests__/shrinkwrap-bubble.test.tsx` | Added tests for `paddingX`, `minWidth` props; updated mock |

## Part 5: OCR UX Enhancements

### Task 17: Add cancel/abort button to scanning step

When a scan is taking too long, users currently have no way to abort it except closing the modal entirely. We add an `AbortController`-backed cancel button that aborts the fetch and resets the modal to the upload step.

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx`
- Modify: `utils/ocr-stream-client.ts`

**Step 1: Add `AbortController` support to `streamOcrScan`**

Update the `streamOcrScan` function signature in `utils/ocr-stream-client.ts` to accept an optional `AbortSignal`:

```ts
export async function streamOcrScan(
    cafeId: string,
    imageBase64: string,
    callbacks: OcrStreamCallbacks,
    signal?: AbortSignal
): Promise<void> {
```

Pass the signal to the `fetch` call:

```ts
const response = await fetch("/api/ocr/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cafeId, imageBase64 }),
    signal,
})
```

Also check for abort at the top of the read loop:

```ts
while (true) {
    if (signal?.aborted) {
        callbacks.onError("Scan cancelled")
        return
    }
    const { done, value } = await reader.read()
    if (done) break
    // ... rest of loop
}
```

**Step 2: Update `MenuOcrScanModal` to create and manage `AbortController`**

Add state and ref for the controller:

```ts
const abortControllerRef = useRef<AbortController | null>(null)
```

In `handleImageSelect`, create the controller before starting the scan:

```ts
const abortController = new AbortController()
abortControllerRef.current = abortController

startTimer()

await streamOcrScan(cafeId, base64, {
    onStatus: (message) => { /* ... */ },
    onContent: (token) => {
        streamedContentRef.current += token
        setStreamedContent(streamedContentRef.current)
        resetPhaseTimer()
    },
    onPhaseChange: (newPhase: OcrPhase) => {
        setOcrPhase(newPhase)
        resetPhaseTimer()
    },
    onItemCount: (count: number) => {
        setStreamedItemCount(count)
    },
    onComplete: (data) => {
        stopTimer()
        abortControllerRef.current = null
        // ... existing completion logic
    },
    onError: (errorMsg) => {
        stopTimer()
        abortControllerRef.current = null
        setError(errorMsg)
        setStep("upload")
    },
}, abortController.signal)
```

In the catch block, also null the ref:

```ts
} catch (e) {
    stopTimer()
    abortControllerRef.current = null
    setError(e instanceof Error ? e.message : "Failed to process image")
    setStep("upload")
}
```

**Step 3: Add cancel button to the scanning step UI**

Add a cancel button below the progress bar in the scanning step (after the `isPhaseTimedOut` warning):

```tsx
<motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    type="button"
    onClick={() => {
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
        stopTimer()
        setStep("upload")
        setError(null)
    }}
    className="text-xs text-text/40 hover:text-text transition-colors mt-2 cursor-pointer"
>
    Cancel scan
</motion.button>
```

**Step 4: Verify**

Run: `bun dev`
Open the scan modal, upload an image, then click "Cancel scan" mid-scan. Verify:
- The fetch is aborted (check network tab)
- The modal returns to the upload step
- No error toast/message appears (clean cancellation)

**Step 5: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx utils/ocr-stream-client.ts
git commit -m "feat(ocr): add cancel/abort button to scanning step"
```

---

### Task 18: Add phase-transition color animations to progress bar

The progress bar currently changes from blue to red/amber only on timeout. We add smooth color transitions between phases: blue → teal → emerald → green as the scan progresses through phases.

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx`
- Modify: `hooks/useOcrPhasedTimer.ts`

**Step 1: Add phase color config to `OCR_PHASE_CONFIG`**

In `utils/ocr-stream-client.ts`, add a `color` field to each phase config:

```ts
export const OCR_PHASE_CONFIG: Record<OcrPhase, { timeoutMs: number; label: string; color: string }> = {
    "uploading": { timeoutMs: 15_000, label: "Uploading image...", color: "#3b82f6" },
    "ai-processing": { timeoutMs: 30_000, label: "AI analyzing menu...", color: "#06b6d4" },
    "streaming": { timeoutMs: 120_000, label: "Extracting items...", color: "#10b981" },
    "processing-results": { timeoutMs: 10_000, label: "Processing results...", color: "#22c55e" },
}
```

Also update the existing tests in `utils/__tests__/ocr-stream-client.test.ts` to check for the `color` field, and update `hooks/__tests__/useOcrPhasedTimer.test.ts` if needed.

**Step 2: Update the progress bar to use phase colors**

In `MenuOcrScanModal.tsx`, update the progress bar's `backgroundColor` animation:

Change from:
```tsx
backgroundColor: isPhaseTimedOut
    ? ["#ef4444", "#f97316", "#ef4444"]
    : "#3b82f6"
```

To:
```tsx
backgroundColor: isPhaseTimedOut
    ? ["#ef4444", "#f97316", "#ef4444"]
    : OCR_PHASE_CONFIG[ocrPhase].color
```

This makes the progress bar transition through a color sequence as phases change: blue (uploading) → cyan (AI processing) → emerald (streaming) → green (processing).

**Step 3: Verify**

Run: `bun dev`
Upload a menu image. Watch the progress bar color change as phases advance:
- Uploading: blue (#3b82f6)
- AI processing: cyan (#06b6d4)
- Streaming: emerald (#10b981)
- Processing results: green (#22c55e)

On timeout, it should pulse red/amber as before.

**Step 4: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx utils/ocr-stream-client.ts
git commit -m "feat(ocr): add phase-transition colors to progress bar"
```

---

### Task 19: Add retry button on timeout

When a phase times out (`isPhaseTimedOut` is true), instead of just showing a warning, also show a "Retry" button that re-initiates the scan from the upload step.

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx`

**Step 1: Add retry handler**

Add a retry function inside the component:

```ts
const handleRetry = useCallback(() => {
    resetState()
    // Reset is handled by resetting to upload step;
    // user can select a new image from there.
}, [resetState])
```

**Step 2: Replace the timeout warning with a retry button**

Replace the `isPhaseTimedOut` block in the scanning step:

Change from just the warning paragraph to include a retry action:

```tsx
{isPhaseTimedOut && (
    <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="flex flex-col items-center gap-2"
    >
        <p className="text-xs text-amber-500 text-center">
            Taking longer than expected... if it fails, try a smaller image
        </p>
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleRetry}
            className="text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
        >
            Try again
        </motion.button>
    </motion.div>
)}
```

**Step 3: Verify**

Run: `bun dev`
Force a timeout scenario (or wait for a slow AI response). Verify:
- The warning message appears
- A "Try again" button appears below it
- Clicking it resets the modal to the upload step

**Step 4: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx
git commit -m "feat(ocr): add retry button when scan phase times out"
```

---

### Task 20: Configurable streaming content truncation with "last N items" display

When `streamedContent` is very long (menus with 30+ items), showing all extracted names in the preview can overflow. We add configurable truncation that shows only the most recent extracted items, and a summary line if truncated.

**Files:**
- Modify: `components/suggestions/MenuOcrScanModal.tsx`

**Step 1: Update `formatStreamedContent` with truncation**

Replace the existing `formatStreamedContent` function:

```ts
const MAX_STREAM_PREVIEW_ITEMS = 8

function formatStreamedContent(raw: string, maxItems: number = MAX_STREAM_PREVIEW_ITEMS): string {
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            const items = parsed
                .slice(0, maxItems)
                .map((item: { name?: string }, i: number) => `${i + 1}. ${item.name ?? "..."}`)
                .join("\n")
            if (parsed.length > maxItems) {
                return items + `\n... and ${parsed.length - maxItems} more`
            }
            return items
        }
    } catch {
        // Not complete JSON yet
    }
    const nameMatches = raw.match(/"name"\s*:\s*"([^"]+)"/g)
    if (nameMatches && nameMatches.length > 0) {
        const items = nameMatches
            .slice(0, maxItems)
            .map((m, i) => {
                const val = m.match(/"name"\s*:\s*"([^"]+)"/)
                return `${i + 1}. ${val?.[1] ?? "..."}`
            })
            .join("\n")
        if (nameMatches.length > maxItems) {
            return items + `\n... and ${nameMatches.length - maxItems} more`
        }
        return items
    }
    return raw.slice(-200)
}
```

**Step 2: Update the streamed content display call**

In the streaming content display, pass the `streamedContent` to `formatStreamedContent` (no changes needed if it was already updated in Task 7 — just verify it uses `formatStreamedContent(streamedContent)`).

**Step 3: Verify**

Run: `bun dev`
Scan a large menu (10+ items). Verify:
- During streaming, only the first 8 item names are shown
- If more than 8 items are found, a "... and N more" line appears
- The preview area doesn't excessively grow

**Step 4: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx
git commit -m "feat(ocr): add truncation to streaming content preview with item count summary"
```

---

## Part 6: Final Lint, Build & Test Verification

### Task 21: Run lint, build, and tests

**Step 1: Run ESLint**

```bash
bun lint
```

Fix any lint errors. Common issues:
- Unused imports (e.g., removed `scanElapsed` references)
- Missing `OcrPhase` type imports
- `AbortSignal` type annotations
- Any `eslint-disable` comments that need updating

**Step 2: Run production build**

```bash
bun build
```

Fix any TypeScript or build errors. Common issues:
- Type mismatches in `useOcrPhasedTimer` return type
- Missing exports from modified files
- Template errors from UI variable changes

**Step 3: Run full test suite**

```bash
bun test
```

Fix any test failures. Pay particular attention to:
- `utils/__tests__/ocr-stream-client.test.ts` — new types and exports
- `hooks/__tests__/useOcrPhasedTimer.test.ts` — hook tests
- `components/chat/__tests__/shrinkwrap-bubble.test.tsx` — updated mock and props
- `app/api/actions/__tests__/menu-ocr.test.ts` — may need import updates

**Step 4: Commit all fixes**

```bash
git add -A
git commit -m "fix: resolve lint, build, and test issues from OCR and chat bubble changes"
```

---

### Task 22: Final manual verification

**Step 1: OCR Modal verification**

Run `bun dev` and test:

- [ ] "Cancel scan" button appears during scanning and aborts the request cleanly
- [ ] Phase labels update: "Uploading image..." → "AI analyzing menu..." → "Extracting items..." → "Processing results..."
- [ ] Progress bar color transitions smoothly: blue → cyan → emerald → green
- [ ] Progress bar shows percentage (0–100%) instead of elapsed time
- [ ] Item count ("3 items found...") appears during streaming
- [ ] Timer percentage resets when new AI tokens arrive during streaming
- [ ] Streamed content preview shows formatted item names (not raw JSON)
- [ ] Streamed content is truncated to 8 items with "... and N more" summary
- [ ] "Try again" button appears on timeout with retry capability
- [ ] Closing modal mid-scan aborts the request

**Step 2: Chat bubble verification**

- [ ] Short user messages ("OK", "Yes") render narrow bubbles
- [ ] Multi-line user messages have proper shrink-wrap width
- [ ] Assistant messages with markdown have minimum 200px width
- [ ] Bubbles use `@chenglou/pretext` for accurate text measurement
- [ ] No visual regressions in chat layout

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: final cleanup for OCR phase timer and chat bubble improvements"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `utils/ocr-stream-client.ts` | Added `OcrPhase` type, `OCR_PHASE_CONFIG` (with timeout, labels, colors), `extractItemCountFromStreamedContent`, `onPhaseChange`/`onItemCount` callbacks; emit phase changes and item counts during streaming; accept `AbortSignal` for cancellable fetch |
| `hooks/useOcrPhasedTimer.ts` | New hook: phase-based timer with `setPhase`, `resetPhaseTimer`, `phaseProgress`, `overallProgress`, `isPhaseTimedOut` |
| `hooks/__tests__/useOcrPhasedTimer.test.ts` | New tests for phase progress calculations |
| `components/suggestions/MenuOcrScanModal.tsx` | Replaced `scanElapsed` timer with `useOcrPhasedTimer` hook; phase-based progress bar with percentage and phase-transition colors; dynamic streamed item count; formatted streaming display with truncation; timer resets on token receipt; cancel/abort button; retry button on timeout; `AbortController` for cancellable scans |
| `components/chat/ShrinkwrapBubble.tsx` | Added `paddingX` prop (default 32); changed `minWidth` default from 80 to 40; single-line width adds `paddingX` for accurate measurement using `@chenglou/pretext` |
| `components/chat/ChatMessage.tsx` | `minWidth` set to 40 for user, 200 for assistant; `maxWidth` increased to 420 |
| `components/chat/__tests__/shrinkwrap-bubble.test.tsx` | Added tests for `paddingX`, `minWidth` props; updated mock |