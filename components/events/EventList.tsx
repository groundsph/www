"use client"

import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { EventWithCafe } from "@/utils/types/extra"
import EventCard from "./EventCard"
import { CalendarX } from "lucide-react"

interface EventListProps {
    events: EventWithCafe[]
    loading?: boolean
    emptyMessage?: string
    variant?: "grid" | "list"
}

export default function EventList({
    events,
    loading = false,
    emptyMessage = "No events found",
    variant = "grid",
}: EventListProps) {
    const parentRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: events.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100, // estimated compact event card height
        overscan: 5,
        measureElement:
            typeof window !== "undefined" && "ResizeObserver" in window
                ? (element) => element.getBoundingClientRect().height
                : undefined,
    })

    if (loading) {
        return (
            <div
                className={
                    variant === "grid"
                        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        : "flex flex-col gap-4"
                }
            >
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className='bg-text/5 rounded-xl animate-pulse'
                        style={{
                            height: variant === "grid" ? "320px" : "100px",
                        }}
                    />
                ))}
            </div>
        )
    }

    if (events.length === 0) {
        return (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
                <CalendarX className='w-16 h-16 text-text opacity-30 mb-4' />
                <p className='text-text/60 text-lg'>{emptyMessage}</p>
            </div>
        )
    }

    if (variant === "list") {
        return (
            <div ref={parentRef} className="overflow-auto">
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                        const event = events[virtualItem.index]
                        return (
                            <div
                                key={event.id}
                                ref={virtualizer.measureElement}
                                data-index={virtualItem.index}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    transform: `translateY(${virtualItem.start}px)`,
                                }}
                            >
                                <EventCard event={event} variant="compact" />
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
                <EventCard key={event.id} event={event} variant="default" />
            ))}
        </div>
    )
}
