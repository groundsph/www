# Landing Quick Check-In + Search Chat Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent duplicate same-day landing check-ins by verifying status when opening the group check-in modal, and integrate the global search UI with Grounds AI chat.

**Architecture:** Add a visit-status refresh flow in `HeroLocationCheckIn` that checks today's check-in before opening the modal and updates both modal props and the landing prompt. Add a lightweight chat event bus that can open/prefill the AI chat widget and wire search results to emit that event. Work in the current branch (no separate worktree) per request.

**Tech Stack:** Next.js App Router, React, Bun, Drizzle, Zod, Tailwind, motion/react.

---

### Task 1: Landing check-in gate + modal message

**Files:**
- Create: `components/checkin/__tests__/hero-location-checkin.test.tsx`
- Modify: `components/checkin/HeroLocationCheckIn.tsx`
- Modify: `components/checkin/GroupCheckInModal.tsx`
- Test: `components/checkin/__tests__/hero-location-checkin.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, mock } from "bun:test"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import HeroLocationCheckIn from "@/components/checkin/HeroLocationCheckIn"

const mockGetTodayCheckIn = mock(async () => ({
  id: "visit-1",
  visitedAt: new Date().toISOString(),
  companions: [],
}))

mock.module("@/app/api/actions/profile", () => ({
  getTodayCheckIn: mockGetTodayCheckIn,
  recordVisit: mock(async () => ({ success: true, visitCount: 1, isFirstVisit: true })),
  getVisitCount: mock(async () => ({ count: 2 })),
  updateCheckIn: mock(async () => ({ success: true, visitCount: 2, isFirstVisit: false })),
}))

mock.module("@/components/checkin/GroupCheckInModal", () => ({
  default: () => null,
}))

mock.module("@/components/layout/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}))

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mock(() => {}) }),
}))

describe("HeroLocationCheckIn", () => {
  it("refreshes visit status before opening modal", async () => {
    render(
      <HeroLocationCheckIn
        nearbyCafe={{ id: "cafe-1", slug: "cafe-1", name: "Cafe One" } as any}
      />
    )

    fireEvent.click(screen.getByText("Check In"))

    await waitFor(() => {
      expect(mockGetTodayCheckIn).toHaveBeenCalled()
    })

    expect(screen.getByText(/Checked in today/i)).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/checkin/__tests__/hero-location-checkin.test.tsx`

Expected: FAIL because the check-in status is not refreshed on modal open.

**Step 3: Write minimal implementation**

```tsx
type Companion = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

const [visitedToday, setVisitedToday] = useState(false)
const [visitCount, setVisitCount] = useState(0)
const [initialCompanions, setInitialCompanions] = useState<Companion[]>([])
const [isCheckingStatus, setIsCheckingStatus] = useState(false)

const refreshVisitStatus = useCallback(async () => {
  if (!nearbyCafe || !user) {
    setHasCheckedIn(false)
    setVisitedToday(false)
    setVisitCount(0)
    setInitialCompanions([])
    return
  }

  setIsCheckingStatus(true)
  try {
    const [{ getTodayCheckIn, getVisitCount }] = await Promise.all([
      import("@/app/api/actions/profile"),
      import("@/app/api/actions/profile"),
    ])
    const [todayCheckIn, countResult] = await Promise.all([
      getTodayCheckIn(nearbyCafe.id),
      getVisitCount(nearbyCafe.id),
    ])
    setVisitedToday(!!todayCheckIn)
    setHasCheckedIn(!!todayCheckIn)
    setInitialCompanions(todayCheckIn?.companions ?? [])
    setVisitCount(countResult.count ?? 0)
  } finally {
    setIsCheckingStatus(false)
  }
}, [nearbyCafe, user])

const handleCheckInClick = async () => {
  if (!user) {
    router.push("/auth?callbackUrl=/cafes/" + nearbyCafe.slug)
    return
  }
  await refreshVisitStatus()
  setIsCheckInModalOpen(true)
}

// In the check-in link
<button
  onClick={handleCheckInClick}
  disabled={isCheckingStatus}
  className="font-bold text-primary hover:underline underline-offset-2 transition-all disabled:opacity-60"
>
  {isCheckingStatus ? "Checking..." : "Check In"}
</button>

// Modal props
<GroupCheckInModal
  isOpen={isCheckInModalOpen}
  onClose={() => setIsCheckInModalOpen(false)}
  cafeName={nearbyCafe.name}
  onCheckIn={async (companions) => {
    const result = await recordVisit(nearbyCafe.id, companions)
    if (result?.alreadyVisitedToday) {
      setHasCheckedIn(true)
      setVisitedToday(true)
    }
    return result
  }}
  onUpdateCheckIn={(companions) => updateCheckIn(nearbyCafe.id, companions)}
  visitedToday={visitedToday}
  visitCount={visitCount}
  initialCompanions={initialCompanions}
  onComplete={() => {
    setIsCheckInModalOpen(false)
    setHasCheckedIn(true)
    setVisitedToday(true)
  }}
/>
```

