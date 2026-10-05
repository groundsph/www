"use client"

import { cn } from "@/utils/cn"

export function Field({
    label,
    hint,
    children,
    className,
}: {
    label?: string
    hint?: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <label className={cn("block space-y-1", className)}>
            {label && (
                <span className="block text-xs font-medium text-text/60">{label}</span>
            )}
            {children}
            {hint && <span className="block text-[11px] text-text/40">{hint}</span>}
        </label>
    )
}

const inputClass =
    "w-full px-3 py-2 rounded-lg border border-text/15 bg-background text-sm outline-none transition-all placeholder:text-text/30 focus:border-primary focus:ring-2 focus:ring-primary/20"

export function TextInput({
    value,
    onChange,
    placeholder,
    className,
}: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(inputClass, className)}
        />
    )
}

export function TextArea({
    value,
    onChange,
    placeholder,
    rows = 3,
    className,
}: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    rows?: number
    className?: string
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className={cn(inputClass, "resize-y", className)}
        />
    )
}

export function SelectInput<T extends string>({
    value,
    onChange,
    options,
    className,
}: {
    value: T
    onChange: (value: T) => void
    options: { value: T; label: string }[]
    className?: string
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value as T)}
            className={cn(inputClass, "cursor-pointer", className)}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    )
}

export function SecondaryButton({
    onClick,
    children,
    disabled,
    className,
    type = "button",
}: {
    onClick?: () => void
    children: React.ReactNode
    disabled?: boolean
    className?: string
    type?: "button" | "submit"
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg border border-text/10 bg-text/5 px-3 py-1.5 text-xs font-medium text-text/80 transition-colors hover:bg-text/10 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
        >
            {children}
        </button>
    )
}
