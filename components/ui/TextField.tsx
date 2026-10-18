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
