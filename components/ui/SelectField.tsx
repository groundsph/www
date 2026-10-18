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
