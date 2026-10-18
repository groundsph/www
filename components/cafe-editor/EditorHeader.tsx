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

/**
 * The cafe identity band: name, status chips and the surface's quick actions.
 */
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
                    <Link href={backHref} aria-label={backLabel} className='rounded-lg p-2 transition hover:bg-text/5'>
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
