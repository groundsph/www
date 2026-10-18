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
