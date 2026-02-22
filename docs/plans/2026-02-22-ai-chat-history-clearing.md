# AI Chat History Clearing (UI + Local Storage) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clear AI chat history per browser session and once per local day, with a dev-only manual clear control in the chat UI.

**Architecture:** Store chat history in `sessionStorage` (per session) while tracking the last active local day in `localStorage` for daily resets. On load and before saves, compare day keys and clear history when stale. Add a dev-only “Clear history” action in the chat header that clears UI state and storage.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, Bun test runner.

---

## Preflight (do once)
- Per request: no separate worktree; use current workspace.
- Run `bun install` if needed.

---

### Task 1: Add chat history storage helpers (session + daily)

**Files:**
- Create: `utils/chat-history.ts`
- Test: `utils/__tests__/chat-history.test.ts`

**Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, mock } from "bun:test"
import {
    clearChatHistory,
    getLocalDayKey,
    loadChatHistory,
    migrateLegacyChatHistory,
    saveChatHistory,
    shouldClearChatHistory,
} from "@/utils/chat-history"

const localStorageMock = {
    getItem: mock(() => null),
    setItem: mock(() => {}),
    removeItem: mock(() => {}),
}

const sessionStorageMock = {
    getItem: mock(() => null),
    setItem: mock(() => {}),
    removeItem: mock(() => {}),
}

Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true })
Object.defineProperty(global, "sessionStorage", { value: sessionStorageMock, writable: true })

