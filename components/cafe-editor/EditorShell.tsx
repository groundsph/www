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

/**
 * Layout A: a sticky tab strip under the header and an always-visible action bar
 * that reports save state. Presentation only — the caller owns every action.
 */
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

    // Remember where you were in each section
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
