"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import {
    Calendar,
    Plus,
    Search,
    Trash2,
    Edit2,
    X,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Star,
    MapPin,
    AlertTriangle,
} from "lucide-react"
import {
    FeaturedSchedule,
    createFeaturedSchedule,
    updateFeaturedSchedule,
    deleteFeaturedSchedule,
    searchCafesForFeatured,
    checkFeaturedConflict,
} from "@/app/api/actions/admin"
import { getCafeThumbnailUrl } from "@/utils/extras"

interface FeaturedScheduleManagerProps {
    initialSchedules: FeaturedSchedule[]
}

interface CafeSearchResult {
    id: string
    name: string
    slug: string
    thumbnail: string
    city_municipality: string
    region: string
}

export default function FeaturedScheduleManager({
    initialSchedules,
}: FeaturedScheduleManagerProps) {
    const [schedules, setSchedules] = useState(initialSchedules)
    const [showModal, setShowModal] = useState(false)
    const [editingSchedule, setEditingSchedule] =
        useState<FeaturedSchedule | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Calendar state
    const [currentMonth, setCurrentMonth] = useState(new Date())

    // Form state
    const [formData, setFormData] = useState({
        cafe_id: "",
        start_date: "",
        end_date: "",
        region_context: "" as string | null,
        priority: 1,
        custom_title: "",
        custom_description: "",
    })
    const [selectedCafe, setSelectedCafe] = useState<CafeSearchResult | null>(
        null
    )

    // Cafe search state
    const [cafeSearchQuery, setCafeSearchQuery] = useState("")
    const [cafeSearchResults, setCafeSearchResults] = useState<
        CafeSearchResult[]
    >([])
    const [searchLoading, setSearchLoading] = useState(false)

    // Conflict warning state
    const [conflictWarning, setConflictWarning] = useState<string | null>(null)

    // Debounced cafe search
    useEffect(() => {
        // Short queries don't need a search - results will be cleared on render
        if (cafeSearchQuery.length < 2) {
            return
        }

        const timer = setTimeout(async () => {
            setSearchLoading(true)
            const results = await searchCafesForFeatured(cafeSearchQuery)
            setCafeSearchResults(results)
            setSearchLoading(false)
        }, 300)

        return () => clearTimeout(timer)
    }, [cafeSearchQuery])

    // Clear results when query is too short (derived state pattern)
    const displayedResults = cafeSearchQuery.length < 2 ? [] : cafeSearchResults

    // Check for conflicts when dates/region change
    useEffect(() => {
        const checkConflicts = async () => {
            if (!formData.start_date || !formData.end_date) {
                setConflictWarning(null)
                return
            }

            const result = await checkFeaturedConflict(
                formData.start_date,
                formData.end_date,
                formData.region_context || null,
                editingSchedule?.id
            )

            if (result.hasConflict) {
                setConflictWarning(
                    `Conflict: ${result.conflictingCafe} is already featured`
                )
            } else {
                setConflictWarning(null)
            }
        }

        const timer = setTimeout(checkConflicts, 300)
        return () => clearTimeout(timer)
    }, [
        formData.start_date,
        formData.end_date,
        formData.region_context,
        editingSchedule?.id,
    ])

    const openCreateModal = () => {
        setEditingSchedule(null)
        setFormData({
            cafe_id: "",
            start_date: new Date().toISOString().split("T")[0],
            end_date: new Date().toISOString().split("T")[0],
            region_context: null,
            priority: 1,
            custom_title: "",
            custom_description: "",
        })
        setSelectedCafe(null)
        setCafeSearchQuery("")
        setCafeSearchResults([])
        setError(null)
        setConflictWarning(null)
        setShowModal(true)
    }

    const openEditModal = (schedule: FeaturedSchedule) => {
        setEditingSchedule(schedule)
        setFormData({
            cafe_id: schedule.cafe_id,
            start_date: schedule.start_date.split("T")[0],
            end_date: schedule.end_date.split("T")[0],
            region_context: schedule.region_context,
            priority: schedule.priority ?? 1,
            custom_title: schedule.custom_title ?? "",
            custom_description: schedule.custom_description ?? "",
        })
        setSelectedCafe(schedule.cafe as CafeSearchResult)
        setCafeSearchQuery("")
        setCafeSearchResults([])
        setError(null)
        setConflictWarning(null)
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingSchedule(null)
        setError(null)
    }

    const handleCafeSelect = (cafe: CafeSearchResult) => {
        setSelectedCafe(cafe)
        // Auto-populate city from cafe (most specific targeting), user can change it
        setFormData((prev) => ({
            ...prev,
            cafe_id: cafe.id,
            region_context: cafe.city_municipality || null,
        }))
        setCafeSearchQuery("")
        setCafeSearchResults([])
    }

    const handleSubmit = async () => {
        if (!formData.cafe_id) {
            setError("Please select a cafe")
            return
        }
        if (!formData.start_date || !formData.end_date) {
            setError("Please select start and end dates")
            return
        }
        if (new Date(formData.end_date) < new Date(formData.start_date)) {
            setError("End date must be after start date")
            return
        }
        if (conflictWarning) {
            setError("Please resolve the scheduling conflict first")
            return
        }

        setLoading(true)
        setError(null)

        if (editingSchedule) {
            // Update
            const result = await updateFeaturedSchedule(editingSchedule.id, {
                cafe_id: formData.cafe_id,
                start_date: formData.start_date,
                end_date: formData.end_date,
                region_context: formData.region_context || null,
                priority: formData.priority,
                custom_title: formData.custom_title || null,
                custom_description: formData.custom_description || null,
            })

            if (result.success) {
                // Update local state
                setSchedules((prev) =>
                    prev.map((s) =>
                        s.id === editingSchedule.id
                            ? {
                                  ...s,
                                  ...formData,
                                  region_context:
                                      formData.region_context || null,
                                  cafe: selectedCafe,
                              }
                            : s
                    )
                )
                closeModal()
            } else {
                setError(result.error || "Failed to update schedule")
            }
        } else {
            // Create
            const result = await createFeaturedSchedule({
                cafe_id: formData.cafe_id,
                start_date: formData.start_date,
                end_date: formData.end_date,
                region_context: formData.region_context || null,
                priority: formData.priority,
                custom_title: formData.custom_title || undefined,
                custom_description: formData.custom_description || undefined,
            })

            if (result.success && result.schedule) {
                setSchedules((prev) => [...prev, result.schedule!])
                closeModal()
            } else {
                setError(result.error || "Failed to create schedule")
            }
        }

        setLoading(false)
    }

    const handleDelete = async (scheduleId: string) => {
        if (
            !confirm("Are you sure you want to delete this featured schedule?")
        ) {
            return
        }

        const result = await deleteFeaturedSchedule(scheduleId)
        if (result.success) {
            setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
        } else {
            alert(result.error || "Failed to delete schedule")
        }
    }

    // Calendar helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startDayOfWeek = firstDay.getDay()

        const days: (number | null)[] = []
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null)
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i)
        }
        return days
    }

    const getSchedulesForDay = (day: number) => {
        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        return schedules.filter((s) => {
            const start = s.start_date.split("T")[0]
            const end = s.end_date.split("T")[0]
            return dateStr >= start && dateStr <= end
        })
    }

    const getScheduleStatus = (schedule: FeaturedSchedule) => {
        const now = new Date().toISOString().split("T")[0]
        const start = schedule.start_date.split("T")[0]
        const end = schedule.end_date.split("T")[0]

        if (now < start) return "upcoming"
        if (now > end) return "expired"
        return "active"
    }

    const prevMonth = () => {
        setCurrentMonth(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
        )
    }

    const nextMonth = () => {
        setCurrentMonth(
            (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
        )
    }

    const today = new Date()
    const days = getDaysInMonth(currentMonth)

    return (
        <div className='space-y-6'>
            {/* Header */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                <div>
                    <h2 className='text-xl font-semibold flex items-center gap-2'>
                        <Star className='w-5 h-5 text-accent' />
                        Featured Schedules
                    </h2>
                    <p className='text-text/60 text-sm mt-1'>
                        Schedule cafes to be featured on the homepage. Only one
                        cafe per region per date.
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className='flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition shadow-sm w-full sm:w-auto'
                >
                    <Plus className='w-4 h-4' />
                    Add Featured
                </button>
            </div>

            {/* Calendar View */}
            <div className='bg-text/5 border border-text/10 rounded-xl p-2 sm:p-4 overflow-x-auto'>
                <div className='flex items-center justify-between mb-4'>
                    <button
                        onClick={prevMonth}
                        className='p-2 hover:bg-text/10 rounded-lg transition'
                    >
                        <ChevronLeft className='w-5 h-5' />
                    </button>
                    <h3 className='text-lg font-medium'>
                        {currentMonth.toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                        })}
                    </h3>
                    <button
                        onClick={nextMonth}
                        className='p-2 hover:bg-text/10 rounded-lg transition'
                    >
                        <ChevronRight className='w-5 h-5' />
                    </button>
                </div>

                <div className='grid grid-cols-7 gap-0.5 sm:gap-1 min-w-[280px]'>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                            <div
                                key={day}
                                className='text-center text-xs text-text/60 py-2 font-medium'
                            >
                                {day}
                            </div>
                        )
                    )}

                    {days.map((day, idx) => {
                        if (day === null) {
                            return (
                                <div
                                    key={`empty-${idx}`}
                                    className='aspect-square'
                                />
                            )
                        }

                        const daySchedules = getSchedulesForDay(day)
                        const isToday =
                            day === today.getDate() &&
                            currentMonth.getMonth() === today.getMonth() &&
                            currentMonth.getFullYear() === today.getFullYear()

                        return (
                            <div
                                key={day}
                                className={`aspect-square p-1 border rounded-lg ${
                                    isToday
                                        ? "border-accent bg-accent/10"
                                        : "border-text/5"
                                }`}
                            >
                                <div
                                    className={`text-xs ${isToday ? "text-accent font-bold" : "text-text/60"}`}
                                >
                                    {day}
                                </div>
                                <div className='mt-0.5 space-y-0.5 overflow-hidden max-h-[calc(100%-16px)]'>
                                    {daySchedules
                                        .slice(0, 2)
                                        .map((schedule) => (
                                            <div
                                                key={schedule.id}
                                                onClick={() =>
                                                    openEditModal(schedule)
                                                }
                                                className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer ${
                                                    schedule.region_context
                                                        ? "bg-blue-500/20 text-blue-400"
                                                        : "bg-accent/20 text-accent"
                                                }`}
                                                title={`${schedule.cafe?.name} (${schedule.region_context || "Global"})`}
                                            >
                                                {schedule.cafe?.name}
                                            </div>
                                        ))}
                                    {daySchedules.length > 2 && (
                                        <div className='text-[10px] text-text/40'>
                                            +{daySchedules.length - 2} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Schedule List */}
            <div className='space-y-3'>
                <h3 className='text-lg font-medium'>All Schedules</h3>
                {schedules.length === 0 ? (
                    <div className='text-text/60 text-center py-8 bg-text/5 rounded-xl border border-text/10'>
                        <Calendar className='w-12 h-12 mx-auto mb-3 opacity-30' />
                        <p>No featured schedules yet</p>
                        <p className='text-sm'>
                            Click &ldquo;Add Featured&rdquo; to schedule a cafe
                        </p>
                    </div>
                ) : (
                    <div className='space-y-2'>
                        {schedules.map((schedule) => {
                            const status = getScheduleStatus(schedule)
                            return (
                                <div
                                    key={schedule.id}
                                    className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition ${
                                        status === "active"
                                            ? "bg-accent/5 border-accent/20"
                                            : status === "expired"
                                              ? "bg-text/5 border-text/10 opacity-60"
                                              : "bg-text/5 border-text/10"
                                    }`}
                                >
                                    {/* Cafe thumbnail */}
                                    <div className='w-16 h-16 relative rounded-lg overflow-hidden shrink-0'>
                                        {schedule.cafe?.thumbnail ? (
                                            <Image
                                                src={getCafeThumbnailUrl(
                                                    schedule.cafe.thumbnail
                                                )}
                                                alt={schedule.cafe.name}
                                                fill
                                                className='object-cover'
                                            />
                                        ) : (
                                            <div className='w-full h-full bg-text/10' />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className='flex-1 min-w-0'>
                                        <div className='font-medium truncate'>
                                            {schedule.cafe?.name}
                                        </div>
                                        <div className='text-sm text-text/60 flex items-center gap-2 mt-1'>
                                            <MapPin className='w-3 h-3' />
                                            {schedule.region_context ||
                                                "Global (all regions)"}
                                        </div>
                                        <div className='text-sm text-text/60 flex items-center gap-2 mt-0.5'>
                                            <Calendar className='w-3 h-3' />
                                            {new Date(
                                                schedule.start_date
                                            ).toLocaleDateString()}{" "}
                                            -{" "}
                                            {new Date(
                                                schedule.end_date
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>
                                    {/* Status badge and Actions - row on mobile */}
                                    <div className='flex items-center justify-between sm:justify-end gap-2 sm:gap-4'>
                                        {/* Status badge */}
                                        <div
                                            className={`px-2 py-1 text-xs rounded-full ${
                                                status === "active"
                                                    ? "bg-green-500/20 text-green-400"
                                                    : status === "upcoming"
                                                      ? "bg-blue-500/20 text-blue-400"
                                                      : "bg-text/10 text-text/40"
                                            }`}
                                        >
                                            {status}
                                        </div>

                                        {/* Actions */}
                                        <div className='flex items-center gap-1 sm:gap-2'>
                                            <button
                                                onClick={() =>
                                                    openEditModal(schedule)
                                                }
                                                className='p-2 hover:bg-text/10 rounded-lg transition'
                                                title='Edit'
                                            >
                                                <Edit2 className='w-4 h-4' />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleDelete(schedule.id)
                                                }
                                                className='p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition'
                                                title='Delete'
                                            >
                                                <Trash2 className='w-4 h-4' />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
                    <div className='bg-background border border-text/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto'>
                        <div className='sticky top-0 bg-background border-b border-text/10 p-4 flex items-center justify-between'>
                            <h3 className='text-lg font-semibold'>
                                {editingSchedule
                                    ? "Edit Featured Schedule"
                                    : "Add Featured Schedule"}
                            </h3>
                            <button
                                onClick={closeModal}
                                className='p-2 hover:bg-text/10 rounded-lg'
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        <div className='p-4 space-y-4'>
                            {/* Cafe Search */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Cafe <span className='text-red-400'>*</span>
                                </label>
                                {selectedCafe ? (
                                    <div className='flex items-center gap-3 p-3 bg-text/5 border border-text/10 rounded-lg'>
                                        <div className='w-10 h-10 relative rounded overflow-hidden shrink-0'>
                                            {selectedCafe.thumbnail ? (
                                                <Image
                                                    src={getCafeThumbnailUrl(
                                                        selectedCafe.thumbnail
                                                    )}
                                                    alt={selectedCafe.name}
                                                    fill
                                                    className='object-cover'
                                                />
                                            ) : (
                                                <div className='w-full h-full bg-text/10' />
                                            )}
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <div className='font-medium truncate'>
                                                {selectedCafe.name}
                                            </div>
                                            <div className='text-xs text-text/60'>
                                                {selectedCafe.region}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedCafe(null)
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    cafe_id: "",
                                                }))
                                            }}
                                            className='p-1 hover:bg-text/10 rounded'
                                        >
                                            <X className='w-4 h-4' />
                                        </button>
                                    </div>
                                ) : (
                                    <div className='relative'>
                                        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                                        <input
                                            type='text'
                                            value={cafeSearchQuery}
                                            onChange={(e) =>
                                                setCafeSearchQuery(
                                                    e.target.value
                                                )
                                            }
                                            placeholder='Search for a cafe...'
                                            className='w-full pl-10 pr-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:border-accent'
                                        />
                                        {searchLoading && (
                                            <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin' />
                                        )}
                                        {displayedResults.length > 0 && (
                                            <div className='absolute top-full left-0 right-0 mt-1 bg-background border border-text/10 rounded-lg shadow-lg overflow-hidden z-10'>
                                                {displayedResults.map(
                                                    (cafe) => (
                                                        <button
                                                            key={cafe.id}
                                                            onClick={() =>
                                                                handleCafeSelect(
                                                                    cafe
                                                                )
                                                            }
                                                            className='w-full flex items-center gap-3 p-3 hover:bg-text/5 transition text-left'
                                                        >
                                                            <div className='w-8 h-8 relative rounded overflow-hidden shrink-0'>
                                                                {cafe.thumbnail ? (
                                                                    <Image
                                                                        src={getCafeThumbnailUrl(
                                                                            cafe.thumbnail
                                                                        )}
                                                                        alt={
                                                                            cafe.name
                                                                        }
                                                                        fill
                                                                        className='object-cover'
                                                                    />
                                                                ) : (
                                                                    <div className='w-full h-full bg-text/10' />
                                                                )}
                                                            </div>
                                                            <div className='flex-1 min-w-0'>
                                                                <div className='font-medium truncate'>
                                                                    {cafe.name}
                                                                </div>
                                                                <div className='text-xs text-text/60 truncate'>
                                                                    {
                                                                        cafe.city_municipality
                                                                    }
                                                                    ,{" "}
                                                                    {
                                                                        cafe.region
                                                                    }
                                                                </div>
                                                            </div>
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Targeting Type Selector */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Target Audience
                                </label>
                                <div className='flex gap-2 mb-3'>
                                    <button
                                        type='button'
                                        onClick={() => {
                                            if (selectedCafe) {
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    region_context:
                                                        selectedCafe.city_municipality ||
                                                        null,
                                                }))
                                            }
                                        }}
                                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition ${
                                            selectedCafe &&
                                            formData.region_context ===
                                                selectedCafe.city_municipality
                                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                                : "bg-text/5 border-text/10 hover:bg-text/10"
                                        }`}
                                        disabled={!selectedCafe}
                                    >
                                        City
                                        {selectedCafe && (
                                            <span className='block text-xs opacity-70 mt-0.5'>
                                                {selectedCafe.city_municipality}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => {
                                            if (selectedCafe) {
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    region_context:
                                                        selectedCafe.region ||
                                                        null,
                                                }))
                                            }
                                        }}
                                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition ${
                                            selectedCafe &&
                                            formData.region_context ===
                                                selectedCafe.region
                                                ? "bg-green-500/20 text-green-400 border-green-500/30"
                                                : "bg-text/5 border-text/10 hover:bg-text/10"
                                        }`}
                                        disabled={!selectedCafe}
                                    >
                                        Region
                                        {selectedCafe && (
                                            <span className='block text-xs opacity-70 mt-0.5 truncate'>
                                                {selectedCafe.region?.split(
                                                    " - "
                                                )[0] || selectedCafe.region}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                region_context: null,
                                            }))
                                        }
                                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition ${
                                            formData.region_context === null
                                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                                : "bg-text/5 border-text/10 hover:bg-text/10"
                                        }`}
                                    >
                                        Global
                                        <span className='block text-xs opacity-70 mt-0.5'>
                                            All locations
                                        </span>
                                    </button>
                                </div>
                                <p className='text-xs text-text/50'>
                                    {formData.region_context === null
                                        ? "Shows when no city or region schedule matches"
                                        : `Featured in: ${formData.region_context}`}
                                </p>
                            </div>

                            {/* Date Range */}
                            <div className='grid grid-cols-2 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Start Date{" "}
                                        <span className='text-red-400'>*</span>
                                    </label>
                                    <input
                                        type='date'
                                        value={formData.start_date}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                start_date: e.target.value,
                                            }))
                                        }
                                        className='w-full px-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:border-accent'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        End Date{" "}
                                        <span className='text-red-400'>*</span>
                                    </label>
                                    <input
                                        type='date'
                                        value={formData.end_date}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                end_date: e.target.value,
                                            }))
                                        }
                                        className='w-full px-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:border-accent'
                                    />
                                </div>
                            </div>

                            {/* Conflict Warning */}
                            {conflictWarning && (
                                <div className='flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm'>
                                    <AlertTriangle className='w-4 h-4 shrink-0' />
                                    {conflictWarning}
                                </div>
                            )}

                            {/* Priority */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Priority (higher = more important)
                                </label>
                                <input
                                    type='number'
                                    min={1}
                                    max={10}
                                    value={formData.priority}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            priority:
                                                parseInt(e.target.value) || 1,
                                        }))
                                    }
                                    className='w-full px-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:border-accent'
                                />
                            </div>

                            {/* Custom Title (optional) */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Custom Title (optional override)
                                </label>
                                <input
                                    type='text'
                                    value={formData.custom_title}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            custom_title: e.target.value,
                                        }))
                                    }
                                    placeholder='Leave empty to use cafe name'
                                    className='w-full px-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:border-accent'
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className='p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm'>
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className='flex gap-3 pt-4'>
                                <button
                                    onClick={closeModal}
                                    className='flex-1 px-4 py-2 bg-text/10 rounded-lg hover:bg-text/20 transition'
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !!conflictWarning}
                                    className='flex-1 px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition disabled:opacity-50 flex items-center justify-center gap-2'
                                >
                                    {loading && (
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                    )}
                                    {editingSchedule ? "Update" : "Create"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
