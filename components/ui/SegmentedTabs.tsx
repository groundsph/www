"use client"

import { useEffect, useRef, useState } from "react"
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
    /** Keeps the admin listing's existing "needs attention" tint. */
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
     * "subtle" is the editor look (tinted active pill on a track).
     * "solid" keeps the admin listing's solid active pill.
     */
    variant?: "subtle" | "solid"
    size?: "sm" | "md"
    className?: string
}

/**
 * Which edges of the strip hide content? Pure so it can be tested without a
 * layout engine (JSDOM reports zero geometry).
 */
export function getScrollFadeState({
    scrollLeft,
    scrollWidth,
    clientWidth,
    tolerance = 2,
}: {
    scrollLeft: number
    scrollWidth: number
    clientWidth: number
    tolerance?: number
}): { left: boolean; right: boolean } {
    const maxScroll = scrollWidth - clientWidth
    if (maxScroll <= tolerance) return { left: false, right: false }
    return {
        left: scrollLeft > tolerance,
        right: scrollLeft < maxScroll - tolerance,
    }
}

const ATTENTION_CLASSES: Record<"amber" | "purple", string> = {
    amber: "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30",
    purple: "bg-purple-500/20 text-purple-700 hover:bg-purple-500/30",
}

/**
 * One tab strip for every management surface. Presentation only: it knows
 * nothing about sections, routing or data.
 */
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
    const [fade, setFade] = useState({ left: false, right: false })

    // Show a fade on whichever edge still hides tabs
    useEffect(() => {
        const node = listRef.current
        if (!node) return

        const update = () => {
            setFade(getScrollFadeState({
                scrollLeft: node.scrollLeft,
                scrollWidth: node.scrollWidth,
                clientWidth: node.clientWidth,
            }))
        }

        update()
        node.addEventListener("scroll", update, { passive: true })
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null
        observer?.observe(node)

        return () => {
            node.removeEventListener("scroll", update)
            observer?.disconnect()
        }
    }, [items.length])

    const enabledIndexes = items
        .map((item, index) => (item.disabled ? -1 : index))
        .filter((index) => index >= 0)

    const selectAt = (index: number) => {
        const item = items[index]
        if (!item || item.disabled) return
        onChange(item.id)
        listRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")[index]?.focus()
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const currentIndex = items.findIndex((item) => item.id === value)
        if (currentIndex < 0 || enabledIndexes.length === 0) return
        const positionInEnabled = enabledIndexes.indexOf(currentIndex)

        switch (event.key) {
            case "ArrowRight":
                event.preventDefault()
                selectAt(enabledIndexes[(positionInEnabled + 1) % enabledIndexes.length])
                break
            case "ArrowLeft":
                event.preventDefault()
                selectAt(enabledIndexes[(positionInEnabled - 1 + enabledIndexes.length) % enabledIndexes.length])
                break
            case "Home":
                event.preventDefault()
                selectAt(enabledIndexes[0])
                break
            case "End":
                event.preventDefault()
                selectAt(enabledIndexes[enabledIndexes.length - 1])
                break
            default:
                break
        }
    }

    const padding = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"

    return (
        <div className='relative'>
            {fade.left && (
                <div
                    aria-hidden='true'
                    className='pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent'
                />
            )}
            {fade.right && (
                <div
                    aria-hidden='true'
                    className='pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent'
                />
            )}
        <div
            ref={listRef}
            role='tablist'
            aria-label={ariaLabel}
            onKeyDown={handleKeyDown}
            className={cn(
                "flex gap-1 overflow-x-auto",
                variant === "subtle" ? "rounded-lg bg-tertiary/40 p-1" : "bg-transparent p-0",
                className
            )}
        >
            {items.map((item) => {
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
                        {item.dirty && <span aria-hidden='true' className={cn("ml-0.5 h-1.5 w-1.5 rounded-full", colors.bg)} />}
                    </button>
                )
            })}
        </div>
        </div>
    )
}