Update `components/checkin/GroupCheckInModal.tsx` to show a message for already-visited results:

```tsx
{result?.alreadyVisitedToday && (
  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
    <p className="text-sm text-amber-700 dark:text-amber-300">
      You&apos;ve already checked in here today! Check back tomorrow.
    </p>
  </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `bun test components/checkin/__tests__/hero-location-checkin.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add components/checkin/HeroLocationCheckIn.tsx components/checkin/GroupCheckInModal.tsx components/checkin/__tests__/hero-location-checkin.test.tsx
git commit -m "fix: gate landing check-in on todays visit"
```

---

### Task 2: Chat event bus for open/prefill

**Files:**
- Create: `components/chat/__tests__/chat-widget-open.test.tsx`
- Modify: `utils/chat-events.ts`
- Modify: `components/chat/ChatWidget.tsx`
- Modify: `components/chat/ChatWindow.tsx`
- Modify: `components/chat/ChatCrawlPreview.tsx`
- Test: `components/chat/__tests__/chat-widget-open.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, mock } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import { emitChatEvent } from "@/utils/chat-events"
import { ChatWidget } from "@/components/chat/ChatWidget"

mock.module("@/components/chat/ChatWindow", () => ({
  default: () => <div>ChatWindow</div>,
}))

describe("ChatWidget", () => {
  it("opens when chat open event is emitted", async () => {
    render(<ChatWidget />)
    emitChatEvent({ type: "open", message: "hello" })

    await waitFor(() => {
      expect(screen.getByText("ChatWindow")).toBeDefined()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test components/chat/__tests__/chat-widget-open.test.tsx`

Expected: FAIL because chat events do not support open/prefill.

**Step 3: Write minimal implementation**

```ts
// utils/chat-events.ts
export type ChatEvent =
  | { type: "close" }
  | { type: "open"; message?: string; autoSend?: boolean }

const listeners = new Set<(event: ChatEvent) => void>()

export function subscribeChatEvents(listener: (event: ChatEvent) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitChatEvent(event: ChatEvent) {
  for (const listener of listeners) listener(event)
}
```

```tsx
// components/chat/ChatWidget.tsx
const [prefillMessage, setPrefillMessage] = useState<string | null>(null)
const [autoSend, setAutoSend] = useState(false)

useEffect(() => {
  const unsubscribe = subscribeChatEvents((event) => {
    if (event.type === "open") {
      setPrefillMessage(event.message ?? null)
      setAutoSend(event.autoSend ?? false)
      setIsOpen(true)
      return
    }
    if (event.type === "close") {
      setIsOpen(false)
    }
  })
  return () => unsubscribe()
}, [])

<ChatWindow
  remainingMessages={remainingMessages}
  onClose={() => setIsOpen(false)}
  prefillMessage={prefillMessage ?? undefined}
  autoSend={autoSend}
/>
```

```tsx
// components/chat/ChatWindow.tsx
interface ChatWindowProps {
  remainingMessages: number
  onClose: () => void
  prefillMessage?: string
  autoSend?: boolean
}

useEffect(() => {
  if (!prefillMessage) return
  setInput((prev) => (prev.trim() ? prev : prefillMessage))
}, [prefillMessage])

useEffect(() => {
  if (!autoSend || !prefillMessage) return
  if (input.trim()) return
  setTimeout(() => {
    const form = document.querySelector("#ai-chat-widget form") as HTMLFormElement | null
    form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
  }, 0)
}, [autoSend, prefillMessage, input])

// ChatWindow close subscription
useEffect(() => {
  const unsubscribe = subscribeChatEvents((event) => {
    if (event.type === "close") onClose()
  })
  return () => unsubscribe()
}, [onClose])
```

Update call sites to new event shape:

```ts
emitChatEvent({ type: "close" })
```

**Step 4: Run test to verify it passes**

Run: `bun test components/chat/__tests__/chat-widget-open.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add utils/chat-events.ts components/chat/ChatWidget.tsx components/chat/ChatWindow.tsx components/chat/ChatCrawlPreview.tsx components/chat/__tests__/chat-widget-open.test.tsx
git commit -m "feat: support chat open events"
```

---

### Task 3: Search -> AI chat bridge

**Files:**
- Modify: `utils/types/search.ts`
- Modify: `components/search/search-utils.ts`
- Modify: `components/search/SearchResults.tsx`
- Modify: `components/search/SearchModal.tsx`
- Modify: `utils/hooks/useSearch.ts`
- Modify: `utils/search-index.ts`
- Modify: `components/search/__tests__/search-utils.test.ts`
- Create: `components/search/__tests__/search-modal-chat.test.tsx`
- Test: `components/search/__tests__/search-utils.test.ts`
- Test: `components/search/__tests__/search-modal-chat.test.tsx`

**Step 1: Write the failing tests**

```ts
// components/search/__tests__/search-utils.test.ts
import { describe, it, expect } from "bun:test"
import { buildChatResult, getResultIcon } from "@/components/search/search-utils"

describe("search utils", () => {
  it("maps chat icon", () => {
    expect(getResultIcon("chat")).toBe("Sparkles")
  })

  it("builds chat result for normal queries", () => {
    const result = buildChatResult("best cafes in cebu")
    expect(result?.type).toBe("chat")
  })

  it("skips chat result for quick action prefixes", () => {
    expect(buildChatResult(">map")).toBeNull()
    expect(buildChatResult("@user")).toBeNull()
  })
})
```

```tsx
// components/search/__tests__/search-modal-chat.test.tsx
import { describe, it, expect, mock } from "bun:test"
import { fireEvent, render, screen } from "@testing-library/react"
import { SearchModal } from "@/components/search/SearchModal"

const mockEmit = mock(() => {})

mock.module("@/utils/chat-events", () => ({
  emitChatEvent: mockEmit,
}))

mock.module("@/utils/hooks/useSearch", () => ({
  useSearch: () => ({
    query: "best cafes",
    setQuery: mock(() => {}),
    results: [
      {
        id: "chat-ask",
        type: "chat",
        title: "Ask Grounds AI",
        subtitle: "Ask about \"best cafes\"",
        href: "#",
        priority: 100,
      },
    ],
    isLoading: false,
  }),
}))

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mock(() => {}) }),
}))

describe("SearchModal", () => {
  it("emits chat open event when chat result is selected", () => {
    render(<SearchModal isOpen onClose={mock(() => {})} />)

    fireEvent.click(screen.getByText("Ask Grounds AI"))

    expect(mockEmit).toHaveBeenCalledWith({ type: "open", message: "best cafes" })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test components/search/__tests__/search-utils.test.ts components/search/__tests__/search-modal-chat.test.tsx`

Expected: FAIL because chat results and events are not wired up yet.

**Step 3: Write minimal implementation**

```ts
// utils/types/search.ts
export type SearchResultType = "page" | "cafe" | "user" | "action" | "blog" | "crawl" | "collection" | "event" | "chat"
```

```ts
// components/search/search-utils.ts
import { SearchResult } from "@/utils/types/search"

export function buildChatResult(query: string): SearchResult | null {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 2) return null
  if (trimmed.startsWith(">") || trimmed.startsWith("@")) return null

  return {
    id: "chat-ask",
    type: "chat",
    title: "Ask Grounds AI",
    subtitle: `Ask about "${trimmed}"`,
    href: "#",
    priority: 100,
  }
}

export function getResultIcon(type: string): string {
  switch (type) {
    case "chat": return "Sparkles"
    // existing cases...
  }
}
```

```tsx
// components/search/SearchResults.tsx
import { Sparkles } from "lucide-react"

const iconMap = { FileText, Coffee, User, Zap, MapIcon, Layers, Calendar, Sparkles }

const groupOrder = ["chat", "action", "page", "cafe", "user", "blog", "crawl", "collection", "event"]
const groupLabels: Record<string, string> = {
  chat: "Grounds AI",
  action: "Quick Actions",
  page: "Pages",
  cafe: "Cafes",
  user: "Users",
  blog: "Blogs",
  crawl: "Crawls",
  collection: "Collections",
  event: "Events",
}
```

```tsx
// components/search/SearchModal.tsx
import { emitChatEvent } from "@/utils/chat-events"

const handleSelect = useCallback((result: SearchResult) => {
  if (result.type === "chat") {
    emitChatEvent({ type: "open", message: query.trim() })
    onClose()
    return
  }
  router.push(result.href)
  onClose()
}, [router, onClose, query])
```

```ts
// utils/hooks/useSearch.ts
import { buildChatResult } from "@/components/search/search-utils"

const searchResults = await globalSearch(searchQuery)
const chatResult = buildChatResult(searchQuery)
setResults(chatResult ? [chatResult, ...searchResults] : searchResults)
```

```ts
// utils/search-index.ts
export const quickActionHelp: QuickAction[] = [
  { prefix: ">", description: "Quick actions", example: ">submit, >map" },
  { prefix: "@", description: "Search users", example: "@username" },
  { prefix: "?", description: "Ask Grounds AI", example: "?best cafes in cebu" },
]
```

**Step 4: Run tests to verify they pass**

Run: `bun test components/search/__tests__/search-utils.test.ts components/search/__tests__/search-modal-chat.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add utils/types/search.ts components/search/search-utils.ts components/search/SearchResults.tsx components/search/SearchModal.tsx utils/hooks/useSearch.ts utils/search-index.ts components/search/__tests__/search-utils.test.ts components/search/__tests__/search-modal-chat.test.tsx
git commit -m "feat: bridge search results to chat"
```

---

### Task 4: Lint and build verification

**Files:**
- Modify: any files flagged by lint/build

**Step 1: Run lint**

Run: `bun lint`

Expected: No warnings or errors.

**Step 2: Fix lint issues (if any)**

Apply targeted fixes in the files reported by ESLint, then re-run `bun lint` until clean.

**Step 3: Run build**

Run: `bun build`

Expected: Successful build with no warnings.

**Step 4: Fix build issues (if any)**

Apply fixes for build warnings/failures, then re-run `bun build` until clean.

**Step 5: Commit**

```bash
git add <files-touched>
git commit -m "chore: fix lint/build issues"
```

---

## Potential Improvements (Optional)

- Reuse `useCafeActions` inside `HeroLocationCheckIn` to avoid duplicated visit/companion fetching logic and keep consistency with cafe pages.
- Add a small inline loading state in the hero prompt while status check is in flight to reduce perceived delay.
- Consider auto-sending the chat prompt when the search user selects the AI result (behind a flag).
- Add a basic error message in `GroupCheckInModal` for non-success results besides `alreadyVisitedToday`.
