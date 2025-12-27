"use client"

import { OperatingHour } from "@/utils/types/cafe"
import { Copy, Clock, Clock12 } from "lucide-react"
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
    // Check if all days are 24/7
    const isAll24Hours = DAY_OPTIONS.every((day) => {
        const hours = value.find((h) => h.day === day.key)
        return hours?.is_24_hours === true
    })

    // Initialize hours for all days if not present
    const getHoursForDay = (day: OperatingHour["day"]): OperatingHour => {
        const existing = value.find((h) => h.day === day)
        return (
            existing || {
                day,
                open: "08:00",
                close: "20:00",
                is_closed: false,
                is_24_hours: false,
            }
        )
    }

    const updateDay = (
        day: OperatingHour["day"],
        updates: Partial<OperatingHour>
    ) => {
        const current = getHoursForDay(day)
        const updated = { ...current, ...updates }

        // If setting to 24 hours, ensure not closed
        if (updates.is_24_hours) {
            updated.is_closed = false
        }
        // If setting to closed, ensure not 24 hours
        if (updates.is_closed) {
            updated.is_24_hours = false
        }

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
            is_24_hours: source.is_24_hours,
        }))
        onChange(newHours)
    }

    const toggleAll24Hours = () => {
        if (isAll24Hours) {
            // Turn off 24/7 mode - set default hours
            const newHours = DAY_OPTIONS.map((d) => ({
                day: d.key,
                open: "08:00",
                close: "20:00",
                is_closed: false,
                is_24_hours: false,
            }))
            onChange(newHours)
        } else {
            // Turn on 24/7 mode for all days
            const newHours = DAY_OPTIONS.map((d) => ({
                day: d.key,
                open: "00:00",
                close: "23:59",
                is_closed: false,
                is_24_hours: true,
            }))
            onChange(newHours)
        }
    }

    return (
        <div className='space-y-3'>
            {/* Global 24/7 Toggle */}
            <div className='flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/5'>
                <div className='flex items-center gap-2'>
                    <Clock12 className='w-5 h-5 text-primary' />
                    <div>
                        <span className='font-medium text-sm'>
                            24/7 Operation
                        </span>
                        <p className='text-xs text-text/60'>
                            Open all day, every day
                        </p>
                    </div>
                </div>
                <button
                    type='button'
                    onClick={toggleAll24Hours}
                    className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer",
                        isAll24Hours ? "bg-primary" : "bg-text/20"
                    )}
                >
                    <span
                        className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            isAll24Hours ? "translate-x-6" : "translate-x-1"
                        )}
                    />
                </button>
            </div>

            <div className='flex items-center justify-between mb-4'>
                <p className='text-sm text-text/60'>
                    Set opening and closing times for each day
                </p>
            </div>

            <div className='space-y-2 w-full overflow-x-auto'>
                {DAY_OPTIONS.map((day, idx) => {
                    const hours = getHoursForDay(day.key)

                    return (
                        <div
                            key={day.key}
                            className={cn(
                                "flex items-center w-max gap-3 p-3 rounded-xl border transition-colors",
                                hours.is_closed
                                    ? "border-text/10 bg-text/5"
                                    : hours.is_24_hours
                                      ? "border-primary/30 bg-primary/5"
                                      : "border-text/20 bg-background"
                            )}
                        >
                            {/* Day Label */}
                            <div className='w-24 shrink-0'>
                                <span className='font-medium text-sm'>
                                    {day.label}
                                </span>
                            </div>

                            {/* 24 Hours Toggle */}
                            <label className='flex items-center gap-2 cursor-pointer'>
                                <input
                                    type='checkbox'
                                    checked={hours.is_24_hours || false}
                                    onChange={(e) =>
                                        updateDay(day.key, {
                                            is_24_hours: e.target.checked,
                                        })
                                    }
                                    disabled={hours.is_closed}
                                    className='w-4 h-4 rounded border-text/30 text-primary focus:ring-primary/20 disabled:opacity-50'
                                />
                                <span
                                    className={cn(
                                        "text-sm",
                                        hours.is_24_hours
                                            ? "text-primary font-medium"
                                            : "text-text/60"
                                    )}
                                >
                                    24 Hours
                                </span>
                            </label>

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
                            {!hours.is_closed && !hours.is_24_hours && (
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

                            {/* Show 24 Hours indicator instead of time inputs */}
                            {hours.is_24_hours && !hours.is_closed && (
                                <div className='flex items-center gap-2 ml-auto text-primary'>
                                    <Clock12 className='w-4 h-4' />
                                    <span className='text-sm font-medium'>
                                        Open 24 Hours
                                    </span>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
