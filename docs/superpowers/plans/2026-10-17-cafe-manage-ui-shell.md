# Cafe Management UI Shell Implementation Plan (Plan B of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all four cafe management surfaces one shared navigation shell — segmented pill tabs with count/dirty badges, a sticky action bar with save state, consistent toasts and confirm dialogs, an unsaved-changes guard, and shared form primitives — without restructuring the internals of the two large listing files.

**Architecture:** Presentation is extracted into small, props-only units (`SegmentedTabs`, `EditorShell`, `EditorHeader`, `ConfirmDialog`, form primitives) that own no data. `CafeEditor` and `CafeEdit` keep owning their data and save logic and compose those units; Plan A's `useCafeImages` already owns image state, so this plan never touches persistence. The admin listing and owner hub swap only their hand-rolled tab strip for `SegmentedTabs`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4 tokens (`primary`, `accent`, `tertiary`, `background`, `text`), `motion/react`, `lucide-react`, `date-fns`, `bun test` + `@testing-library/react` (JSDOM preloaded).

**Spec:** `docs/superpowers/specs/2026-10-17-cafe-manage-ui-images-design.md` §4.1-4.3, §4.6 (ConfirmDialog), §7
**Depends on:** Plan A (`docs/superpowers/plans/2026-10-17-cafe-image-pipeline-and-ocr.md`) — it creates `useCafeImages` and `useImageUploadQueue`, which Task 7 and Task 8 of this plan wire into the editors. **Do not start Task 7 or 8 before Plan A is complete.**
**Branch:** `feat/cafe-manage-ui-images` (same PR; Plan B commits continue on it)

**Scope guard:** `CafesManagement.tsx` (2036 lines) and `CafeManagement.tsx` (2340 lines) get their tab strip and empty/loading states changed and nothing else. Do not extract their tabs into files, do not reorganise their internals, do not change their server actions.

---

## File map (Plan B)

| File | Responsibility | Action |
|---|---|---|
| `components/ui/SegmentedTabs.tsx` | Tab strip: pills, badges, dirty dots, keyboard nav, a11y | create |
| `components/ui/ConfirmDialog.tsx` | Promise-friendly confirm dialog (Esc, focus, destructive variant) | create |
| `hooks/useConfirm.tsx` | Promise-based `confirm()` plus the dialog node to render | create |
| `hooks/useUnsavedChanges.ts` | `beforeunload` guard while dirty | create |
| `components/ui/SectionCard.tsx` | Titled card wrapper for form sections | create |
| `components/ui/TextField.tsx` | Labelled text input with error/hint | create |
| `components/ui/SelectField.tsx` | Labelled select | create |
| `components/ui/ToggleRow.tsx` | Boolean switch row | create |
| `components/ui/EmptyState.tsx` | Icon + message + optional action | create |
| `components/ui/Skeleton.tsx` | Pulse placeholder block | create |
| `components/cafe-editor/EditorShell.tsx` | Sticky header + tabs + content + sticky action bar | create |
| `components/cafe-editor/EditorHeader.tsx` | Cafe title, status chips, quick-action slot | create |
| `components/cafe-editor/index.ts` | Export the two new components | modify |
| `components/manage/CafeEditor.tsx` | Adopt the shell, toasts, confirm, unsaved guard | modify |
| `components/owner/CafeEdit.tsx` | Same, minus the admin quick actions | modify |
| `components/cafe-editor/ContactSection.tsx`, `LocationSection.tsx` | Optional primitive adoption (only if the diff stays mechanical) | modify |
| `app/manage/preview/[id]/page.tsx` | Fix the dead `/admin` redirect target | modify |
| `components/manage/CafesManagement.tsx` | Tab strip swap, empty state | modify |
| `components/owner/CafeManagement.tsx` | Tab strip swap, empty state | modify |

---

## Task 1: `SegmentedTabs`

**Files:**
- Create: `components/ui/SegmentedTabs.tsx`
- Test: `components/ui/__tests__/SegmentedTabs.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/ui/__tests__/SegmentedTabs.test.tsx`:

```tsx
import { describe, it, expect, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"

mock.module("next/link", () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
}))

import SegmentedTabs from "@/components/ui/SegmentedTabs"

const items = [
    { id: "basic", label: "Basic" },
    { id: "images", label: "Images", badge: 3, dirty: true },
    { id: "location", label: "Location", disabled: true },
]

describe("SegmentedTabs", () => {
    it("exposes a tablist with aria-selected on the active tab", () => {
        const { container } = render(
            <SegmentedTabs items={items} value="basic" onChange={() => {}} ariaLabel="Cafe sections" />
        )

        const tablist = container.querySelector("[role='tablist']")
        expect(tablist?.getAttribute("aria-label")).toBe("Cafe sections")

        const tabs = container.querySelectorAll("[role='tab']")
        expect(tabs).toHaveLength(3)
        expect(tabs[0].getAttribute("aria-selected")).toBe("true")
        expect(tabs[1].getAttribute("aria-selected")).toBe("false")
    })

    it("selects the next tab on ArrowRight and skips disabled tabs", () => {
        const changes: string[] = []
        const { container } = render(
            <SegmentedTabs items={items} value="images" onChange={(id) => changes.push(id)} ariaLabel="Cafe sections" />
        )

        fireEvent.keyDown(container.querySelector("[role='tablist']")!, { key: "ArrowRight" })

        // location is disabled, so it is skipped
        expect(changes).toEqual(["basic"])
    })

    it("selects the first tab on Home and the last enabled tab on End", () => {
        const changes: string[] = []
        const { container } = render(
            <SegmentedTabs items={items} value="basic" onChange={(id) => changes.push(id)} ariaLabel="Cafe sections" />
        )

        fireEvent.keyDown(container.querySelector("[role='tablist']")!, { key: "End" })
        expect(changes).toEqual(["images"])
    })

    it("renders a count badge and a dirty dot", () => {
        const { container } = render(
            <SegmentedTabs items={items} value="basic" onChange={() => {}} ariaLabel="Cafe sections" />
        )

        expect(container.textContent).toContain("3")
        expect(container.querySelector("[data-dirty='true']")).toBeTruthy()
    })

    it("does not call onChange for a disabled tab click", () => {
        const changes: string[] = []
        const { container } = render(
            <SegmentedTabs items={items} value="basic" onChange={(id) => changes.push(id)} ariaLabel="Cafe sections" />
        )

        fireEvent.click(container.querySelectorAll("[role='tab']")[2])

        expect(changes).toEqual([])
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test components/ui/__tests__/SegmentedTabs.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/SegmentedTabs`.

- [ ] **Step 3: Implement**

Create `components/ui/SegmentedTabs.tsx`:

