"use client"

import { EventWithCafe } from "@/utils/types/extra"
import { CalendarIcon, MapPinIcon, TicketIcon, Clock } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { format, isSameDay } from "date-fns"

interface EventCardProps {
    event: EventWithCafe
    variant?: "default" | "compact"
}

export default function EventCard({
    event,
    variant = "default",
}: EventCardProps) {
    const startDate = new Date(event.start_date)
    const endDate = event.end_date ? new Date(event.end_date) : null

    // Format date range
    const formatDateRange = () => {
        if (!endDate || isSameDay(startDate, endDate)) {
            return format(startDate, "MMM d, yyyy")
        }
        if (
            startDate.getMonth() === endDate.getMonth() &&
            startDate.getFullYear() === endDate.getFullYear()
        ) {
            return `${format(startDate, "MMM d")} - ${format(endDate, "d, yyyy")}`
        }
        return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`
    }

    // Format time
    const formatTime = () => {
        const time = format(startDate, "h:mm a")
        if (endDate && !isSameDay(startDate, endDate)) {
            return time
        }
        if (endDate) {
            return `${time} - ${format(endDate, "h:mm a")}`
        }
        return time
    }

    if (variant === "compact") {
        return (
            <div className='flex gap-3 p-3 bg-background rounded-lg border border-text/10 hover:border-primary/30 transition-colors'>
                <div className='flex flex-col items-center justify-center bg-primary/10 text-primary rounded-lg px-3 py-2 min-w-[60px]'>
                    <span className='text-xs font-medium uppercase'>
                        {format(startDate, "MMM")}
                    </span>
                    <span className='text-2xl font-bold'>
                        {format(startDate, "d")}
                    </span>
                </div>
                <div className='flex-1 min-w-0'>
                    <h3 className='font-semibold text-text truncate'>
                        {event.title}
                    </h3>
                    <div className='flex items-center gap-1 text-sm text-text/60'>
                        <Clock className='w-3 h-3' />
                        <span>{formatTime()}</span>
                    </div>
                    {event.location_name && (
                        <div className='flex items-center gap-1 text-sm text-text/60 truncate'>
                            <MapPinIcon className='w-3 h-3 shrink-0' />
                            <span className='truncate'>
                                {event.location_name}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <article className='group bg-background rounded-xl border border-text/10 overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all'>
            {/* Image */}
            <div className='relative aspect-video bg-text/5'>
                {event.image_url ? (
                    <Image
                        src={event.image_url}
                        alt={event.title}
                        fill
                        className='object-cover group-hover:scale-105 transition-transform duration-300'
                    />
                ) : (
                    <div className='absolute inset-0 flex items-center justify-center'>
                        <CalendarIcon className='w-16 h-16 text-text/20' />
                    </div>
                )}
                {/* Date badge */}
                <div className='absolute top-3 left-3 flex flex-col items-center bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md'>
                    <span className='text-xs font-medium text-primary uppercase'>
                        {format(startDate, "MMM")}
                    </span>
                    <span className='text-2xl font-bold text-text'>
                        {format(startDate, "d")}
                    </span>
                </div>
                {/* National badge */}
                {event.is_national && (
                    <div className='absolute top-3 right-3 bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full'>
                        National
                    </div>
                )}
            </div>

            {/* Content */}
            <div className='p-4 space-y-3'>
                <h3 className='font-serif text-xl font-semibold text-text line-clamp-2 group-hover:text-primary transition-colors'>
                    {event.title}
                </h3>

                {event.description && (
                    <p className='text-sm text-text/70 line-clamp-2'>
                        {event.description}
                    </p>
                )}

                {/* Meta info */}
                <div className='space-y-2'>
                    <div className='flex items-center gap-2 text-sm text-text/60'>
                        <CalendarIcon className='w-4 h-4 shrink-0' />
                        <span>{formatDateRange()}</span>
                        <span className='text-text/30'>•</span>
                        <span>{formatTime()}</span>
                    </div>

                    {event.location_name && (
                        <div className='flex items-center gap-2 text-sm text-text/60'>
                            <MapPinIcon className='w-4 h-4 shrink-0' />
                            <span className='truncate'>
                                {event.location_name}
                                {event.city && `, ${event.city}`}
                            </span>
                        </div>
                    )}

                    {event.cafe && (
                        <Link
                            href={`/cafes/${event.cafe.slug}`}
                            className='flex items-center gap-2 text-sm text-primary hover:underline'
                        >
                            <div className='relative w-5 h-5 rounded-full overflow-hidden'>
                                <Image
                                    src={event.cafe.thumbnail}
                                    alt={event.cafe.name}
                                    fill
                                    className='object-cover'
                                />
                            </div>
                            <span>Hosted by {event.cafe.name}</span>
                        </Link>
                    )}
                </div>

                {/* Actions */}
                <div className='flex gap-2 pt-2'>
                    {event.ticket_link && (
                        <a
                            href={event.ticket_link}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors'
                        >
                            <TicketIcon className='w-4 h-4' />
                            Get Tickets
                        </a>
                    )}
                </div>
            </div>
        </article>
    )
}
