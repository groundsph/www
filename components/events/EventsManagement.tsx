"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    CalendarIcon,
    PlusIcon,
    Edit2Icon,
    Trash2Icon,
    CheckCircleIcon,
    XCircleIcon,
    Loader2Icon,
    ExternalLinkIcon,
} from "lucide-react"
import { EventWithCafe } from "@/utils/types/extra"
import {
    deleteEvent,
    publishEvent,
    cancelEvent,
} from "@/app/api/actions/events"
import EventEditor from "@/components/events/EventEditor"
import { format } from "date-fns"
import Image from "next/image"

interface EventsManagementProps {
    initialEvents: EventWithCafe[]
    cafeId?: string
    cafeName?: string
}

export default function EventsManagement({
    initialEvents,
    cafeId,
    cafeName,
}: EventsManagementProps) {
    const [events, setEvents] = useState<EventWithCafe[]>(initialEvents)
    const [showEditor, setShowEditor] = useState(false)
    const [editingEvent, setEditingEvent] = useState<EventWithCafe | null>(null)
    const [loadingId, setLoadingId] = useState<string | null>(null)

    const handleCreateSuccess = (event: EventWithCafe) => {
        setEvents((prev) => [event, ...prev])
        setShowEditor(false)
        setEditingEvent(null)
    }

    const handleEditSuccess = (event: EventWithCafe) => {
        setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)))
        setShowEditor(false)
        setEditingEvent(null)
    }

    const handleDelete = async (eventId: string) => {
        if (!confirm("Are you sure you want to delete this event?")) return

        setLoadingId(eventId)
        const result = await deleteEvent(eventId)
        setLoadingId(null)

        if (result.success) {
            setEvents((prev) => prev.filter((e) => e.id !== eventId))
        } else {
            alert(result.error || "Failed to delete event")
        }
    }

    const handlePublish = async (eventId: string) => {
        setLoadingId(eventId)
        const result = await publishEvent(eventId)
        setLoadingId(null)

        if (result.success && result.event) {
            setEvents((prev) =>
                prev.map((e) => (e.id === eventId ? result.event! : e))
            )
        } else {
            alert(result.error || "Failed to publish event")
        }
    }

    const handleCancel = async (eventId: string) => {
        setLoadingId(eventId)
        const result = await cancelEvent(eventId)
        setLoadingId(null)

        if (result.success && result.event) {
            setEvents((prev) =>
                prev.map((e) => (e.id === eventId ? result.event! : e))
            )
        } else {
            alert(result.error || "Failed to cancel event")
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "published":
                return (
                    <span className='px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full'>
                        Published
                    </span>
                )
            case "draft":
                return (
                    <span className='px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full'>
                        Draft
                    </span>
                )
            case "cancelled":
                return (
                    <span className='px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full'>
                        Cancelled
                    </span>
                )
            default:
                return null
        }
    }

    return (
        <div className='space-y-6'>
            {/* Header */}
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                    <CalendarIcon className='w-6 h-6 text-primary' />
                    <h2 className='text-xl font-bold font-serif'>
                        {cafeId ? "Cafe Events" : "Events Management"}
                    </h2>
                    <span className='px-2 py-0.5 bg-text/10 text-text/60 text-sm rounded-full'>
                        {events.length} events
                    </span>
                </div>
                <button
                    onClick={() => {
                        setEditingEvent(null)
                        setShowEditor(true)
                    }}
                    className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors'
                >
                    <PlusIcon className='w-4 h-4' />
                    Create Event
                </button>
            </div>

            {/* Editor Modal */}
            <AnimatePresence>
                {showEditor && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className='fixed inset-0 z-50 flex justify-center p-4 bg-black/50 h-screen overflow-y-auto items-start'
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className='w-full max-w-6xl overflow-y-auto'
                        >
                            <EventEditor
                                event={editingEvent || undefined}
                                cafeId={cafeId}
                                cafeName={cafeName}
                                onSuccess={
                                    editingEvent
                                        ? handleEditSuccess
                                        : handleCreateSuccess
                                }
                                onCancel={() => {
                                    setShowEditor(false)
                                    setEditingEvent(null)
                                }}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Events List */}
            {events.length === 0 ? (
                <div className='py-16 text-center'>
                    <CalendarIcon className='w-12 h-12 mx-auto text-text/20 mb-4' />
                    <p className='text-text/60 font-medium'>No events yet</p>
                    <p className='text-text/40 text-sm mt-1'>
                        Create your first event to get started
                    </p>
                </div>
            ) : (
                <div className='space-y-4'>
                    {events.map((event) => (
                        <div
                            key={event.id}
                            className='flex gap-4 p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-colors'
                        >
                            {/* Image */}
                            <div className='relative w-32 h-20 shrink-0 rounded-lg overflow-hidden bg-text/5'>
                                {event.image_url ? (
                                    <Image
                                        src={event.image_url}
                                        alt={event.title}
                                        fill
                                        className='object-cover'
                                    />
                                ) : (
                                    <div className='w-full h-full flex items-center justify-center'>
                                        <CalendarIcon className='w-8 h-8 text-text/20' />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className='flex-1 min-w-0'>
                                <div className='flex items-start justify-between gap-4'>
                                    <div>
                                        <h3 className='font-semibold text-text truncate'>
                                            {event.title}
                                        </h3>
                                        <p className='text-sm text-text/60'>
                                            {format(
                                                new Date(event.start_date),
                                                "MMM d, yyyy 'at' h:mm a"
                                            )}
                                        </p>
                                        {event.location_name && (
                                            <p className='text-sm text-text/50 truncate'>
                                                {event.location_name}
                                            </p>
                                        )}
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        {getStatusBadge(event.status)}
                                        {event.is_national && (
                                            <span className='px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full'>
                                                National
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className='flex items-center gap-2'>
                                {loadingId === event.id ? (
                                    <Loader2Icon className='w-5 h-5 animate-spin text-text/40' />
                                ) : (
                                    <>
                                        {event.status === "draft" && (
                                            <button
                                                onClick={() =>
                                                    handlePublish(event.id)
                                                }
                                                title='Publish'
                                                className='p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors'
                                            >
                                                <CheckCircleIcon className='w-5 h-5' />
                                            </button>
                                        )}
                                        {event.status === "published" && (
                                            <button
                                                onClick={() =>
                                                    handleCancel(event.id)
                                                }
                                                title='Cancel Event'
                                                className='p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors'
                                            >
                                                <XCircleIcon className='w-5 h-5' />
                                            </button>
                                        )}
                                        {event.ticket_link && (
                                            <a
                                                href={event.ticket_link}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                title='View Ticket Link'
                                                className='p-2 text-text/60 hover:bg-text/5 rounded-lg transition-colors'
                                            >
                                                <ExternalLinkIcon className='w-5 h-5' />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => {
                                                setEditingEvent(event)
                                                setShowEditor(true)
                                            }}
                                            title='Edit'
                                            className='p-2 text-text/60 hover:bg-text/5 rounded-lg transition-colors'
                                        >
                                            <Edit2Icon className='w-5 h-5' />
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleDelete(event.id)
                                            }
                                            title='Delete'
                                            className='p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors'
                                        >
                                            <Trash2Icon className='w-5 h-5' />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