describe("chat history storage", () => {
    beforeEach(() => {
        localStorageMock.getItem.mockClear()
        localStorageMock.setItem.mockClear()
        localStorageMock.removeItem.mockClear()
        sessionStorageMock.getItem.mockClear()
        sessionStorageMock.setItem.mockClear()
        sessionStorageMock.removeItem.mockClear()
    })

    it("builds a stable local day key", () => {
        const date = new Date(2026, 1, 22)
        expect(getLocalDayKey(date)).toBe("2026-02-22")
    })

    it("flags stale history when day changes", () => {
        localStorageMock.getItem.mockReturnValue("2026-02-21")
        expect(shouldClearChatHistory(new Date(2026, 1, 22))).toBe(true)
    })

    it("saves and loads from session storage", () => {
        const messages = [{ id: "1" }]
        saveChatHistory(messages, new Date(2026, 1, 22))
        sessionStorageMock.getItem.mockReturnValue(JSON.stringify(messages))
        expect(loadChatHistory()).toEqual(messages)
    })

    it("migrates legacy local storage history once", () => {
        localStorageMock.getItem.mockImplementation((key: string) =>
            key === "chat-history" ? JSON.stringify([{ id: "legacy" }]) : "2026-02-22"
        )
        migrateLegacyChatHistory()
        expect(sessionStorageMock.setItem).toHaveBeenCalled()
        expect(localStorageMock.removeItem).toHaveBeenCalledWith("chat-history")
    })

    it("clears history across storage", () => {
        clearChatHistory(new Date(2026, 1, 22))
        expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("chat-history")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/__tests__/chat-history.test.ts`
Expected: FAIL (module missing).

**Step 3: Write minimal implementation**

Create `utils/chat-history.ts`:

```ts
const CHAT_HISTORY_KEY = "chat-history"
const CHAT_HISTORY_DAY_KEY = "chat-history-day"

export function getLocalDayKey(date = new Date()): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export function shouldClearChatHistory(date = new Date()): boolean {
    if (typeof window === "undefined") return false
    const current = getLocalDayKey(date)
    const stored = localStorage.getItem(CHAT_HISTORY_DAY_KEY)
    return stored !== null && stored !== current
}

export function saveChatHistory<T>(messages: T[], date = new Date()): void {
    if (typeof window === "undefined") return
    localStorage.setItem(CHAT_HISTORY_DAY_KEY, getLocalDayKey(date))
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages))
}

export function loadChatHistory<T>(): T[] {
    if (typeof window === "undefined") return []
    const raw = sessionStorage.getItem(CHAT_HISTORY_KEY)
    if (!raw) return []
    try {
        return JSON.parse(raw) as T[]
    } catch {
        return []
    }
}

export function clearChatHistory(date = new Date()): void {
    if (typeof window === "undefined") return
    sessionStorage.removeItem(CHAT_HISTORY_KEY)
    localStorage.removeItem(CHAT_HISTORY_KEY)
    localStorage.setItem(CHAT_HISTORY_DAY_KEY, getLocalDayKey(date))
}

export function migrateLegacyChatHistory(): void {
    if (typeof window === "undefined") return
    const legacy = localStorage.getItem(CHAT_HISTORY_KEY)
    if (!legacy) return
    sessionStorage.setItem(CHAT_HISTORY_KEY, legacy)
    localStorage.removeItem(CHAT_HISTORY_KEY)
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/__tests__/chat-history.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add utils/chat-history.ts utils/__tests__/chat-history.test.ts
git commit -m "feat: add chat history storage helpers"
```

---

### Task 2: Wire chat history reset + dev clear button in UI

**Files:**
- Modify: `components/chat/ChatWindow.tsx`
- Test: `components/chat/__tests__/chat-window-location.test.tsx`
- Test: `components/chat/__tests__/chat-history-clear.test.tsx`

**Step 1: Write the failing test**

Create `components/chat/__tests__/chat-history-clear.test.tsx`:

```tsx
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { fireEvent, render, screen } from "@testing-library/react"
import ChatWindow from "@/components/chat/ChatWindow"

const localStorageMock = {
    getItem: mock(() => null),
    setItem: mock(() => {}),
    removeItem: mock(() => {}),
}

const sessionStorageMock = {
    getItem: mock(() => JSON.stringify([{ id: "1", role: "assistant", content: "hi", timestamp: new Date().toISOString() }])),
    setItem: mock(() => {}),
    removeItem: mock(() => {}),
}

Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true })
Object.defineProperty(global, "sessionStorage", { value: sessionStorageMock, writable: true })

mock.module("@/app/api/actions/chat", () => ({
    sendChatMessage: mock(() => Promise.resolve({ success: true, message: "ok", remaining: 9 })),
}))

mock.module("@/hooks/useUserLocation", () => ({
    useUserLocation: mock(() => ({
        location: { city: null, region: null, lat: null, lng: null },
        loading: false,
        error: null,
        permissionState: "unknown",
        isEstimate: false,
        source: null,
        refresh: mock(() => {}),
    })),
}))

describe("ChatWindow history clearing", () => {
    beforeEach(() => {
        sessionStorageMock.getItem.mockClear()
    })

    it("shows dev clear button and clears messages", () => {
        process.env.NODE_ENV = "development"
        render(<ChatWindow remainingMessages={10} onClose={() => {}} />)

        expect(screen.getByText("Clear history")).toBeTruthy()
        fireEvent.click(screen.getByText("Clear history"))
        expect(sessionStorageMock.removeItem).toHaveBeenCalledWith("chat-history")
    })
})
```

Update `components/chat/__tests__/chat-window-location.test.tsx` to include `sessionStorage` and `localStorage` mocks (if missing) so the component can mount without errors.

**Step 2: Run test to verify it fails**

Run: `bun test components/chat/__tests__/chat-history-clear.test.tsx`
Expected: FAIL (button/clearing missing).

**Step 3: Write minimal implementation**

Update `components/chat/ChatWindow.tsx`:

```ts
import {
    clearChatHistory,
    loadChatHistory,
    migrateLegacyChatHistory,
    saveChatHistory,
    shouldClearChatHistory,
} from "@/utils/chat-history"
```

```ts
const isDev = process.env.NODE_ENV === "development"
```

```ts
const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return []
    if (shouldClearChatHistory()) {
        clearChatHistory()
        return []
    }
    migrateLegacyChatHistory()
    const saved = loadChatHistory<Message>()
    return saved.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
})
```

```ts
useEffect(() => {
    if (typeof window === "undefined") return
    if (messages.length > 0) {
        saveChatHistory(messages)
        return
    }
    clearChatHistory()
}, [messages])
```

Add a dev-only handler and button in the header:

```ts
const handleClearHistory = useCallback(() => {
    setMessages([])
    setError(null)
    setPendingMessage(null)
    clearChatHistory()
}, [])
```

```tsx
{isDev && (
    <button
        type="button"
        onClick={handleClearHistory}
        className="text-xs text-text/60 hover:text-text transition-colors"
    >
        Clear history
    </button>
)}
```

**Step 4: Run test to verify it passes**

Run: `bun test components/chat/__tests__/chat-history-clear.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/chat/ChatWindow.tsx components/chat/__tests__/chat-history-clear.test.tsx components/chat/__tests__/chat-window-location.test.tsx
git commit -m "feat: clear chat history per session and daily"
```

---

### Task 3: Add a daily reset timer for long-lived sessions

**Files:**
- Modify: `components/chat/ChatWindow.tsx`

**Step 1: Write the failing test**

Skip automated test (timer logic). Manual verification only.

**Step 2: Run test to verify it fails**

Skip.

**Step 3: Write minimal implementation**

Add a `useEffect` that schedules a clear at the next local midnight:

```ts
useEffect(() => {
    if (typeof window === "undefined") return
    const now = new Date()
    const nextMidnight = new Date(now)
    nextMidnight.setHours(24, 0, 0, 0)
    const timeoutMs = nextMidnight.getTime() - now.getTime()

    const timeout = window.setTimeout(() => {
        clearChatHistory()
        setMessages([])
    }, timeoutMs)

    return () => window.clearTimeout(timeout)
}, [])
```

**Step 4: Run test to verify it passes**

Skip.

**Step 5: Commit**

```bash
git add components/chat/ChatWindow.tsx
git commit -m "feat: reset chat history at local midnight"
```

---

## Manual QA checklist
- Open chat, send a message, reload page: history persists in the same tab/session.
- Close the tab and reopen: history is cleared.
- Manually set system date forward a day or wait for local midnight: history clears and day key updates.
- In development, the “Clear history” control appears and clears UI + storage.

---

Plan complete and saved to `docs/plans/2026-02-22-ai-chat-history-clearing.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints

Which approach?