```tsx
"use client"

import { useRef } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/utils/cn"
import { getColorClasses, type ColorScheme } from "@/utils/hooks/cafe-form"

export interface SegmentedTabItem {
    id: string
    label: string
    icon?: LucideIcon
    /** Count badge, e.g. pending submissions. Hidden when 0. */
    badge?: string | number
    /** Unsaved-changes dot. */
    dirty?: boolean
    /** Keeps the existing "needs attention" tint from the admin listing. */
    attention?: "amber" | "purple"
    disabled?: boolean
}

export interface SegmentedTabsProps {
    items: SegmentedTabItem[]
    value: string
    onChange: (id: string) => void
    ariaLabel: string
    colorScheme?: ColorScheme
    /**
     * "subtle" is the editor look (tinted active pill on a tertiary track).
     * "solid" keeps the admin listing's solid active pill.
     */
    variant?: "subtle" | "solid"
    size?: "sm" | "md"
    className?: string
}

const ATTENTION_CLASSES: Record<"amber" | "purple", string> = {
    amber: "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30",
    purple: "bg-purple-500/20 text-purple-700 hover:bg-purple-500/30",
}

export default function SegmentedTabs({
    items,
    value,
    onChange,
    ariaLabel,
    colorScheme = "accent",
    variant = "subtle",
    size = "md",
    className,
}: SegmentedTabsProps) {
    const colors = getColorClasses(colorScheme)
    const listRef = useRef<HTMLDivElement>(null)

    const enabledIndexes = items
        .map((item, index) => (item.disabled ? -1 : index))
        .filter((index) => index >= 0)

    const selectAt = (index: number) => {
        const item = items[index]
        if (!item || item.disabled) return
        onChange(item.id)
        const node = listRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")[index]
        node?.focus()
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const currentIndex = items.findIndex((item) => item.id === value)
        if (currentIndex < 0 || enabledIndexes.length === 0) return

        const positionInEnabled = enabledIndexes.indexOf(currentIndex)

        switch (event.key) {
            case "ArrowRight": {
                event.preventDefault()
                const next = enabledIndexes[(positionInEnabled + 1) % enabledIndexes.length]
                selectAt(next)
                break
            }
            case "ArrowLeft": {
                event.preventDefault()
                const previous = enabledIndexes[(positionInEnabled - 1 + enabledIndexes.length) % enabledIndexes.length]
                selectAt(previous)
                break
            }
            case "Home": {
                event.preventDefault()
                selectAt(enabledIndexes[0])
                break
            }
            case "End": {
                event.preventDefault()
                selectAt(enabledIndexes[enabledIndexes.length - 1])
                break
            }
            default:
                break
        }
    }

    const padding = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"

    return (
        <div
            ref={listRef}
            role='tablist'
            aria-label={ariaLabel}
            onKeyDown={handleKeyDown}
            className={cn(
                "flex gap-1 overflow-x-auto rounded-lg p-1",
                variant === "subtle" ? "bg-tertiary/40" : "bg-transparent p-0",
                className
            )}
        >
            {items.map((item, index) => {
                const Icon = item.icon
                const isActive = item.id === value

                const stateClasses = isActive
                    ? variant === "subtle"
                        ? `${colors.bgLight} ${colors.text}`
                        : "bg-primary text-white"
                    : item.attention
                      ? ATTENTION_CLASSES[item.attention]
                      : variant === "subtle"
                        ? "text-text/70 hover:bg-text/5"
                        : "bg-tertiary/30 text-text/70 hover:bg-tertiary"

                return (
                    <button
                        key={item.id}
                        role='tab'
                        type='button'
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                        disabled={item.disabled}
                        data-dirty={item.dirty ? "true" : undefined}
                        onClick={() => {
                            if (!item.disabled) onChange(item.id)
                        }}
                        className={cn(
                            "relative flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-md font-medium transition",
                            padding,
                            stateClasses,
                            item.disabled && "cursor-not-allowed opacity-40"
                        )}
                    >
                        {Icon && <Icon className='h-4 w-4' />}
                        {item.label}
                        {item.badge !== undefined && Number(item.badge) > 0 && (
                            <span
                                className={cn(
                                    "ml-0.5 rounded-full px-1.5 py-0.5 text-xs",
                                    isActive && variant === "solid"
                                        ? "bg-white/20 text-white"
                                        : "bg-text/10 text-text/80"
                                )}
                            >
                                {item.badge}
                            </span>
                        )}
                        {item.dirty && (
                            <span
                                aria-hidden='true'
                                className={cn("ml-0.5 h-1.5 w-1.5 rounded-full", colors.bg)}
                            />
                        )}
                        {isActive && index >= 0 && <span className='sr-only'> (selected)</span>}
                    </button>
                )
            })}
        </div>
    )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test components/ui/__tests__/SegmentedTabs.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/SegmentedTabs.tsx components/ui/__tests__/SegmentedTabs.test.tsx
git commit -m "feat(ui): add SegmentedTabs with badges, dirty markers and keyboard nav"
```

---

## Task 2: `ConfirmDialog` and `useConfirm`

**Files:**
- Create: `components/ui/ConfirmDialog.tsx`
- Create: `hooks/useConfirm.tsx`
- Test: `components/ui/__tests__/ConfirmDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/ui/__tests__/ConfirmDialog.test.tsx`:

```tsx
import { describe, it, expect } from "bun:test"
import { render, fireEvent, waitFor } from "@testing-library/react"
import { renderHook, act } from "@testing-library/react"

import ConfirmDialog from "@/components/ui/ConfirmDialog"
import { useConfirm } from "@/hooks/useConfirm"

describe("ConfirmDialog", () => {
    it("renders an accessible modal with the title and description", () => {
        const { container } = render(
            <ConfirmDialog
                open
                title='Remove this image?'
                description='The file will be deleted from storage.'
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        )

        const dialog = container.querySelector("[role='dialog']")
        expect(dialog?.getAttribute("aria-modal")).toBe("true")
        expect(container.textContent).toContain("Remove this image?")
        expect(container.textContent).toContain("deleted from storage")
    })

    it("calls onCancel on Escape", () => {
        let cancelled = false
        const { container } = render(
            <ConfirmDialog open title='Delete cafe?' onConfirm={() => {}} onCancel={() => { cancelled = true }} />
        )

        fireEvent.keyDown(container.querySelector("[role='dialog']")!, { key: "Escape" })

        expect(cancelled).toBe(true)
    })

    it("renders nothing when closed", () => {
        const { container } = render(
            <ConfirmDialog open={false} title='Hidden' onConfirm={() => {}} onCancel={() => {}} />
        )
        expect(container.querySelector("[role='dialog']")).toBeNull()
    })

    it("uses the destructive styling for a destructive confirm", () => {
        const { container } = render(
            <ConfirmDialog open destructive title='Delete cafe?' confirmLabel='Delete' onConfirm={() => {}} onCancel={() => {}} />
        )
        const confirmButton = [...container.querySelectorAll("button")].find((b) => b.textContent === "Delete")
        expect(confirmButton?.className).toContain("red")
    })
})

describe("useConfirm", () => {
    it("resolves true when confirmed and false when cancelled", async () => {
        const { result } = renderHook(() => useConfirm())

        let answer: boolean | null = null
        act(() => {
            void result.current.confirm({ title: "Remove image?" }).then((value) => { answer = value })
        })

        await waitFor(() => expect(result.current.dialog).toBeTruthy())

        act(() => { result.current.dialogResolve(true) })
        await waitFor(() => expect(answer).toBe(true))
        expect(result.current.dialog).toBeNull()
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test components/ui/__tests__/ConfirmDialog.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/ConfirmDialog`.

