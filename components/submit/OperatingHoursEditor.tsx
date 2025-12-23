"use client"

import { useState } from "react"
import { OperatingHour } from "@/utils/types/cafe"
import { Copy, Clock } from "lucide-react"
import { cn } from "@/utils/cn"

const DAY_OPTIONS: { key: OperatingHour["day"]; label: string }[] = [
    { key: "mon", label: "Monday" },
    { key: "tue", label: "Tuesday" },
    { key: "wed", label: "Wednesday" },
    { key: "thu", label: "Thursday" },
    { key: "fri", label: "Friday" },
    { key: "sat", label: "Saturday" },
    { key: "sun", label: "Sunday" },
]

interface OperatingHoursEditorProps {
    value: OperatingHour[]
    onChange: (hours: OperatingHour[]) => void
}

export default function OperatingHoursEditor({
    value,
    onChange,
}: OperatingHoursEditorProps) {
    // Initialize hours for all days if not present
    const getHoursForDay = (day: OperatingHour["day"]): OperatingHour => {
        const existing = value.find((h) => h.day === day)
        return (
            existing || { day, open: "08:00", close: "20:00", is_closed: false }
        )
    }

    const updateDay = (
        day: OperatingHour["day"],
        updates: Partial<OperatingHour>
    ) => {
        const current = getHoursForDay(day)
        const updated = { ...current, ...updates }

        const newHours = value.filter((h) => h.day !== day)
        newHours.push(updated)

        // Sort by day order
        const dayOrder = DAY_OPTIONS.map((d) => d.key)
        newHours.sort(
            (a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
        )

        onChange(newHours)
    }

    const copyToAllDays = (sourceDay: OperatingHour["day"]) => {
        const source = getHoursForDay(sourceDay)
        const newHours = DAY_OPTIONS.map((d) => ({
            day: d.key,
            open: source.open,
            close: source.close,
            is_closed: source.is_closed,
        }))
        onChange(newHours)
    }

    return (
        <div className='space-y-3'>
            <div className='flex items-center justify-between mb-4'>
                <p className='text-sm text-text/60'>
                    Set opening and closing times for each day
                </p>
            </div>

            <div className='space-y-2'>
                {DAY_OPTIONS.map((day, idx) => {
                    const hours = getHoursForDay(day.key)

                    return (
                        <div
                            key={day.key}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                                hours.is_closed
                                    ? "border-text/10 bg-text/5"
                                    : "border-text/20 bg-background"
                            )}
                        >
                            {/* Day Label */}
                            <div className='w-24 shrink-0'>
                                <span className='font-medium text-sm'>
                                    {day.label}
                                </span>
                            </div>

                            {/* Closed Toggle */}
                            <label className='flex items-center gap-2 cursor-pointer'>
                                <input
                                    type='checkbox'
                                    checked={hours.is_closed || false}
                                    onChange={(e) =>
                                        updateDay(day.key, {
                                            is_closed: e.target.checked,
                                        })
                                    }
                                    className='w-4 h-4 rounded border-text/30 text-primary focus:ring-primary/20'
                                />
                                <span className='text-sm text-text/60'>
                                    Closed
                                </span>
                            </label>

                            {/* Time Inputs */}
                            {!hours.is_closed && (
                                <>
                                    <div className='flex items-center gap-2 ml-auto'>
                                        <Clock className='w-4 h-4 text-text/40' />
                                        <input
                                            type='time'
                                            value={hours.open}
                                            onChange={(e) =>
                                                updateDay(day.key, {
                                                    open: e.target.value,
                                                })
                                            }
                                            className='px-2 py-1 text-sm border border-text/20 rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none'
                                        />
                                        <span className='text-text/40'>to</span>
                                        <input
                                            type='time'
                                            value={hours.close}
                                            onChange={(e) =>
                                                updateDay(day.key, {
                                                    close: e.target.value,
                                                })
                                            }
                                            className='px-2 py-1 text-sm border border-text/20 rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none'
                                        />
                                    </div>

                                    {/* Copy to all button (only show on first row) */}
                                    {idx === 0 && (
                                        <button
                                            type='button'
                                            onClick={() =>
                                                copyToAllDays(day.key)
                                            }
                                            className='p-2 text-text/40 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer'
                                            title='Copy to all days'
                                        >
                                            <Copy className='w-4 h-4' />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
