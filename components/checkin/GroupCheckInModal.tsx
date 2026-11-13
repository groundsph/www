"use client"

import { useState, useCallback, useEffect } from "react"
import { motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import {
    X,
    MapPin,
    Users,
    ChevronDown,
    ChevronUp,
    Loader2,
    Coffee,
    Sparkles,
    Trophy,
    Wifi,
    Plug,
    Snowflake,
    PawPrint,
    Sun,
    Star,
    Bike,
} from "lucide-react"
import CompanionSelector from "./CompanionSelector"
import type { CheckInResult } from "@/app/api/actions/profile"
import type { NearbyCafeDetail } from "@/app/api/actions/nearby"
import { useBadgeNotification } from "@/components/badges/BadgeNotificationContext"
import { useHaptics } from "@/hooks/useHaptics"
import {
    getCafeThumbnailUrl,
    getPriceLevel,
    isOpenNow,
} from "@/utils/extras"
import { formatWalkTime } from "@/utils/geo"

export interface UserResult {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
}

interface GroupCheckInModalProps {
    isOpen: boolean
    onClose: () => void
    cafeName: string
    onCheckIn: (companionIds?: string[]) => Promise<CheckInResult | undefined>
    /** Called when check-in completes successfully and user dismisses the modal */
    onComplete?: (result: CheckInResult) => void
    /** Called when updating an existing check-in */
    onUpdateCheckIn?: (
        companionIds: string[],
    ) => Promise<CheckInResult | undefined>
    visitedToday?: boolean
    visitCount?: number
    initialCompanions?: UserResult[]
    /**
     * Optional cafe detail. When present the modal leads with a rich card
     * (photo, status, amenities) instead of the name-only header.
     */
    cafe?: NearbyCafeDetail | null
    /** Shown as a quiet "Not here" escape hatch when provided. */
    onDismiss?: () => void
    /** Overrides the primary button label, e.g. "Yes, I'm here" for an auto-open. */
    confirmLabel?: string
}

interface Amenity {
    label: string
    icon: React.ComponentType<{ className?: string }>
}

/** Only amenity flags that are explicitly true, capped so the row stays one line. */
function buildAmenities(cafe: NearbyCafeDetail): Amenity[] {
    const amenities: Amenity[] = []
    if (cafe.hasWifi) amenities.push({ label: "Wi-Fi", icon: Wifi })
    if (cafe.hasSockets) amenities.push({ label: "Power", icon: Plug })
    if (cafe.hasAircon) amenities.push({ label: "Aircon", icon: Snowflake })
    if (cafe.isWorkFriendly) amenities.push({ label: "Work-friendly", icon: Coffee })
    if (cafe.hasOutdoorSeating) amenities.push({ label: "Outdoor", icon: Sun })
    if (cafe.isPetFriendly) amenities.push({ label: "Pet-friendly", icon: PawPrint })
    return amenities.slice(0, 4)
}

export default function GroupCheckInModal({
    isOpen,
    onClose,
    cafeName,
    onCheckIn,
    onComplete,
    onUpdateCheckIn,
    visitedToday = false,
    visitCount = 0,
    initialCompanions = [],
    cafe = null,
    onDismiss,
    confirmLabel,
}: GroupCheckInModalProps) {
    const [selectedCompanions, setSelectedCompanions] =
        useState<UserResult[]>(initialCompanions)
    const [showCompanions, setShowCompanions] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState<CheckInResult | null>(null)
    const { showBadgeNotifications } = useBadgeNotification()
    const { trigger } = useHaptics()

    // Sync selected companions with initial companions when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedCompanions(initialCompanions)
            setResult(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    const handleSelect = useCallback((user: UserResult) => {
        trigger("selection")
        setSelectedCompanions((prev) => [...prev, user])
    }, [trigger])

    const handleRemove = useCallback((userId: string) => {
        trigger("selection")
        setSelectedCompanions((prev) => prev.filter((c) => c.id !== userId))
    }, [trigger])

    const handleCheckIn = async () => {
        trigger("medium")
        setIsSubmitting(true)
        try {
            const companionIds = selectedCompanions.map((c) => c.id)
            let checkInResult: CheckInResult | undefined

            // Use appropriate handler based on whether editing or creating
            if (visitedToday && onUpdateCheckIn) {
                checkInResult = await onUpdateCheckIn(companionIds)
            } else {
                checkInResult = await onCheckIn(
                    companionIds.length > 0 ? companionIds : undefined,
                )
            }

            if (checkInResult) {
                setResult(checkInResult)
                if (checkInResult.success) {
                    trigger("success")
                } else {
                    trigger("error")
                }
                if (
                    checkInResult.awardedBadges &&
                    checkInResult.awardedBadges.length > 0
                ) {
                    showBadgeNotifications(checkInResult.awardedBadges)
                }
                if (!visitedToday && !onUpdateCheckIn) {
                    const confetti = (await import("canvas-confetti")).default
                    const duration = 3 * 1000
                    const animationEnd = Date.now() + duration
                    const defaults = {
                        startVelocity: 45,
                        spread: 360,
                        ticks: 60,
                        zIndex: 100,
                        origin: { y: 1 },
                    }
                    const interval: ReturnType<typeof setInterval> =
                        setInterval(function () {
                            const timeLeft = animationEnd - Date.now()
                            if (timeLeft <= 0) {
                                return clearInterval(interval)
                            }
                            const particleCount = 50 * (timeLeft / duration)
                            confetti({
                                ...defaults,
                                particleCount,
                                angle: 60,
                                origin: { x: 0, y: 1 },
                            })
                            confetti({
                                ...defaults,
                                particleCount,
                                angle: 120,
                                origin: { x: 1, y: 1 },
                            })
                        }, 250)
                }
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setSelectedCompanions([])
        setShowCompanions(false)
        setResult(null)
        onClose()
    }

    const handleDone = () => {
        if (result?.success && onComplete) {
            onComplete(result)
        }
        handleClose()
    }

    if (!isOpen) return null

    // Derived display data for the rich header. Computed after the early return
    // so a closed modal does no work.
    const openStatus = cafe ? isOpenNow(cafe.operatingHours) : { isOpen: false }
    const amenities = cafe ? buildAmenities(cafe) : []
    const walkTime = cafe ? formatWalkTime(cafe.distance / 1000) : null
    const primaryLabel =
        confirmLabel ??
        (visitedToday && onUpdateCheckIn ? "Update Check-in" : "Check In")

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            {/* Backdrop */}
            <div
                className='absolute inset-0 bg-black/50 backdrop-blur-sm'
                onClick={handleClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                role='dialog'
                aria-modal='true'
                aria-label={`Check in at ${cafeName}`}
                className='relative bg-background rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto custom-scrollbar'
            >
                {cafe ? (
                    <RichCafeHeader
                        cafe={cafe}
                        cafeName={cafeName}
                        walkTime={walkTime}
                        openStatus={openStatus}
                        amenities={amenities}
                        onClose={handleClose}
                    />
                ) : (
                    <div className='flex items-center justify-between px-5 py-4 border-b border-text/10 rounded-t-2xl'>
                        <div className='flex items-center gap-3 flex-1'>
                            <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center'>
                                <MapPin className='w-5 h-5 text-primary' />
                            </div>
                            <div className='flex-1'>
                                <h2 className='font-bold text-lg'>Check In</h2>
                                <p className='text-sm text-text/60'>{cafeName}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            aria-label='Close'
                            className='p-2 hover:bg-text/5 rounded-full transition-colors'
                        >
                            <X className='w-5 h-5' />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className='p-5 space-y-4'>
                    {/* Already visited message shown on modal open when user already checked in today */}
                    {visitedToday && !result && !onUpdateCheckIn && (
                        <div className='bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3'>
                            <p className='text-sm text-amber-700 dark:text-amber-300'>
                                You&apos;ve already checked in here today! Check
                                back tomorrow.
                            </p>
                        </div>
                    )}

                    {/* Success result */}
                    {result?.success && (
                        <div className='text-center py-2'>
                            {/* Success icon */}
                            <div className='w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center'>
                                <Coffee className='w-8 h-8 text-primary' />
                            </div>

                            {/* Main message */}
                            <h3 className='text-xl font-bold text-text mb-1'>
                                You&apos;re here!
                            </h3>
                            <p className='text-text/60'>
                                Visit #{result.visitCount} to {cafeName}
                            </p>

                            {/* Additional info badges */}
                            <div className='flex flex-wrap justify-center gap-2 mt-4'>
                                {result.isFirstVisit && (
                                    <span className='inline-flex items-center gap-1 px-3 py-1.5 bg-primary/20 text-primary text-sm font-medium rounded-full'>
                                        <Sparkles className='w-3.5 h-3.5' />{" "}
                                        First visit
                                    </span>
                                )}
                                {result.companions &&
                                    result.companions.length > 0 && (
                                        <span className='inline-flex items-center gap-1 px-3 py-1.5 bg-secondary/40 text-text text-sm font-medium rounded-full'>
                                            <Users className='w-3.5 h-3.5' />{" "}
                                            {result.companions.length} companion
                                            {result.companions.length > 1
                                                ? "s"
                                                : ""}
                                        </span>
                                    )}
                                {result.milestone && (
                                    <span className='inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full'>
                                        <Trophy className='w-3.5 h-3.5' />{" "}
                                        {result.milestone} visits!
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Already visited message shown after failed check-in attempt */}
                    {result?.alreadyVisitedToday && (
                        <div className='bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3'>
                            <p className='text-sm text-amber-700 dark:text-amber-300'>
                                You&apos;ve already checked in here today! Check back tomorrow.
                            </p>
                        </div>
                    )}

                    {/* Check-in form */}
                    {(!visitedToday || onUpdateCheckIn) && !result && (
                        <>
                            {/* Visit count preview */}
                            {visitCount > 0 && !visitedToday && (
                                <p className='text-sm text-text/60 text-center'>
                                    This will be your visit #{visitCount + 1}
                                </p>
                            )}

                            {/* Edit mode notice */}
                            {visitedToday && onUpdateCheckIn && (
                                <p className='text-sm text-text/60 text-center'>
                                    Update your companions for today&apos;s
                                    visit
                                </p>
                            )}

                            {/* Companions section (collapsible) */}
                            <div className='border border-text/10 rounded-lg'>
                                <button
                                    type='button'
                                    onClick={() =>
                                        setShowCompanions(!showCompanions)
                                    }
                                    className='w-full flex items-center justify-between px-4 py-3 hover:bg-text/5 transition-colors'
                                >
                                    <div className='flex items-center gap-2'>
                                        <Users className='w-4 h-4 text-text opacity-60' />
                                        <span className='text-sm font-medium'>
                                            Add Companions
                                            {selectedCompanions.length > 0 && (
                                                <span className='ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full'>
                                                    {selectedCompanions.length}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {showCompanions ? (
                                        <ChevronUp className='w-4 h-4 text-text opacity-40' />
                                    ) : (
                                        <ChevronDown className='w-4 h-4 text-text opacity-40' />
                                    )}
                                </button>

                                {showCompanions && (
                                    <div className='px-4 pb-4 border-t border-text/10 pt-3'>
                                        <CompanionSelector
                                            selectedCompanions={
                                                selectedCompanions
                                            }
                                            onSelect={handleSelect}
                                            onRemove={handleRemove}
                                            maxCompanions={5}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className='px-5 py-4 border-t border-text/10 bg-text/5 rounded-b-2xl'>
                    {!result ? (
                        <>
                            <button
                                onClick={handleCheckIn}
                                disabled={
                                    (visitedToday && !onUpdateCheckIn) ||
                                    isSubmitting
                                }
                                className='w-full py-3 px-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                        Checking in...
                                    </>
                                ) : (
                                    <>
                                        <MapPin className='w-4 h-4 hidden md:block' />
                                        {primaryLabel}
                                        {selectedCompanions.length > 0 &&
                                            ` with ${selectedCompanions.length} companion${selectedCompanions.length > 1 ? "s" : ""}`}
                                    </>
                                )}
                            </button>

                            {/* Escape hatch. Declining must be as easy to find
                                as accepting, or the prompt feels pushy. */}
                            {(onDismiss || cafe) && (
                                <div className='flex items-center justify-center gap-3 mt-3 text-sm'>
                                    {cafe && (
                                        <Link
                                            href={`/cafes/${cafe.slug}`}
                                            className='text-text/60 hover:text-text underline-offset-2 hover:underline transition-colors'
                                        >
                                            View cafe
                                        </Link>
                                    )}
                                    {cafe && onDismiss && (
                                        <span className='text-text/20'>·</span>
                                    )}
                                    {onDismiss && (
                                        <button
                                            onClick={() => {
                                                onDismiss()
                                                handleClose()
                                            }}
                                            className='text-text/60 hover:text-text underline-offset-2 hover:underline transition-colors'
                                        >
                                            Not here
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <button
                            onClick={handleDone}
                            className='w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors'
                        >
                            Done
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

interface RichCafeHeaderProps {
    cafe: NearbyCafeDetail
    cafeName: string
    walkTime: string | null
    openStatus: { isOpen: boolean; closesAt?: string; opensAt?: string }
    amenities: Amenity[]
    onClose: () => void
}

/**
 * Photo-led header for a cafe we can actually describe: where it is, whether it
 * is open, how it rates, and what it offers. Emphasis order is deliberate —
 * photo, then name, then the one status line that answers "should I go now?".
 */
function RichCafeHeader({
    cafe,
    cafeName,
    walkTime,
    openStatus,
    amenities,
    onClose,
}: RichCafeHeaderProps) {
    const rating = cafe.averageRating
    const priceLevel = cafe.priceLevel ? getPriceLevel(cafe.priceLevel) : null

    return (
        <div className='relative'>
            <div className='relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-secondary/20'>
                <Image
                    src={getCafeThumbnailUrl(cafe.thumbnail)}
                    alt={cafeName}
                    fill
                    className='object-cover'
                    sizes='(max-width: 768px) 100vw, 28rem'
                    priority={false}
                />
                <div className='absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/20' />

                <button
                    onClick={onClose}
                    aria-label='Close'
                    className='absolute top-3 right-3 p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors'
                >
                    <X className='w-4 h-4' />
                </button>

                <div className='absolute inset-x-0 bottom-0 p-4'>
                    {cafe.city && (
                        <p className='text-[11px] font-medium uppercase tracking-[0.14em] text-white/70'>
                            {cafe.city}
                        </p>
                    )}
                    <h2 className='text-2xl font-bold font-serif leading-tight text-white'>
                        {cafeName}
                    </h2>
                </div>
            </div>

            <div className='px-5 py-4 space-y-3 border-b border-text/10'>
                {/* Status strip — the "should I go now?" answers, in one line */}
                <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm'>
                    <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${
                            openStatus.isOpen ? "text-green-700" : "text-text/50"
                        }`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${
                                openStatus.isOpen ? "bg-green-600" : "bg-text/30"
                            }`}
                        />
                        {openStatus.isOpen
                            ? openStatus.closesAt
                                ? `Open until ${openStatus.closesAt}`
                                : "Open now"
                            : openStatus.opensAt
                              ? `Opens ${openStatus.opensAt}`
                              : "Closed"}
                    </span>

                    {rating != null && (
                        <span className='inline-flex items-center gap-1 font-medium'>
                            <Star className='w-3.5 h-3.5 fill-amber-400 text-amber-400' />
                            {rating.toFixed(1)}
                            {cafe.totalReviews ? (
                                <span className='text-text/40 font-normal'>
                                    ({cafe.totalReviews})
                                </span>
                            ) : null}
                        </span>
                    )}

                    {priceLevel && (
                        <span className='font-medium text-secondary'>
                            {priceLevel}
                        </span>
                    )}

                    {walkTime && (
                        <span className='inline-flex items-center gap-1 text-text/60'>
                            <Bike className='w-3.5 h-3.5' />
                            {walkTime}
                        </span>
                    )}
                </div>

                {amenities.length > 0 && (
                    <div className='flex flex-wrap gap-1.5'>
                        {amenities.map(({ label, icon: Icon }) => (
                            <span
                                key={label}
                                className='inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/15 text-[11px] font-medium text-text/70'
                            >
                                <Icon className='w-3 h-3' />
                                {label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