- [ ] **Step 3: Implement**

Create `components/ui/ConfirmDialog.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/utils/cn"

export interface ConfirmOptions {
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
}

export interface ConfirmDialogProps extends ConfirmOptions {
    open: boolean
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!open) return
        confirmRef.current?.focus()
    }, [open])

    if (!open) return null

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            <div
                className='absolute inset-0 bg-black/50'
                onClick={() => { if (!busy) onCancel() }}
                aria-hidden='true'
            />
            <div
                ref={dialogRef}
                role='dialog'
                aria-modal='true'
                aria-label={title}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && !busy) {
                        event.stopPropagation()
                        onCancel()
                    }
                }}
                className='relative w-full max-w-md rounded-xl border border-tertiary/50 bg-background p-5 shadow-lg'
            >
                <h2 className='text-lg font-semibold text-text'>{title}</h2>
                {description && <p className='mt-2 text-sm text-text/60'>{description}</p>}

                <div className='mt-5 flex justify-end gap-2'>
                    <button
                        type='button'
                        onClick={onCancel}
                        disabled={busy}
                        className='rounded-lg px-4 py-2 text-sm bg-text/10 hover:bg-text/20 disabled:opacity-50'
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        type='button'
                        onClick={onConfirm}
                        disabled={busy}
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white transition disabled:opacity-50",
                            destructive ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {busy && <Loader2 className='h-4 w-4 animate-spin' />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
```

Create `hooks/useConfirm.tsx`:

```tsx
"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import ConfirmDialog, { type ConfirmOptions } from "@/components/ui/ConfirmDialog"

interface PendingConfirm extends ConfirmOptions {
    resolve: (value: boolean) => void
}

/**
 * Promise-based confirm, so existing `if (!confirm(...)) return` call sites keep
 * their shape: `if (!(await confirm({ title: "Remove image?" }))) return`.
 *
 * Render the returned `dialog` node once in the component:
 *   const { confirm, dialog } = useConfirm()
 *   return <div>…{dialog}</div>
 */
export function useConfirm(): {
    confirm: (options: ConfirmOptions) => Promise<boolean>
    dialog: ReactNode
    dialogResolve: (value: boolean) => void
} {
    const [pending, setPending] = useState<PendingConfirm | null>(null)
    const pendingRef = useRef<PendingConfirm | null>(null)

    const settle = useCallback((value: boolean) => {
        const current = pendingRef.current
        pendingRef.current = null
        setPending(null)
        current?.resolve(value)
    }, [])

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            const next: PendingConfirm = { ...options, resolve }
            pendingRef.current = next
            setPending(next)
        })
    }, [])

    return {
        confirm,
        dialogResolve: settle,
        dialog: pending ? (
            <ConfirmDialog
                open
                {...pending}
                onConfirm={() => settle(true)}
                onCancel={() => settle(false)}
            />
        ) : null,
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test components/ui/__tests__/ConfirmDialog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/ConfirmDialog.tsx hooks/useConfirm.tsx components/ui/__tests__/ConfirmDialog.test.tsx
git commit -m "feat(ui): add ConfirmDialog and a promise-based useConfirm"
```

---

## Task 3: `useUnsavedChanges`

**Files:**
- Create: `hooks/useUnsavedChanges.ts`
- Test: `hooks/__tests__/useUnsavedChanges.test.ts`

- [ ] **Step 1: Write the failing test**

Create `hooks/__tests__/useUnsavedChanges.test.ts`:

```ts
import { describe, it, expect, mock, afterEach } from "bun:test"
import { renderHook } from "@testing-library/react"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"

const addSpy = mock((_type: string, _listener: unknown) => {})
const removeSpy = mock((_type: string, _listener: unknown) => {})

const originalAdd = window.addEventListener
const originalRemove = window.removeEventListener

afterEach(() => {
    window.addEventListener = originalAdd
    window.removeEventListener = originalRemove
})

describe("useUnsavedChanges", () => {
    it("registers a beforeunload listener while dirty", () => {
        window.addEventListener = addSpy as unknown as typeof window.addEventListener
        window.removeEventListener = removeSpy as unknown as typeof window.removeEventListener

        renderHook(({ dirty }) => useUnsavedChanges(dirty), { initialProps: { dirty: true } })

        expect(addSpy).toHaveBeenCalledTimes(1)
        expect(addSpy.mock.calls[0][0]).toBe("beforeunload")
    })

    it("removes the listener when the component unmounts", () => {
        window.addEventListener = addSpy as unknown as typeof window.addEventListener
        window.removeEventListener = removeSpy as unknown as typeof window.removeEventListener

        const { unmount } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
            initialProps: { dirty: true },
        })
        unmount()

        expect(removeSpy.mock.calls[0][0]).toBe("beforeunload")
    })

    it("does not register anything while clean", () => {
        const addWhileClean = mock((_type: string, _listener: unknown) => {})
        window.addEventListener = addWhileClean as unknown as typeof window.addEventListener
        window.removeEventListener = removeSpy as unknown as typeof window.removeEventListener

        renderHook(({ dirty }) => useUnsavedChanges(dirty), { initialProps: { dirty: false } })

        expect(addWhileClean).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test hooks/__tests__/useUnsavedChanges.test.ts`
Expected: FAIL — cannot resolve `@/hooks/useUnsavedChanges`.

- [ ] **Step 3: Implement**

Create `hooks/useUnsavedChanges.ts`:

```ts
"use client"

import { useEffect } from "react"

/**
 * Warn before a browser close/reload while there are unsaved edits.
 *
 * In-app navigation is not intercepted globally: the editors call the
 * `confirm()` from `useConfirm()` in their own Back/Preview handlers, which
 * keeps the behaviour predictable. This hook only covers the tab-level exits
 * the app cannot intercept.
 */
export function useUnsavedChanges(dirty: boolean): void {
    useEffect(() => {
        if (!dirty) return

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ""
        }

        window.addEventListener("beforeunload", handleBeforeUnload)
        return () => window.removeEventListener("beforeunload", handleBeforeUnload)
    }, [dirty])
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test hooks/__tests__/useUnsavedChanges.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/useUnsavedChanges.ts hooks/__tests__/useUnsavedChanges.test.ts
git commit -m "feat(ui): warn before unload while a cafe editor has unsaved changes"
```

---

## Task 4: Form primitives

**Files:**
- Create: `components/ui/SectionCard.tsx`, `components/ui/TextField.tsx`, `components/ui/SelectField.tsx`, `components/ui/ToggleRow.tsx`
- Test: `components/ui/__tests__/form-primitives.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/ui/__tests__/form-primitives.test.tsx`:

