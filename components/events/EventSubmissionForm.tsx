"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import {
    Loader2,
    ImageIcon,
    Trash2,
    CalendarIcon,
    MapPinIcon,
    LinkIcon,
    Clock,
    Send,
    CheckCircle,
    ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import {
    CommunityEventInput,
    submitCommunityEvent,
} from "@/app/api/actions/events"
import { uploadEventImageAction } from "@/utils/storage/actions"
import { compressEventCover } from "@/utils/image-processing"
import {
    PHILIPPINES_LOCATIONS,
    getProvincesForRegion,
    getCitiesForProvince,
} from "@/utils/data/philippines"

export default function EventSubmissionForm() {
    // Form state
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [startDateValue, setStartDateValue] = useState("")
    const [startTimeValue, setStartTimeValue] = useState("")
    const [endDateValue, setEndDateValue] = useState("")
    const [endTimeValue, setEndTimeValue] = useState("")
    const [locationName, setLocationName] = useState("")
    const [address, setAddress] = useState("")
    const [region, setRegion] = useState("")
    const [province, setProvince] = useState("")
    const [city, setCity] = useState("")
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [ticketLink, setTicketLink] = useState("")

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSuccess, setIsSuccess] = useState(false)

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

            const result = await uploadEventImageAction(formData)

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

    const handleSubmit = async () => {
        // Validation
        if (!title.trim()) {
            setError("Event title is required")
            return
        }
        if (!description.trim()) {
            setError("Event description is required")
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
        if (!locationName.trim()) {
            setError("Venue name is required")
            return
        }
        if (!address.trim()) {
            setError("Address is required")
            return
        }
        if (!region) {
            setError("Region is required")
            return
        }
        if (!ticketLink.trim()) {
            setError("Event link is required")
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

        const input: CommunityEventInput = {
            title: title.trim(),
            description: description.trim(),
            start_date: startDateTime,
            end_date: endDateTime,
            location_name: locationName.trim(),
            address: address.trim(),
            city: city || null,
            province: province || null,
            region,
            image_url: imageUrl,
            ticket_link: ticketLink.trim(),
        }

        try {
            const result = await submitCommunityEvent(input)

            if (result.success) {
                setIsSuccess(true)
            } else {
                setError(result.error || "Failed to submit event")
            }
        } catch (err) {
            setError("An unexpected error occurred")
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Success state
    if (isSuccess) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className='bg-background rounded-2xl shadow-lg p-8 text-center max-w-md mx-auto'
            >
                <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                    <CheckCircle className='w-8 h-8 text-green-600' />
                </div>
                <h2 className='text-2xl font-bold font-serif text-text mb-2'>
                    Event Submitted!
                </h2>
                <p className='text-text/70 mb-6'>
                    Thank you for submitting your event. Our team will review it
                    and you&apos;ll be notified once it&apos;s approved.
                </p>
                <Link
                    href='/community'
                    className='inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors'
                >
                    <ArrowLeft className='w-4 h-4' />
                    Back to Community
                </Link>
            </motion.div>
        )
    }

    return (
        <div className='bg-background rounded-2xl shadow-lg overflow-hidden [&_button]:cursor-pointer'>
            {/* Header */}
            <div className='px-6 py-4 border-b border-text/10'>
                <h2 className='text-xl font-bold font-serif text-text'>
                    Submit a Coffee Event
                </h2>
                <p className='text-sm text-text/60 mt-1'>
                    Share coffee-related events with the Grounds community
                </p>
            </div>

            {/* Info Banner */}
            <div className='bg-primary/10 border-b border-primary/20 px-6 py-3'>
                <p className='text-sm text-text/80'>
                    <strong>Note:</strong> All event submissions are reviewed by
                    our team before being published. You&apos;ll receive an
                    email once your event is approved.
                </p>
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
                            Cover Image (optional)
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
                            placeholder='e.g., Latte Art Competition 2024'
                            className='w-full px-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-lg font-medium'
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Description *
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder='Tell people about this event - what to expect, who should attend, etc.'
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
                                End Date & Time (optional)
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
                            Location *
                        </h3>
                        <input
                            type='text'
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            placeholder='Venue name *'
                            className='w-full px-4 py-2.5 rounded-xl border border-text/20 focus:border-primary outline-none text-sm'
                        />
                        <input
                            type='text'
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder='Full address *'
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
                            <option value=''>Select region *</option>
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
                            <option value=''>Select province (optional)</option>
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
                            <option value=''>Select city (optional)</option>
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

                    {/* Event Link */}
                    <div>
                        <label className='flex items-center gap-2 text-sm font-medium text-text mb-2'>
                            <LinkIcon className='w-4 h-4' />
                            Event / Registration Link *
                        </label>
                        <input
                            type='url'
                            value={ticketLink}
                            onChange={(e) => setTicketLink(e.target.value)}
                            placeholder='https://...'
                            className='w-full px-4 py-2.5 rounded-xl border border-text/20 focus:border-primary outline-none text-sm'
                        />
                        <p className='text-xs text-text/50 mt-1'>
                            Link to event page, tickets, or registration
                        </p>
                    </div>

                    {/* Submit Button */}
                    <div className='pt-4'>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className='w-full px-4 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                        >
                            {isSubmitting ? (
                                <Loader2 className='w-5 h-5 animate-spin' />
                            ) : (
                                <Send className='w-5 h-5' />
                            )}
                            Submit for Review
                        </button>
                        <p className='text-xs text-text/50 text-center mt-2'>
                            Your event will be reviewed before publishing
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
