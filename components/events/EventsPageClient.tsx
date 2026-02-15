"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
    CalendarIcon,
    ListIcon,
    MapPinIcon,
    GlobeIcon,
    Loader2Icon,
    Coffee,
    Plus,
} from "lucide-react"
import { useUserLocation } from "@/hooks/useUserLocation"
import { getEvents, getEventsForMonth } from "@/app/api/actions/events"
import { EventWithCafe, Event } from "@/utils/types/extra"
import EventList from "@/components/events/EventList"
import EventCalendar from "@/components/events/EventCalendar"
import { format } from "date-fns"

type ViewMode = "list" | "calendar"
type ScopeMode = "local" | "national"

const PAGE_SIZE = 12

interface EventsPageClientProps {
    initialEvents?: EventWithCafe[]
    embedded?: boolean
}

export default function EventsPageClient({
    initialEvents = [],
    embedded = false,
}: EventsPageClientProps) {
    const { location, loading: locationLoading } = useUserLocation()
    const [viewMode, setViewMode] = useState<ViewMode>("list")
    const [scopeMode, setScopeMode] = useState<ScopeMode>("local")
    const [events, setEvents] = useState<EventWithCafe[]>(initialEvents)
    const [calendarEvents, setCalendarEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(initialEvents.length === 0)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [page, setPage] = useState(1)
    const [currentMonth] = useState(new Date())
    const [selectedDateEvents, setSelectedDateEvents] = useState<Event[]>([])

    // Ref for infinite scroll sentinel
    const loadMoreRef = useRef<HTMLDivElement>(null)

    // Initial fetch and reset when scope/location changes
    const fetchEvents = useCallback(
        async (pageNum: number = 1, reset: boolean = false) => {
            if (pageNum === 1) {
                setLoading(true)
            } else {
                setLoadingMore(true)
            }

            try {
                const now = new Date().toISOString()

                // Build filters based on scope
                // Local: Show events in user's region (fallback to all if no location)
                // National: Only show national events
                const filters: Parameters<typeof getEvents>[0] = {
                    start_after: now,
                }

                if (scopeMode === "national") {
                    filters.is_national = true
                }
                // Local mode: show all upcoming events (no region filter needed)
                // Nominatim returns province as 'state' but our events use PH region names
                // which don't match, so we show all events in local mode

                const { events: fetchedEvents, total } = await getEvents(
                    filters,
                    pageNum,
                    PAGE_SIZE
                )

                if (reset || pageNum === 1) {
                    setEvents(fetchedEvents)
                } else {
                    setEvents((prev) => [...prev, ...fetchedEvents])
                }

                // Check if there are more events to load
                const totalLoaded =
                    (pageNum - 1) * PAGE_SIZE + fetchedEvents.length
                setHasMore(totalLoaded < total)
                setPage(pageNum)
            } catch (error) {
                console.error("Failed to fetch events:", error)
            } finally {
                setLoading(false)
                setLoadingMore(false)
            }
        },
        [scopeMode]
    )

    // Load more events
    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore && !loading) {
            fetchEvents(page + 1)
        }
    }, [fetchEvents, page, loadingMore, hasMore, loading])

    // Fetch calendar events for current month
    const fetchCalendarEvents = useCallback(async () => {
        try {
            // Only filter by is_national for national mode
            const calendarFilters =
                scopeMode === "national" ? { is_national: true } : {}

            const monthEvents = await getEventsForMonth(
                currentMonth.getFullYear(),
                currentMonth.getMonth(),
                calendarFilters
            )
            setCalendarEvents(monthEvents)
        } catch (error) {
            console.error("Failed to fetch calendar events:", error)
        }
    }, [currentMonth, scopeMode])

    // Initial load and reset on scope change
    useEffect(() => {
        setPage(1)
        setHasMore(true)
        fetchEvents(1, true)
    }, [fetchEvents, scopeMode])

    // Calendar events
    useEffect(() => {
        if (!locationLoading && viewMode === "calendar") {
            fetchCalendarEvents()
        }
    }, [fetchCalendarEvents, locationLoading, viewMode])

    // Intersection Observer for infinite scroll
    useEffect(() => {
        if (viewMode !== "list") return

        const observer = new IntersectionObserver(
            (entries) => {
                if (
                    entries[0].isIntersecting &&
                    hasMore &&
                    !loadingMore &&
                    !loading
                ) {
                    loadMore()
                }
            },
            { threshold: 0.1, rootMargin: "100px" }
        )

        const sentinel = loadMoreRef.current
        if (sentinel) {
            observer.observe(sentinel)
        }

        return () => {
            if (sentinel) {
                observer.unobserve(sentinel)
            }
        }
    }, [viewMode, hasMore, loadingMore, loading, loadMore])

    const handleDateSelect = (date: Date, dateEvents: Event[]) => {
        setSelectedDateEvents(dateEvents)
    }

    return (
        <main
            className={`w-full [&_button]:cursor-pointer ${embedded ? "" : "min-h-screen"}`}
        >
            {/* Hero Section - Hide when embedded */}
            {!embedded && (
                <section className='relative bg-linear-to-br from-primary/10 via-secondary/5 to-tertiary/10 py-20 overflow-hidden'>
                    {/* Decorative Background Elements */}
                    <div className='absolute inset-0 pointer-events-none select-none overflow-hidden'>
                        <Coffee className='absolute -top-6 -right-6 w-48 h-48 text-primary opacity-5 rotate-12' />
                        <CalendarIcon className='absolute -bottom-12 -left-12 w-64 h-64 text-secondary opacity-5 -rotate-12' />
                        <div className='absolute top-1/4 right-1/4 w-32 h-32 bg-accent/5 rounded-full blur-3xl' />
                        <div className='absolute bottom-1/4 left-1/3 w-40 h-40 bg-primary/5 rounded-full blur-3xl' />
                        <MapPinIcon className='absolute top-20 right-[20%] w-16 h-16 text-text opacity-5 rotate-12' />
                    </div>

                    <div className='max-w-7xl mx-auto px-6 relative z-10'>
                        <span className='inline-block px-3 py-1 mb-4 bg-background/50 backdrop-blur-sm border border-text/5 rounded-full text-xs font-medium text-text/60 uppercase tracking-wider'>
                            Community & Culture
                        </span>
                        <h1 className='text-5xl md:text-6xl lg:text-7xl font-bold font-serif text-text mb-6 tracking-tight'>
                            Events
                        </h1>
                        <p className='text-xl md:text-2xl text-text/70 max-w-2xl font-light leading-relaxed'>
                            Discover meetups, workshops, cupping sessions, and
                            community gatherings happening across the
                            Philippines.
                        </p>

                        {/* Location indicator */}
                        {!locationLoading && location.city && (
                            <div className='mt-6 items-center gap-2 text-sm md:text-base text-text/60 font-medium bg-background/30 backdrop-blur-sm self-start inline-flex px-4 py-2 rounded-full border border-text/5 shadow-sm'>
                                <MapPinIcon className='w-4 h-4 text-primary' />
                                <span>
                                    Showing events in{" "}
                                    <span className='text-text'>
                                        {location.city}
                                    </span>
                                    {location.region && (
                                        <span>, {location.region}</span>
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Controls */}
            <section
                className={`${embedded ? "" : "sticky top-0"} z-20 bg-background/95 backdrop-blur-sm`}
            >
                <div className='max-w-7xl mx-auto px-6 py-4'>
                    <div className='flex flex-wrap items-center justify-between gap-4'>
                        {/* Scope Toggle */}
                        <div className='flex bg-text/5 rounded-lg p-1'>
                            <button
                                onClick={() => setScopeMode("local")}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                                    ${scopeMode === "local" ? "bg-background shadow-sm text-text" : "text-text/60 hover:text-text"}
                                `}
                            >
                                <MapPinIcon className='w-4 h-4' />
                                Local
                            </button>
                            <button
                                onClick={() => setScopeMode("national")}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                                    ${scopeMode === "national" ? "bg-background shadow-sm text-text" : "text-text/60 hover:text-text"}
                                `}
                            >
                                <GlobeIcon className='w-4 h-4' />
                                National
                            </button>
                        </div>

                        <div className='flex flex-row gap-4 flex-wrap items-center'>
                            {/* View Toggle */}
                            <div className='flex bg-text/5 rounded-lg p-1'>
                                <button
                                    onClick={() => setViewMode("list")}
                                    className={`
                                    flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                                    ${viewMode === "list" ? "bg-background shadow-sm text-text" : "text-text/60 hover:text-text"}
                                `}
                                >
                                    <ListIcon className='w-4 h-4' />
                                    List
                                </button>
                                <button
                                    onClick={() => setViewMode("calendar")}
                                    className={`
                                    flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                                    ${viewMode === "calendar" ? "bg-background shadow-sm text-text" : "text-text/60 hover:text-text"}
                                `}
                                >
                                    <CalendarIcon className='w-4 h-4' />
                                    Calendar
                                </button>
                            </div>
                            {/* Submit Event Link */}
                            <Link
                                href='/community/submit-event'
                                className='flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors'
                            >
                                <Plus className='w-4 h-4' />
                                Submit Event
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Content */}
            <section className='max-w-6xl mx-auto px-6 py-8'>
                {locationLoading ? (
                    <div className='flex items-center justify-center py-16'>
                        <Loader2Icon className='w-8 h-8 animate-spin text-primary' />
                        <span className='ml-3 text-text/60'>
                            Detecting your location...
                        </span>
                    </div>
                ) : viewMode === "list" ? (
                    <>
                        <EventList
                            events={events}
                            loading={loading}
                            emptyMessage={
                                scopeMode === "local"
                                    ? `No local events found${location.city ? ` in ${location.city}` : ""}. Check out national events!`
                                    : "No national events at the moment. Check back soon!"
                            }
                        />

                        {/* Infinite scroll sentinel */}
                        <div
                            ref={loadMoreRef}
                            className='py-8 flex justify-center'
                        >
                            {loadingMore && (
                                <div className='flex items-center gap-2 text-text/60'>
                                    <Loader2Icon className='w-5 h-5 animate-spin' />
                                    <span>Loading more events...</span>
                                </div>
                            )}
                            {!hasMore && events.length > 0 && (
                                <p className='text-text/40 text-sm'>
                                    You&apos;ve seen all events
                                </p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                        <div className='lg:col-span-2'>
                            <EventCalendar
                                events={calendarEvents}
                                onDateSelect={handleDateSelect}
                                loading={loading}
                            />
                        </div>
                        <div className='space-y-4'>
                            <h3 className='font-semibold text-lg'>
                                {selectedDateEvents.length > 0
                                    ? `Events on ${format(new Date(), "MMM d")}`
                                    : "Select a date"}
                            </h3>
                            {selectedDateEvents.length > 0 ? (
                                <div className='space-y-3'>
                                    {selectedDateEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className='p-4 bg-text/5 rounded-lg'
                                        >
                                            <h4 className='font-semibold'>
                                                {event.title}
                                            </h4>
                                            {event.location_name && (
                                                <p className='text-sm text-text/60'>
                                                    {event.location_name}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className='text-text/60 text-sm'>
                                    Click on a date with events to see details.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </section>
        </main>
    )
}