```tsx
import { describe, it, expect, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"

import SectionCard from "@/components/ui/SectionCard"
import TextField from "@/components/ui/TextField"
import SelectField from "@/components/ui/SelectField"
import ToggleRow from "@/components/ui/ToggleRow"

describe("form primitives", () => {
    it("SectionCard renders its title and children", () => {
        const { container } = render(
            <SectionCard title='Basic info' description='Visible on the cafe page'>
                <span>child</span>
            </SectionCard>
        )
        expect(container.textContent).toContain("Basic info")
        expect(container.textContent).toContain("Visible on the cafe page")
        expect(container.textContent).toContain("child")
    })

    it("TextField reports changes and renders a hint", () => {
        const changes: string[] = []
        const { container } = render(
            <TextField label='Name' value='Kapi' hint='Shown in listings' onChange={(v) => changes.push(v)} />
        )

        expect(container.textContent).toContain("Shown in listings")
        fireEvent.change(container.querySelector("input")!, { target: { value: "Kapi & Co." } })
        expect(changes).toEqual(["Kapi & Co."])
    })

    it("SelectField reports the chosen value", () => {
        const changes: string[] = []
        const { container } = render(
            <SelectField
                label='Price level'
                value='mid'
                options={[{ value: "budget", label: "Budget" }, { value: "mid", label: "Mid" }]}
                onChange={(v) => changes.push(v)}
            />
        )

        fireEvent.change(container.querySelector("select")!, { target: { value: "budget" } })
        expect(changes).toEqual(["budget"])
    })

    it("ToggleRow toggles", () => {
        const changes: boolean[] = []
        const { container } = render(
            <ToggleRow label='Has wifi' checked={false} onChange={(v) => changes.push(v)} />
        )

        fireEvent.click(container.querySelector("[role='switch']")!)
        expect(changes).toEqual([true])
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test components/ui/__tests__/form-primitives.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/SectionCard`.

- [ ] **Step 3: Implement the four units**

Create `components/ui/SectionCard.tsx`:

```tsx
import type { ReactNode } from "react"
import { cn } from "@/utils/cn"

interface SectionCardProps {
    title: string
    description?: string
    actions?: ReactNode
    children: ReactNode
    className?: string
}

export default function SectionCard({ title, description, actions, children, className }: SectionCardProps) {
    return (
        <section className={cn("rounded-xl border border-tertiary/50 bg-background p-5 shadow-sm", className)}>
            <div className='mb-4 flex items-start justify-between gap-4'>
                <div>
                    <h2 className='font-serif text-lg font-semibold text-text'>{title}</h2>
                    {description && <p className='mt-1 text-sm text-text/60'>{description}</p>}
                </div>
                {actions}
            </div>
            {children}
        </section>
    )
}
```

Create `components/ui/TextField.tsx`:

```tsx
"use client"

import { cn } from "@/utils/cn"

interface TextFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    hint?: string
    error?: string
    type?: "text" | "url" | "email" | "tel" | "number"
    disabled?: boolean
    className?: string
}

export default function TextField({
    label,
    value,
    onChange,
    placeholder,
    hint,
    error,
    type = "text",
    disabled,
    className,
}: TextFieldProps) {
    return (
        <label className={cn("block", className)}>
            <span className='mb-1.5 block text-sm font-medium text-text/60'>{label}</span>
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className={cn(
                    "w-full rounded-lg border bg-background px-4 py-3 text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50",
                    error ? "border-red-500" : "border-text/10"
                )}
            />
            {error ? (
                <span className='mt-1 block text-xs text-red-600'>{error}</span>
            ) : hint ? (
                <span className='mt-1 block text-xs text-text/50'>{hint}</span>
            ) : null}
        </label>
    )
}
```

Create `components/ui/SelectField.tsx`:

```tsx
"use client"

import { cn } from "@/utils/cn"

interface SelectFieldProps {
    label: string
    value: string
    options: { value: string; label: string }[]
    onChange: (value: string) => void
    placeholder?: string
    hint?: string
    disabled?: boolean
    className?: string
}

export default function SelectField({
    label,
    value,
    options,
    onChange,
    placeholder,
    hint,
    disabled,
    className,
}: SelectFieldProps) {
    return (
        <label className={cn("block", className)}>
            <span className='mb-1.5 block text-sm font-medium text-text/60'>{label}</span>
            <select
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className='w-full rounded-lg border border-text/10 bg-background px-4 py-3 text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50'
            >
                {placeholder && <option value=''>{placeholder}</option>}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {hint && <span className='mt-1 block text-xs text-text/50'>{hint}</span>}
        </label>
    )
}
```

Create `components/ui/ToggleRow.tsx`:

```tsx
"use client"

import { cn } from "@/utils/cn"

interface ToggleRowProps {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
    hint?: string
    disabled?: boolean
    className?: string
}

export default function ToggleRow({ label, checked, onChange, hint, disabled, className }: ToggleRowProps) {
    return (
        <div className={cn("flex items-center justify-between gap-4 py-2", className)}>
            <div>
                <span className='text-sm text-text'>{label}</span>
                {hint && <span className='block text-xs text-text/50'>{hint}</span>}
            </div>
            <button
                type='button'
                role='switch'
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={cn(
                    "relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-50",
                    checked ? "bg-accent" : "bg-text/20"
                )}
            >
                <span
                    className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
                        checked ? "left-[22px]" : "left-0.5"
                    )}
                />
            </button>
        </div>
    )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test components/ui/__tests__/form-primitives.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/ui/SectionCard.tsx components/ui/TextField.tsx components/ui/SelectField.tsx components/ui/ToggleRow.tsx components/ui/__tests__/form-primitives.test.tsx
git commit -m "feat(ui): add SectionCard, TextField, SelectField and ToggleRow"
```

---

## Task 5: `EditorShell`

**Files:**
- Create: `components/cafe-editor/EditorShell.tsx`
- Test: `components/cafe-editor/__tests__/EditorShell.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/cafe-editor/__tests__/EditorShell.test.tsx`:

