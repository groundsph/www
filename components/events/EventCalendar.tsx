"use client"

import { Event } from "@/utils/types/extra"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useState, useMemo } from "react"
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    isToday,
    parseISO,
} from "date-fns"

interface EventCalendarProps {
    events: Event[]
    onDateSelect?: (date: Date, events: Event[]) => void
    loading?: boolean
}

export default function EventCalendar({
    events,
    onDateSelect,
    loading = false,
}: EventCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)

    // Group events by date
    const eventsByDate = useMemo(() => {
        const map = new Map<string, Event[]>()
        events.forEach((event) => {
            const dateKey = format(parseISO(event.start_date), "yyyy-MM-dd")
            const existing = map.get(dateKey) || []
            map.set(dateKey, [...existing, event])
        })
        return map
    }, [events])

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(monthStart)
        const startDate = startOfWeek(monthStart)
        const endDate = endOfWeek(monthEnd)

        const days: Date[] = []
        let day = startDate
        while (day <= endDate) {
            days.push(day)
            day = addDays(day, 1)
        }
        return days
    }, [currentMonth])

    const handleDateClick = (date: Date) => {
        setSelectedDate(date)
        const dateKey = format(date, "yyyy-MM-dd")
        const dateEvents = eventsByDate.get(dateKey) || []
        onDateSelect?.(date, dateEvents)
    }

    const getEventsForDate = (date: Date): Event[] => {
        const dateKey = format(date, "yyyy-MM-dd")
        return eventsByDate.get(dateKey) || []
    }

    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    if (loading) {
        return (
            <div className='bg-background rounded-xl border border-text/10 p-4'>
                <div className='h-96 bg-text/5 animate-pulse rounded-lg' />
            </div>
        )
    }

    return (
        <div className='bg-background rounded-xl border border-text/10 overflow-hidden'>
            {/* Header */}
            <div className='flex items-center justify-between p-4 border-b border-text/10'>
                <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className='p-2 hover:bg-text/5 rounded-lg transition-colors'
                    aria-label='Previous month'
                >
                    <ChevronLeftIcon className='w-5 h-5' />
                </button>
                <h2 className='text-lg font-semibold'>
                    {format(currentMonth, "MMMM yyyy")}
                </h2>
                <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className='p-2 hover:bg-text/5 rounded-lg transition-colors'
                    aria-label='Next month'
                >
                    <ChevronRightIcon className='w-5 h-5' />
                </button>
            </div>

            {/* Week days header */}
            <div className='grid grid-cols-7 border-b border-text/10'>
                {weekDays.map((day) => (
                    <div
                        key={day}
                        className='p-2 text-center text-sm font-medium text-text/60'
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className='grid grid-cols-7'>
                {calendarDays.map((day, idx) => {
                    const dayEvents = getEventsForDate(day)
                    const isCurrentMonth = isSameMonth(day, currentMonth)
                    const isSelected = selectedDate
                        ? isSameDay(day, selectedDate)
                        : false
                    const hasEvents = dayEvents.length > 0
                    const isTodayDate = isToday(day)

                    return (
                        <button
                            key={idx}
                            onClick={() => handleDateClick(day)}
                            className={`
                                relative p-2 min-h-[80px] border-b border-r border-text/5 
                                transition-colors text-left flex flex-col overflow-hidden
                                ${isCurrentMonth ? "hover:bg-text/5" : "bg-text/2"}
                                ${isSelected ? "bg-primary/10" : ""}
                            `}
                        >
                            <span
                                className={`
                                    w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium
                                    ${!isCurrentMonth ? "text-text/30" : "text-text"}
                                    ${isTodayDate ? "bg-primary text-background!" : ""}
                                    ${isSelected && !isTodayDate ? "bg-primary/60 text-background!" : ""}
                                `}
                            >
                                {format(day, "d")}
                            </span>

                            {/* Event indicators */}
                            {hasEvents && (
                                <div className='mt-1 space-y-0.5 flex-1 overflow-hidden w-full'>
                                    {dayEvents.slice(0, 2).map((event) => (
                                        <div
                                            key={event.id}
                                            className={`
                                                text-xs px-1.5 py-1 rounded w-full truncate block
                                                ${event.is_national ? "bg-primary/20 text-primary" : "bg-secondary text-white"}
                                            `}
                                            title={event.title}
                                        >
                                            {event.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 2 && (
                                        <div className='text-xs text-text/50 px-1'>
                                            +{dayEvents.length - 2} more
                                        </div>
                                    )}
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Legend */}
            <div className='flex items-center gap-4 p-3 border-t border-text/10 text-xs text-text/60'>
                <div className='flex items-center gap-1'>
                    <div className='w-3 h-3 rounded bg-primary/20' />
                    <span>National</span>
                </div>
                <div className='flex items-center gap-1'>
                    <div className='w-3 h-3 rounded bg-secondary/20' />
                    <span>Local</span>
                </div>
            </div>
        </div>
    )
}
