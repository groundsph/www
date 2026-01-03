"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import {
    X,
    Save,
    Send,
    Loader2,
    ImageIcon,
    Trash2,
    CalendarIcon,
    MapPinIcon,
    LinkIcon,
    GlobeIcon,
    Clock,
} from "lucide-react"
import { EventWithCafe, EventStatus } from "@/utils/types/extra"
import { EventInput, createEvent, updateEvent } from "@/app/api/actions/events"
import { uploadEventImageAction } from "@/utils/storage/actions"
import { compressEventCover } from "@/utils/image-processing"
import {
    PHILIPPINES_LOCATIONS,
    getProvincesForRegion,
    getCitiesForProvince,
} from "@/utils/data/philippines"

interface EventEditorProps {
    event?: EventWithCafe
    cafeId?: string
    cafeName?: string
    onSuccess?: (event: EventWithCafe) => void
    onCancel?: () => void
}

export default function EventEditor({
    event,
    cafeId,
    cafeName,
    onSuccess,
    onCancel,
}: EventEditorProps) {
    // Form state
    const [title, setTitle] = useState(event?.title || "")
    const [description, setDescription] = useState(event?.description || "")

    // Split date and time for easier input
    const [startDateValue, setStartDateValue] = useState(
        event?.start_date
            ? new Date(event.start_date).toISOString().slice(0, 10)
            : ""
    )
    const [startTimeValue, setStartTimeValue] = useState(
        event?.start_date
            ? new Date(event.start_date).toTimeString().slice(0, 5)
            : ""
    )
    const [endDateValue, setEndDateValue] = useState(
        event?.end_date
            ? new Date(event.end_date).toISOString().slice(0, 10)
            : ""
    )
    const [endTimeValue, setEndTimeValue] = useState(
        event?.end_date
            ? new Date(event.end_date).toTimeString().slice(0, 5)
            : ""
    )
    const [locationName, setLocationName] = useState(event?.location_name || "")
    const [address, setAddress] = useState(event?.address || "")
    const [region, setRegion] = useState(event?.region || "")
    const [province, setProvince] = useState(event?.province || "")
    const [city, setCity] = useState(event?.city || "")
    const [imageUrl, setImageUrl] = useState<string | null>(
        event?.image_url || null
    )
    const [ticketLink, setTicketLink] = useState(event?.ticket_link || "")
    const [isNational, setIsNational] = useState(event?.is_national || false)

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setError(null)

        try {
            // Compress event cover (200KB JPEG)
            const compressedFile = await compressEventCover(file)

            const formData = new FormData()
            formData.append("image", compressedFile)

            const result = await uploadEventImageAction(formData, cafeId)

            if (result.success && result.url) {
                setImageUrl(result.url)
            } else {
                setError(result.error || "Failed to upload image")
            }
        } catch (err) {
            setError("Failed to upload image")
            console.error(err)
        } finally {
            setIsUploading(false)
        }
    }

    const handleSubmit = async (status: EventStatus) => {
        if (!title.trim()) {
            setError("Title is required")
            return
        }
        if (!startDateValue) {
            setError("Start date is required")
            return
        }
        if (!startTimeValue) {
            setError("Start time is required")
            return
        }

        setIsSubmitting(true)
        setError(null)

        // Combine date and time into ISO strings
        const startDateTime = new Date(
            `${startDateValue}T${startTimeValue}`
        ).toISOString()
        const endDateTime =
            endDateValue && endTimeValue
                ? new Date(`${endDateValue}T${endTimeValue}`).toISOString()
                : null

        const input: EventInput = {
            title: title.trim(),
            description: description.trim() || null,
            start_date: startDateTime,
            end_date: endDateTime,
            location_name: locationName.trim() || null,
            address: address.trim() || null,
            city: city || null,
            region: region || null,
            province: province || null,
            cafe_id: cafeId || null,
            image_url: imageUrl,
            ticket_link: ticketLink.trim() || null,
            is_national: isNational,
            status,
        }

        try {
            const result = event
                ? await updateEvent(event.id, input)
                : await createEvent(input)

            if (result.success && result.event) {
                onSuccess?.(result.event)
            } else {
                setError(result.error || "Failed to save event")
            }
        } catch (err) {
            setError("An unexpected error occurred")
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className='bg-background rounded-2xl shadow-lg overflow-hidden [&_button]:cursor-pointer'>
            {/* Header */}
            <div className='flex items-center justify-between px-6 py-4 border-b border-text/10'>
                <div>
                    <h2 className='text-xl font-bold font-serif text-text'>
                        {event ? "Edit Event" : "Create New Event"}
                    </h2>
                    {cafeName && (
                        <p className='text-sm text-text/60'>
                            Event for {cafeName}
                        </p>
                    )}
                </div>
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className='p-2 rounded-xl bg-text/5 text-text/60 hover:bg-text/10 transition-colors'
                    >
                        <X className='w-5 h-5' />
                    </button>
                )}
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className='bg-red-50 border-b border-red-100 px-6 py-3'
                    >
                        <p className='text-red-600 text-sm'>{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className='grid lg:grid-cols-3'>
                {/* Main Editor */}
                <div className='lg:col-span-2 p-6 space-y-6 border-r border-text/10'>
                    {/* Cover Image */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Cover Image
                        </label>
                        {imageUrl ? (
                            <div className='relative aspect-video rounded-xl overflow-hidden bg-text/5'>
                                <Image
                                    src={imageUrl}
                                    alt='Cover'
                                    fill
                                    className='object-cover'
                                />
                                <button
                                    onClick={() => setImageUrl(null)}
                                    className='absolute top-3 right-3 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors'
                                >
                                    <Trash2 className='w-4 h-4' />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className='w-full aspect-video rounded-xl border-2 border-dashed border-text/20 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-3 text-text/50 hover:text-primary'
                            >
                                {isUploading ? (
                                    <Loader2 className='w-8 h-8 animate-spin' />
                                ) : (
                                    <>
                                        <ImageIcon className='w-10 h-10' />
                                        <span className='text-sm font-medium'>
                                            Click to upload cover image
                                        </span>
                                        <span className='text-xs'>
                                            Recommended: 16:9 ratio, max 5MB
                                        </span>
                                    </>
                                )}
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type='file'
                            accept='image/*'
                            onChange={handleImageUpload}
                            className='hidden'
                        />
                    </div>

                    {/* Title */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Event Title *
                        </label>
                        <input
                            type='text'
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder='Enter event title...'
                            className='w-full px-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-lg font-medium'
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder='Tell people about this event...'
                            rows={4}
                            className='w-full px-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none'
                        />
                    </div>

                    {/* Date/Time */}
                    <div className='space-y-4'>
                        {/* Start Date/Time Row */}
                        <div>
                            <label className='flex items-center gap-2 text-sm font-medium text-text mb-2'>
                                <CalendarIcon className='w-4 h-4' />
                                Start Date & Time *
                            </label>
                            <div className='grid grid-cols-2 gap-3'>
                                <input
                                    type='date'
                                    value={startDateValue}
                                    onChange={(e) =>
                                        setStartDateValue(e.target.value)
                                    }
                                    className='w-full px-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none'
                                />
                                <div className='relative'>
                                    <Clock className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                                    <input
                                        type='time'
                                        value={startTimeValue}
                                        onChange={(e) =>
                                            setStartTimeValue(e.target.value)
                                        }
                                        className='w-full pl-11 pr-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none'
                                    />
                                </div>
                            </div>
                        </div>

                        {/* End Date/Time Row */}
                        <div>
                            <label className='flex items-center gap-2 text-sm font-medium text-text mb-2'>
                                <CalendarIcon className='w-4 h-4' />
                                End Date & Time
                            </label>
                            <div className='grid grid-cols-2 gap-3'>
                                <input
                                    type='date'
                                    value={endDateValue}
                                    onChange={(e) =>
                                        setEndDateValue(e.target.value)
                                    }
                                    className='w-full px-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none'
                                />
                                <div className='relative'>
                                    <Clock className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                                    <input
                                        type='time'
                                        value={endTimeValue}
                                        onChange={(e) =>
                                            setEndTimeValue(e.target.value)
                                        }
                                        className='w-full pl-11 pr-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className='p-6 space-y-6 bg-primary/5'>
                    {/* Location */}
                    <div className='space-y-3'>
                        <h3 className='flex items-center gap-2 text-sm font-medium text-text'>
                            <MapPinIcon className='w-4 h-4' />
                            Location
                        </h3>
                        <input
                            type='text'
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            placeholder='Venue name'
                            className='w-full px-4 py-2.5 rounded-xl border border-text/20 focus:border-primary outline-none text-sm'
                        />
                        <input
                            type='text'
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder='Full address'
                            className='w-full px-4 py-2.5 rounded-xl border border-text/20 focus:border-primary outline-none text-sm'
                        />

                        {/* Region Dropdown */}
                        <select
                            value={region}
                            onChange={(e) => {
                                setRegion(e.target.value)
                                setProvince("")
                                setCity("")
                            }}
                            className='w-full px-4 py-2.5 rounded-xl border border-text/20 focus:border-primary outline-none text-sm bg-background'
                        >
                            <option value=''>Select region</option>
                            {PHILIPPINES_LOCATIONS.regions.map((r) => (
                                <option
                                    key={r.name}
                                    value={r.name}
                                >
                                    {r.name}
                                </option>
                            ))}
                        </select>

                        {/* Province Dropdown */}
                        <select
                            value={province}
                            onChange={(e) => {
                                setProvince(e.target.value)
                                setCity("")
                            }}
                            disabled={!region}
                            className='w-full px-4 py-2.5 rounded-xl border border-text/20 focus:border-primary outline-none text-sm bg-background disabled:opacity-50'
                        >
                            <option value=''>Select province</option>
                            {region &&
                                getProvincesForRegion(region).map((p) => (
                                    <option
                                        key={p.name}
                                        value={p.name}
                                    >
                                        {p.name}
                                    </option>
                                ))}
                        </select>

                        {/* City Dropdown */}
                        <select
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            disabled={!province}
                            className='w-full px-4 py-2.5 rounded-xl border border-text/20 focus:border-primary outline-none text-sm bg-background disabled:opacity-50'
                        >
                            <option value=''>Select city</option>
                            {region &&
                                province &&
                                getCitiesForProvince(region, province).map(
                                    (c) => (
                                        <option
                                            key={c}
                                            value={c}
                                        >
                                            {c}
                                        </option>
                                    )
                                )}
                        </select>
                    </div>

                    {/* Ticket Link */}
                    <div>
                        <label className='flex items-center gap-2 text-sm font-medium text-text mb-2'>
                            <LinkIcon className='w-4 h-4' />
                            Ticket / Registration Link
                        </label>
                        <input
                            type='url'
                            value={ticketLink}
                            onChange={(e) => setTicketLink(e.target.value)}
                            placeholder='https://...'
                            className='w-full px-4 py-2.5 rounded-xl border border-text/20 focus:border-primary outline-none text-sm'
                        />
                    </div>

                    {/* National Toggle */}
                    {!cafeId && (
                        <div className='flex items-center justify-between py-3 border-y border-text/10'>
                            <label className='flex items-center gap-2 text-sm font-medium text-text'>
                                <GlobeIcon className='w-4 h-4' />
                                National Event
                            </label>
                            <button
                                onClick={() => setIsNational(!isNational)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    isNational ? "bg-primary" : "bg-text/20"
                                }`}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                        isNational ? "translate-x-6" : ""
                                    }`}
                                />
                            </button>
                        </div>
                    )}

                    {/* Actions */}
                    <div className='space-y-3 pt-4'>
                        <button
                            onClick={() => handleSubmit("draft")}
                            disabled={isSubmitting}
                            className='w-full px-4 py-3 rounded-xl border-2 border-text/20 text-text font-medium hover:bg-text/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                        >
                            {isSubmitting ? (
                                <Loader2 className='w-5 h-5 animate-spin' />
                            ) : (
                                <Save className='w-5 h-5' />
                            )}
                            Save as Draft
                        </button>
                        <button
                            onClick={() => handleSubmit("published")}
                            disabled={isSubmitting}
                            className='w-full px-4 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                        >
                            {isSubmitting ? (
                                <Loader2 className='w-5 h-5 animate-spin' />
                            ) : (
                                <Send className='w-5 h-5' />
                            )}
                            Publish Event
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