```tsx
import { describe, it, expect, mock } from "bun:test"
import { render, fireEvent } from "@testing-library/react"

mock.module("@/components/ui/SegmentedTabs", () => ({
    default: ({ items, value, onChange, ariaLabel }: {
        items: { id: string; label: string }[]
        value: string
        onChange: (id: string) => void
        ariaLabel: string
    }) => (
        <div role='tablist' aria-label={ariaLabel}>
            {items.map((item) => (
                <button key={item.id} role='tab' aria-selected={item.id === value} onClick={() => onChange(item.id)}>
                    {item.label}
                </button>
            ))}
        </div>
    ),
}))

import EditorShell from "@/components/cafe-editor/EditorShell"

const tabs = [{ id: "basic", label: "Basic" }, { id: "images", label: "Images" }]

describe("EditorShell", () => {
    it("renders the header, the tab strip and the active section", () => {
        const { container } = render(
            <EditorShell
                header={<h1>Kapi &amp; Co.</h1>}
                tabs={tabs}
                activeSection='basic'
                onSectionChange={() => {}}
                saveState={{ dirty: false, saving: false, lastSavedAt: null, error: null }}
                onSave={() => {}}
                onDiscard={() => {}}
            >
                <p>section body</p>
            </EditorShell>
        )

        expect(container.textContent).toContain("Kapi")
        expect(container.querySelector("[role='tablist']")).toBeTruthy()
        expect(container.textContent).toContain("section body")
    })

    it("shows the unsaved count and enables Save while dirty", () => {
        const { container } = render(
            <EditorShell
                header={<h1>Kapi</h1>}
                tabs={tabs}
                activeSection='basic'
                onSectionChange={() => {}}
                saveState={{ dirty: true, saving: false, lastSavedAt: null, error: null }}
                onSave={() => {}}
                onDiscard={() => {}}
            >
                <p>body</p>
            </EditorShell>
        )

        expect(container.textContent).toContain("unsaved")
        const save = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Save"))
        expect(save).toBeTruthy()
        expect((save as HTMLButtonElement).disabled).toBe(false)
    })

    it("renders the save error with a retry affordance", () => {
        const { container } = render(
            <EditorShell
                header={<h1>Kapi</h1>}
                tabs={tabs}
                activeSection='basic'
                onSectionChange={() => {}}
                saveState={{ dirty: true, saving: false, lastSavedAt: null, error: "Failed to save images" }}
                onSave={() => {}}
                onDiscard={() => {}}
            >
                <p>body</p>
            </EditorShell>
        )

        expect(container.textContent).toContain("Failed to save images")
    })

    it("calls onSectionChange when a tab is clicked", () => {
        const changes: string[] = []
        const { container } = render(
            <EditorShell
                header={<h1>Kapi</h1>}
                tabs={tabs}
                activeSection='basic'
                onSectionChange={(id) => changes.push(id)}
                saveState={{ dirty: false, saving: false, lastSavedAt: null, error: null }}
                onSave={() => {}}
                onDiscard={() => {}}
            >
                <p>body</p>
            </EditorShell>
        )

        fireEvent.click(container.querySelectorAll("[role='tab']")[1])
        expect(changes).toEqual(["images"])
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test components/cafe-editor/__tests__/EditorShell.test.tsx`
Expected: FAIL — cannot resolve `@/components/cafe-editor/EditorShell`.

- [ ] **Step 3: Implement**

Create `components/cafe-editor/EditorShell.tsx`:

```tsx
"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { Loader2, Save, RotateCcw, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import SegmentedTabs, { type SegmentedTabItem } from "@/components/ui/SegmentedTabs"
import { cn } from "@/utils/cn"
import type { ColorScheme } from "@/utils/hooks/cafe-form"

export interface EditorSaveState {
    dirty: boolean
    saving: boolean
    lastSavedAt: Date | null
    error: string | null
}

export interface EditorShellProps {
    header: ReactNode
    tabs: SegmentedTabItem[]
    activeSection: string
    onSectionChange: (id: string) => void
    saveState: EditorSaveState
    onSave: () => void | Promise<void>
    onDiscard: () => void
    children: ReactNode
    colorScheme?: ColorScheme
    ariaLabel: string
}

export default function EditorShell({
    header,
    tabs,
    activeSection,
    onSectionChange,
    saveState,
    onSave,
    onDiscard,
    children,
    colorScheme = "accent",
    ariaLabel,
}: EditorShellProps) {
    const scrollPositions = useRef(new Map<string, number>())
    const contentRef = useRef<HTMLDivElement>(null)
    const previousSection = useRef(activeSection)

    useEffect(() => {
        const previous = previousSection.current
        if (previous === activeSection) return

        if (contentRef.current) {
            scrollPositions.current.set(previous, contentRef.current.scrollTop)
            contentRef.current.scrollTop = scrollPositions.current.get(activeSection) ?? 0
        }
        previousSection.current = activeSection
    }, [activeSection])

    const statusText = saveState.error
        ? saveState.error
        : saveState.saving
            ? "Saving…"
            : saveState.dirty
                ? "Unsaved changes"
                : saveState.lastSavedAt
                    ? `All changes saved · ${formatDistanceToNow(saveState.lastSavedAt)} ago`
                    : "All changes saved"

    return (
        <div className='flex min-h-[70vh] flex-col gap-6'>
            <div className='sticky top-0 z-20 -mx-4 border-b border-text/10 bg-background/95 px-4 pb-3 pt-2 backdrop-blur'>
                {header}
                <SegmentedTabs
                    items={tabs}
                    value={activeSection}
                    onChange={onSectionChange}
                    ariaLabel={ariaLabel}
                    colorScheme={colorScheme}
                    className='mt-3'
                />
            </div>

            <div ref={contentRef} className='min-h-[55vh]'>
                {children}
            </div>

            <div className='sticky bottom-0 z-20 -mx-4 border-t border-text/10 bg-background/95 px-4 py-3 backdrop-blur'>
                <div className='flex items-center justify-between gap-3'>
                    <div className='flex min-w-0 items-center gap-2 text-sm'>
                        {saveState.error && <AlertCircle className='h-4 w-4 flex-shrink-0 text-red-600' />}
                        <span
                            className={cn(
                                "truncate",
                                saveState.error ? "text-red-600" : saveState.dirty ? "text-text/70" : "text-text/50"
                            )}
                        >
                            {statusText}
                        </span>
                    </div>
                    <div className='flex flex-shrink-0 items-center gap-2'>
                        <button
                            type='button'
                            onClick={onDiscard}
                            disabled={!saveState.dirty || saveState.saving}
                            className='flex items-center gap-2 rounded-lg border border-text/10 px-4 py-2 text-sm transition hover:bg-text/5 disabled:opacity-40'
                        >
                            <RotateCcw className='h-4 w-4' />
                            Discard
                        </button>
                        <button
                            type='button'
                            onClick={() => void onSave()}
                            disabled={!saveState.dirty || saveState.saving}
                            className='flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-40'
                        >
                            {saveState.saving ? (
                                <Loader2 className='h-4 w-4 animate-spin' />
                            ) : (
                                <Save className='h-4 w-4' />
                            )}
                            Save changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
```

This component needs `useRef` and `useEffect` only; there is no state.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test components/cafe-editor/__tests__/EditorShell.test.tsx && bunx tsc --noEmit`
Expected: PASS (4 tests), then no tsc output.

- [ ] **Step 5: Commit**

```bash
git add components/cafe-editor/EditorShell.tsx components/cafe-editor/__tests__/EditorShell.test.tsx
git commit -m "feat(cafe): add EditorShell with sticky tabs and an action bar"
```

---

## Task 6: `EditorHeader` and the shared empty/loading states

**Files:**
- Create: `components/cafe-editor/EditorHeader.tsx`, `components/ui/EmptyState.tsx`, `components/ui/Skeleton.tsx`
- Modify: `components/cafe-editor/index.ts`
- Test: `components/cafe-editor/__tests__/EditorHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/cafe-editor/__tests__/EditorHeader.test.tsx`:

```tsx
import { describe, it, expect, mock } from "bun:test"
import { render } from "@testing-library/react"

mock.module("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import EditorHeader from "@/components/cafe-editor/EditorHeader"

describe("EditorHeader", () => {
    it("renders the title, status chips and quick actions", () => {
        const { container } = render(
            <EditorHeader
                title='Kapi & Co.'
                subtitle='Submitted 12 Oct 2026'
                chips={[{ label: "Pending", tone: "amber" }]}
                actions={<button>Approve</button>}
            />
        )

        expect(container.textContent).toContain("Kapi & Co.")
        expect(container.textContent).toContain("Pending")
        expect(container.textContent).toContain("Approve")
    })

    it("renders a back link when given a destination", () => {
        const { container } = render(<EditorHeader title='Kapi' backHref='/manage/cafes' backLabel='Cafes' />)
        expect(container.querySelector("a")?.getAttribute("href")).toBe("/manage/cafes")
    })

    it("omits the chip row when there are no chips", () => {
        const { container } = render(<EditorHeader title='Kapi' />)
        expect(container.querySelector("[data-testid='editor-chips']")).toBeNull()
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test components/cafe-editor/__tests__/EditorHeader.test.tsx`
Expected: FAIL — cannot resolve `@/components/cafe-editor/EditorHeader`.

- [ ] **Step 3: Implement**

Create `components/cafe-editor/EditorHeader.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/utils/cn"

export interface EditorHeaderChip {
    label: string
    tone: "green" | "amber" | "gray" | "red"
}

interface EditorHeaderProps {
    title: string
    subtitle?: string
    chips?: EditorHeaderChip[]
    actions?: ReactNode
    backHref?: string
    backLabel?: string
}

const CHIP_CLASSES: Record<EditorHeaderChip["tone"], string> = {
    green: "bg-green-500/20 text-green-700",
    amber: "bg-amber-500/20 text-amber-700",
    gray: "bg-text/10 text-text/70",
    red: "bg-red-500/20 text-red-600",
}

export default function EditorHeader({
    title,
    subtitle,
    chips,
    actions,
    backHref,
    backLabel = "Back",
}: EditorHeaderProps) {
    return (
        <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='flex min-w-0 items-start gap-3'>
                {backHref && (
                    <Link
                        href={backHref}
                        aria-label={backLabel}
                        className='rounded-lg p-2 transition hover:bg-text/5'
                    >
                        <ArrowLeft className='h-5 w-5' />
                    </Link>
                )}
                <div className='min-w-0'>
                    <h1 className='truncate font-serif text-2xl font-bold'>{title}</h1>
                    {subtitle && <p className='text-sm text-text/60'>{subtitle}</p>}
                    {chips && chips.length > 0 && (
                        <div data-testid='editor-chips' className='mt-2 flex flex-wrap gap-2'>
                            {chips.map((chip) => (
                                <span
                                    key={chip.label}
                                    className={cn("rounded-full px-2.5 py-1 text-xs font-medium", CHIP_CLASSES[chip.tone])}
                                >
                                    {chip.label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className='flex flex-shrink-0 flex-wrap items-center gap-2'>{actions}</div>
        </div>
    )
}
```

Create `components/ui/EmptyState.tsx`:

```tsx
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description?: string
    action?: ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className='rounded-xl border border-tertiary/50 bg-background py-16 text-center'>
            <Icon className='mx-auto mb-4 h-12 w-12 opacity-30' />
            <p className='font-medium text-text'>{title}</p>
            {description && <p className='mx-auto mt-1 max-w-sm text-sm text-text/60'>{description}</p>}
            {action && <div className='mt-4 flex justify-center'>{action}</div>}
        </div>
    )
}
```

Create `components/ui/Skeleton.tsx`:

```tsx
import { cn } from "@/utils/cn"

interface SkeletonProps {
    className?: string
}

export default function Skeleton({ className }: SkeletonProps) {
    return <div className={cn("animate-pulse rounded-lg bg-text/10", className)} aria-hidden='true' />
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
    return (
        <div className='space-y-3'>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className='rounded-xl border border-tertiary/50 bg-background p-4'>
                    <Skeleton className='h-4 w-1/3' />
                    <Skeleton className='mt-2 h-3 w-2/3' />
                </div>
            ))}
        </div>
    )
}
```

Append to `components/cafe-editor/index.ts`:

```ts
export { default as EditorShell, type EditorSaveState } from "./EditorShell"
export { default as EditorHeader, type EditorHeaderChip } from "./EditorHeader"
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test components/cafe-editor/__tests__/EditorHeader.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/cafe-editor/EditorHeader.tsx components/ui/EmptyState.tsx components/ui/Skeleton.tsx components/cafe-editor/index.ts components/cafe-editor/__tests__/EditorHeader.test.tsx
git commit -m "feat(ui): add EditorHeader, EmptyState and Skeleton"
```

---

## Task 7: Adopt the shell in the admin editor

**Prerequisite:** Plan A is complete (Tasks 1-15), so `cafeImages` from `useCafeImages` exists in `CafeEditor.tsx`.

**Files:**
- Modify: `components/manage/CafeEditor.tsx`
- Modify: `app/manage/preview/[id]/page.tsx:29`

- [ ] **Step 1: Fix the dead redirect target**

In `app/manage/preview/[id]/page.tsx`, change:

```ts
        redirect("/admin")
```

to:

```ts
        redirect("/manage/cafes")
```

(`/admin` is not a route in this app; the old target 404'd.)

- [ ] **Step 2: Add the toast, confirm and unsaved-changes wiring**

At the top of `CafeEditor`, alongside the existing hooks:

```ts
    const { addNotification } = useNotification()
    const { confirm, dialog } = useConfirm()
    useUnsavedChanges(hasChanges)
```

importing `useNotification` from `@/components/layout/NotificationProvider`, `useConfirm` from `@/hooks/useConfirm`, and `useUnsavedChanges` from `@/hooks/useUnsavedChanges`.

- [ ] **Step 3: Replace `alert()` and `confirm()`**

Replace every `alert("...")` with `addNotification("...", "error")` and every `if (!confirm("...")) return` with:

```ts
        if (!(await confirm({ title: "...", destructive: true, confirmLabel: "Remove" }))) return
```

The affected sites in this file are the `confirm()` calls at `:224` and `:238` and every `alert()` in `handleSave` and the story handlers. The functions that now `await confirm` must be `async` (they already are, since they call server actions).

- [ ] **Step 4: Replace the header and tab bar with the shell**

Replace the header block (from `{/* Header */}` through the end of the section-tabs `SECTIONS.map(...)` container) with `EditorShell`, keeping the existing quick-action buttons as the header's `actions` slot:

```tsx
            <EditorShell
                ariaLabel='Cafe sections'
                header={
                    <EditorHeader
                        title={cafe.name}
                        subtitle={`${cafe.is_published ? "Published" : "Pending"} · ${cafe.region ?? ""}`}
                        chips={[
                            { label: cafe.is_published ? "Published" : "Pending", tone: cafe.is_published ? "green" : "amber" },
                            ...(cafe.is_verified ? [{ label: "Verified", tone: "green" } as const] : []),
                        ]}
                        backHref='/manage/cafes'
                        backLabel='Back to cafes'
                        actions={
                            <>
                                {cafe.is_published ? (
                                    <>
                                        <button onClick={handleUnpublish} className='...existing classes...'>Unpublish</button>
                                        <button onClick={handleDelete} className='...existing classes...'>Delete</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => setRejectModalOpen(true)} className='...'>Reject</button>
                                        <button onClick={handleApprove} className='...'>Approve</button>
                                    </>
                                )}
                            </>
                        }
                    />
                }
                tabs={SECTIONS.map(({ id, title, icon }) => ({
                    id,
                    label: title,
                    icon,
                    dirty: sectionHasPendingEdits(id),
                }))}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                saveState={{
                    dirty: hasChanges || cafeImages.saveState.dirty,
                    saving: saving || cafeImages.saveState.saving,
                    lastSavedAt: cafeImages.saveState.lastSavedAt,
                    error: cafeImages.saveState.error,
                }}
                onSave={handleSave}
                onDiscard={handleDiscard}
                colorScheme='accent'
            >
                {/* the existing <AnimatePresence> section body stays exactly as it is */}
            </EditorShell>
```

`handleDiscard` resets the form. Add the baseline ref next to the component's other refs, then the callback:

```ts
    const initialCafeRef = useRef(cafe)
```

```ts
    const handleDiscard = useCallback(() => {
        setCafe(initialCafeRef.current)
        setHasChanges(false)
        addNotification("Changes discarded", "success")
    }, [addNotification])
```

`sectionHasPendingEdits(id)` marks the Images tab from `cafeImages.saveState.dirty` and every other tab from a simple `hasChanges` check for the active section:

```ts
    const sectionHasPendingEdits = (id: string) => (id === "images" ? cafeImages.saveState.dirty : hasChanges && activeSection !== id)
```

Remove the old Save button (the shell owns Save now) and the now-unused `Save`/`Loader2` imports if nothing else uses them.

- [ ] **Step 5: Render the confirm dialog**

Render `{dialog}` once, immediately inside the editor's outermost element.

- [ ] **Step 6: Verify**

Run: `bunx tsc --noEmit && bun lint && bun test components/manage/__tests__/CafeEditor.test.tsx`
Expected: no tsc/eslint output; the editor test passes (its `alert`/`confirm` assertions, if any, are updated to the toast equivalents).

- [ ] **Step 7: Commit**

```bash
git add components/manage/CafeEditor.tsx app/manage/preview/[id]/page.tsx
git commit -m "refactor(manage): adopt the editor shell, toasts and confirm dialogs

The admin editor now uses EditorShell's sticky tabs and action bar, native
alert()/confirm() are replaced with toasts and ConfirmDialog, and leaving
with unsaved edits warns. The preview page's /admin redirect (a 404) now
points at /manage/cafes."
```

---

## Task 8: Adopt the shell in the owner editor

**Files:**
- Modify: `components/owner/CafeEdit.tsx`

- [ ] **Step 1: Add the same hooks**

```ts
    const { addNotification } = useNotification()
    const { confirm, dialog } = useConfirm()
    useUnsavedChanges(hasChanges)
```

(The owner editor already imports `useNotification`; keep its existing calls and route them through the same shell.)

- [ ] **Step 2: Replace the header, tab row and both save affordances**

Replace the header block (`:170-215`), the tab row, and the `md:hidden` fixed bottom save bar (`:615-638`) with `EditorShell`, using the owner's colour scheme and no quick actions:

```tsx
            <EditorShell
                ariaLabel='Cafe sections'
                colorScheme='primary'
                header={
                    <EditorHeader
                        title={`Edit ${cafe.name}`}
                        subtitle='Update your cafe information'
                        chips={[
                            { label: cafe.is_published ? "Published" : "Pending review", tone: cafe.is_published ? "green" : "amber" },
                        ]}
                        backHref={`/owner/cafes/${cafe.slug}`}
                        backLabel='Back to cafe'
                    />
                }
                tabs={SECTIONS.map(({ id, title, icon }) => ({
                    id,
                    label: title,
                    icon,
                    dirty: id === "images" ? cafeImages.saveState.dirty : hasChanges && activeSection !== id,
                }))}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                saveState={{
                    dirty: hasChanges || cafeImages.saveState.dirty,
                    saving: saving || cafeImages.saveState.saving,
                    lastSavedAt: cafeImages.saveState.lastSavedAt,
                    error: cafeImages.saveState.error,
                }}
                onSave={handleSave}
                onDiscard={handleDiscard}
            >
                {/* the existing <AnimatePresence> section body stays exactly as it is */}
            </EditorShell>
```

This removes the owner's separate mobile-only bar, because the shell's action bar is sticky on all breakpoints.

- [ ] **Step 3: Replace `alert()`/`confirm()` in the owner editor**

The owner editor already uses toasts, so only `confirm()` sites change, to `await confirm({...})`.

- [ ] **Step 4: Render the confirm dialog and verify**

Render `{dialog}` once inside the outermost element, then run:

Run: `bunx tsc --noEmit && bun lint && bun test components/owner/__tests__/CafeEdit.test.tsx`
Expected: no tsc/eslint output; the owner editor test passes.

- [ ] **Step 5: Commit**

```bash
git add components/owner/CafeEdit.tsx
git commit -m "refactor(owner): adopt the editor shell and confirm dialogs"
```

---

## Task 9: Tab strip and empty states on the listing and hub

**Files:**
- Modify: `components/manage/CafesManagement.tsx` (the 7 hand-rolled `<button>` tabs at `:623-712`)
- Modify: `components/owner/CafeManagement.tsx` (the underline strip at `:596-621`)

- [ ] **Step 1: Replace the admin listing's tab strip**

Replace the block starting at `<div className='flex gap-2 overflow-x-auto py-1'>` and ending after the last `</button>` with:

```tsx
            <SegmentedTabs
                ariaLabel='Cafe management sections'
                variant='solid'
                colorScheme='primary'
                value={activeTab}
                onChange={(id) => setActiveTab(id as TabType)}
                items={[
                    { id: "pending", label: "Pending", icon: FileText, badge: pendingTotal },
                    { id: "published", label: "Published", icon: Globe, badge: publishedTotal },
                    {
                        id: "suggestions",
                        label: "Suggestions",
                        icon: Pencil,
                        badge: suggestions.length,
                        attention: suggestions.length > 0 ? "amber" : undefined,
                    },
                    {
                        id: "claims",
                        label: "Claims",
                        icon: Store,
                        badge: claims.length,
                        attention: claims.length > 0 ? "purple" : undefined,
                    },
                    { id: "featured", label: "Featured", icon: Star },
                    {
                        id: "mall-verifications",
                        label: "Mall Verifications",
                        icon: Store,
                        badge: mallVerifications.length,
                        attention: mallVerifications.length > 0 ? "purple" : undefined,
                    },
                    {
                        id: "menu-suggestions",
                        label: "Menu",
                        icon: UtensilsCrossed,
                        badge: menuSuggestions.length,
                        attention: menuSuggestions.length > 0 ? "amber" : undefined,
                    },
                ]}
            />
```

Import `SegmentedTabs` from `@/components/ui/SegmentedTabs`. `UtensilsCrossed` and `Star` are already imported at `:88`; `FileText`, `Globe`, `Pencil` and `Store` are already imported further down. The labels drop the parenthesised counts because the counts become badges, and the seventh tab's label is `Menu` (its existing label), not `Menu Suggestions`.

- [ ] **Step 2: Give the listing an empty state**

Replace the empty branch for the cafe list (`:873-883`), which currently hand-rolls the same markup, with:

```tsx
                        <EmptyState
                            icon={Coffee}
                            title={
                                searchQuery
                                    ? `No cafes found for "${searchQuery}"`
                                    : activeTab === "pending"
                                      ? "No pending submissions"
                                      : "No published cafes"
                            }
                            description='Try clearing the filters, or switch to another tab.'
                        />
```

(`Coffee` is already imported.)

The file has three more hand-rolled empty blocks — suggestions (`:1272`), mall verifications (`:1524`) and menu suggestions (`:1759`). Convert those the same way, keeping each block's existing wording and its nearby icon; do not invent new copy.

- [ ] **Step 3: Replace the owner hub's underline strip**

Replace the `{/* Tabs */}` block (`:596-621`) with:

```tsx
                <SegmentedTabs
                    ariaLabel='Cafe management tabs'
                    colorScheme='primary'
                    value={activeTab}
                    onChange={(id) => handleTabChange(id as Tab)}
                    items={tabs.map((tab) => ({
                        id: tab.id,
                        label: tab.label,
                        icon: tab.icon,
                        badge: tab.badge,
                    }))}
                    className='mb-6'
                />
```

`handleTabChange` keeps its lazy-loading behaviour untouched.

- [ ] **Step 4: Give the hub an empty state**

Run `grep -n "No reviews\|No items\|No events" components/owner/CafeManagement.tsx` and replace the first matching empty branch with an `EmptyState` instance carrying that tab's own wording, keeping the icon already used nearby.

- [ ] **Step 5: Verify**

Run: `bunx tsc --noEmit && bun lint && bun test`
Expected: no tsc/eslint output; the suite sits at the known baseline plus the new tests.

- [ ] **Step 6: Commit**

```bash
git add components/manage/CafesManagement.tsx components/owner/CafeManagement.tsx
git commit -m "feat(manage,owner): use SegmentedTabs on the listing and hub

One tab language across all four surfaces, with count badges replacing
counts baked into label text, plus a real empty state."
```

---

## Task 10: Primitive adoption in the touched sections (optional, mechanical only)

**Files:**
- Modify: `components/manage/CafeEditor.tsx` (the inline Basic-info fields)
- Modify: `components/owner/CafeEdit.tsx` (the inline Basic-info fields at `:255-445`)

- [ ] **Step 1: Replace only the plain text inputs in the Basic section**

Do this only for `<input>` elements whose `className` matches the repeated string `px-4 py-3 bg-background border border-text/10 rounded-lg`, converting them to `TextField` with the same `label`, `value` and `onChange`. Leave selects, textareas, tag inputs and everything else untouched.

Example conversion:

```tsx
<TextField label='Name' value={cafe.name} onChange={(value) => updateField("name", value)} />
```

- [ ] **Step 2: Verify nothing regressed**

Run: `bunx tsc --noEmit && bun lint && bun test`
Expected: no output, baseline suite.

- [ ] **Step 3: Stop if the diff stops being mechanical**

If a field needs conditional logic, custom labels or a non-string type, leave it as it is and note it in the commit message rather than forcing the primitive. Partial adoption is the expected outcome here; the point is to stop the class-string duplication in the fields that are already plain.

- [ ] **Step 4: Commit**

```bash
git add components/manage/CafeEditor.tsx components/owner/CafeEdit.tsx
git commit -m "refactor(cafe): use TextField in the basic info sections"
```

---

## Task 11: Verification and manual QA

**Files:** none

- [ ] **Step 1: Static checks and suite**

Run: `bunx tsc --noEmit && bun lint && bun test`
Expected: no tsc/eslint output; the 17 pre-existing failures only.

- [ ] **Step 2: Manual QA**

With `bun dev` running:

1. `/manage/cafes`: all 7 tabs render as pills with count badges; the attention tints still appear for suggestions/claims/verifications; arrow keys move between tabs; an empty filter shows the empty state.
2. `/manage/preview/<id>`: the header shows name, status chips, back link and quick actions; the tab strip sticks while scrolling the section body; switching sections restores that section's scroll position.
3. Edit a text field → the action bar shows "Unsaved changes" and enables Save/Discard; Discard restores the original values.
4. Edit a field, then reload the tab → the browser's unsaved-changes prompt appears.
5. Save → the bar shows "All changes saved · now"; a toast confirms.
6. Add/remove an image → the Images tab shows a dirty dot; the bar reports saving then saved, with no toast spam.
7. Delete a cafe, remove an image, delete a story → each asks via `ConfirmDialog` with destructive styling, and Esc cancels.
8. `/owner/cafes/<slug>/edit`: same shell with the owner's colour scheme, no quick actions, and no duplicate mobile save bar.
9. `/owner/cafes/<slug>`: tabs render as pills with badges; lazy loading per tab still works.
10. Both editors at 375 px width: single column, the tab strip scrolls horizontally instead of wrapping, the action bar stays reachable, and tap targets are comfortable.

- [ ] **Step 3: Commit any QA fixes**

```bash
git status --porcelain   # clean, or commit QA fixes as fix(...)
```

---

## Self-review results

- **Spec coverage:** §4.1 `SegmentedTabs` (Task 1), §4.2 `EditorShell` (Task 5), §4.3 `useUnsavedChanges` (Task 3, with the reduced API documented in the code comment), §4.6 `ConfirmDialog` + `useConfirm` (Task 2), §7 sticky tabs and action bar (Tasks 5, 7, 8), toast/confirm consistency (Tasks 7, 8), unified header (Task 6), skeletons/empty states (Tasks 6, 9), shared form primitives (Tasks 4, 10), tab a11y and mobile behaviour (Tasks 1, 5), listing/hub tab strip with count badges (Task 9), the `/admin` redirect correction (Task 7), and the "no internal restructuring of the two big files" scope guard (stated in the plan header and enforced by Task 9's file list).
- **Deviations from the spec, stated deliberately:** §4.3's `confirmIfDirty()` is replaced by `useUnsavedChanges(dirty)` plus explicit `confirm()` calls in the editors' own handlers — fewer moving parts and a testable surface. §7's "adopt primitives in Basic, Contact and Location" is narrowed to Basic-info text inputs (Task 10) because Contact/Location contain selects, tag inputs and custom controls whose conversion would not be mechanical; the spec's intent (stop class-string duplication) is met where it is safe.
- **Placeholder scan:** the two `grep`-first steps (Task 9 Steps 2 and 4) are discovery steps with the exact command and the exact replacement code, not placeholders. Task 7 Step 4 marks existing button classes as `...existing classes...` deliberately: those three buttons' markup is not being changed, only relocated into the header's action slot, and rewriting their classes would be an unrequested visual change. Task 5 Step 3 flags one typo in the test snippet and tells the implementer to fix it before running, and states the fallback if `now` stays unused.
- **Type consistency:** `EditorSaveState` is defined once in `EditorShell.tsx` and constructed identically in Tasks 7 and 8 from the union of the form's and `cafeImages`' save state. `SegmentedTabItem` is the single item type for all four surfaces. `ConfirmOptions` flows from `ConfirmDialog.tsx` through `useConfirm.tsx` to call sites unchanged. `EditorHeaderChip["tone"]` is a union of four literals used consistently in Tasks 7 and 8.
