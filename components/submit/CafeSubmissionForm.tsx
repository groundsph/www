"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    ChevronLeft,
    ChevronRight,
    Check,
    Loader2,
    MapPin,
    Coffee,
    Clock,
    Phone,
    Settings,
    Send,
    Wifi,
    Plug,
    Car,
    Wind,
    Dog,
    Sun,
    Utensils,
    ExternalLink,
    BadgeCheck,
    Upload,
    FileText,
    Trash2,
    Search,
    AlertCircle,
    ImageIcon,
    Armchair,
    Droplet,
    MilkOff,
    Gem,
    Cigarette,
    Store,
} from "lucide-react"

import { cn } from "@/utils/cn"
import { CafeSubmission, DEFAULT_CAFE_SUBMISSION } from "@/utils/types/extra"
import { OperatingHour } from "@/utils/types/cafe"

import {
    PHILIPPINES_LOCATIONS,
    getProvincesForRegion,
    getCitiesForProvince,
    COFFEE_STYLES,
} from "@/utils/data/philippines"
import {
    uploadCafeImageWithProgress,
    uploadOwnershipProofWithProgress,
} from "@/utils/storage/client"
import { submitCafe } from "@/app/api/actions/submit"
import { submitCafeClaim } from "@/app/api/actions/claim"
import { searchCafesSimple } from "@/app/api/actions/cafe"
import ImageUpload from "@/components/reviews/ImageUpload"
import SocialLinksEditor from "./SocialLinksEditor"
import LocationPicker from "./LocationPicker"
import {
    compressCoverImage,
    compressGalleryImage,
} from "@/utils/image-processing"
import ImageCropper from "@/components/ui/ImageCropper"
import AmenitiesSection from "@/components/cafe-editor/AmenitiesSection"
import HoursSection from "@/components/cafe-editor/HoursSection"
import { extractCoordsFromGoogleMapsUrl } from "@/app/api/actions/location"
import { Link } from "lucide-react"
import { CafeWithRatings } from "@/utils/types/extra"
import { useNotification } from "@/components/NotificationProvider"

const STEPS = [
    { id: 0, title: "Before We Begin", icon: Search },
    { id: 1, title: "Basic Info", icon: Coffee },
    { id: 2, title: "Location", icon: MapPin },
    { id: 3, title: "Amenities", icon: Settings },
    { id: 4, title: "Hours", icon: Clock },
    { id: 5, title: "Contact", icon: Phone },
    { id: 6, title: "Submit", icon: Send },
]

const DRAFT_KEY = "grounds_cafe_submission_draft"

interface CafeSubmissionFormProps {
    onSuccess?: (cafeId: string, slug: string) => void
}

export default function CafeSubmissionForm({
    onSuccess,
}: CafeSubmissionFormProps) {
    const { addNotification } = useNotification()
    const [currentStep, setCurrentStep] = useState(0)
    const [formData, setFormData] = useState<CafeSubmission>(
        DEFAULT_CAFE_SUBMISSION,
    )

    // "Before We Begin" step state
    const [preSearchQuery, setPreSearchQuery] = useState("")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cafe search results have dynamic shape
    const [preSearchResults, setPreSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
        null,
    )
    const [galleryFiles, setGalleryFiles] = useState<File[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false) // For resizing/compression
    const [uploadProgress, setUploadProgress] = useState<
        Record<string, number>
    >({})
    const [processingStatus, setProcessingStatus] = useState<string>("")
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Custom comma-separated inputs
    // NOTE: Custom inputs are now handled within AmenitiesSection

    // Duplicate checking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cafe search results have dynamic shape
    const [possibleDuplicates, setPossibleDuplicates] = useState<any[]>([])

    // Ownership proof files for owner verification
    const [ownershipProofFiles, setOwnershipProofFiles] = useState<File[]>([])

    // Google Maps URL Parsing State
    const [googleMapsUrl, setGoogleMapsUrl] = useState("")
    const [isParsingUrl, setIsParsingUrl] = useState(false)

    // Computed state for Step 0 verification
    const isNameVerified =
        preSearchQuery.trim().length >= 3 &&
        !isSearching &&
        preSearchResults.length === 0

    // Debounced search for Step 0
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (preSearchQuery.trim().length >= 3) {
                try {
                    // isSearching is already set to true by input change
                    const results = await searchCafesSimple(
                        preSearchQuery.trim(),
                    )
                    setPreSearchResults(results)
                } catch (err) {
                    console.error("[PreSearch] Error:", err)
                    setPreSearchResults([])
                } finally {
                    setIsSearching(false)
                }
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [preSearchQuery])

    useEffect(() => {
        const checkDuplicates = async () => {
            const trimmedName = formData.name.trim()
            console.log(
                "[CafeSubmission] Checking duplicates for:",
                trimmedName,
            )
            if (trimmedName.length >= 3) {
                try {
                    const results = await searchCafesSimple(trimmedName)
                    console.log("[CafeSubmission] Results:", results)
                    setPossibleDuplicates(results)
                } catch (err) {
                    console.error(
                        "[CafeSubmission] Error checking duplicates:",
                        err,
                    )
                }
            } else {
                setPossibleDuplicates([])
            }
        }

        const timer = setTimeout(checkDuplicates, 500)
        return () => clearTimeout(timer)
    }, [formData.name])

    // Load draft from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(DRAFT_KEY)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                // Don't restore file objects, just form data
                setFormData({ ...DEFAULT_CAFE_SUBMISSION, ...parsed })
            } catch (e) {
                console.error("Failed to load draft:", e)
            }
        }
    }, [])

    // Save draft to localStorage when form data changes
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to exclude file fields
        const { thumbnail, gallery, ...savable } = formData
        localStorage.setItem(DRAFT_KEY, JSON.stringify(savable))
    }, [formData])

    const clearDraft = () => {
        localStorage.removeItem(DRAFT_KEY)
    }

    const updateFormData = useCallback(
        <K extends keyof CafeSubmission>(key: K, value: CafeSubmission[K]) => {
            setFormData((prev) => ({ ...prev, [key]: value }))
        },
        [],
    )

    const handleLocationMatch = useCallback(
        (match: {
            region: string | null
            province: string | null
            city: string | null
            area: string | null
            fullAddress: string
        }) => {
            if (match.region) {
                updateFormData("region", match.region)
            }

            if (match.province) {
                updateFormData("province", match.province)
            }

            if (match.city) {
                updateFormData("city_municipality", match.city)
            }

            if (match.area) {
                updateFormData("area", match.area)
            }

            if (match.fullAddress && !formData.address_display.trim()) {
                updateFormData("address_display", match.fullAddress)
            }
        },
        [formData, updateFormData],
    )

    const resetForm = () => {
        setFormData(DEFAULT_CAFE_SUBMISSION)
        setThumbnailFile(null)
        setGalleryFiles([])
        setOwnershipProofFiles([])
        setUploadProgress({})
        setProcessingStatus("")
        setIsProcessing(false)
        setSuccess(false)
        setCurrentStep(0)
        setError(null)
        setPreSearchQuery("")
        setPreSearchResults([])
        setPossibleDuplicates([])
        setPreSearchResults([])
        setPossibleDuplicates([])
        clearDraft()
    }

    const validateStep = (step: number): string | null => {
        switch (step) {
            case 0:
                if (!isNameVerified)
                    return "Please verify the cafe name availability first"
                break
            case 1:
                if (!formData.name.trim()) return "Cafe name is required"
                // Thumbnail is now optional
                break
            case 2:
                if (!formData.region) return "Please select a region"
                if (!formData.province) return "Please select a province"
                if (!formData.city_municipality) return "Please select a city"
                // Only require full address if NOT a Hidden Gem
                if (!formData.is_hidden_gem && !formData.address_display.trim())
                    return "Address is required"
                // Only require coordinates if NOT a Hidden Gem
                if (
                    !formData.is_hidden_gem &&
                    (formData.lat === null || formData.lng === null)
                )
                    return "Please set the location coordinates"
                break
        }
        return null
    }

    const nextStep = () => {
        const validationError = validateStep(currentStep)
        if (validationError) {
            setError(validationError)
            return
        }
        setError(null)

        // Auto-fill cafe name from search query when moving from step 0 to 1
        if (
            currentStep === 0 &&
            preSearchQuery.trim() &&
            !formData.name.trim()
        ) {
            updateFormData("name", preSearchQuery.trim())
        }

        // Auto-fill default operating hours if empty when moving from step 4 (Hours)
        if (currentStep === 4 && formData.operating_hours.length === 0) {
            const defaultHours: OperatingHour[] = [
                {
                    day: "mon",
                    open: "08:00",
                    close: "20:00",
                    is_closed: false,
                    is_24_hours: false,
                },
                {
                    day: "tue",
                    open: "08:00",
                    close: "20:00",
                    is_closed: false,
                    is_24_hours: false,
                },
                {
                    day: "wed",
                    open: "08:00",
                    close: "20:00",
                    is_closed: false,
                    is_24_hours: false,
                },
                {
                    day: "thu",
                    open: "08:00",
                    close: "20:00",
                    is_closed: false,
                    is_24_hours: false,
                },
                {
                    day: "fri",
                    open: "08:00",
                    close: "20:00",
                    is_closed: false,
                    is_24_hours: false,
                },
                {
                    day: "sat",
                    open: "08:00",
                    close: "20:00",
                    is_closed: false,
                    is_24_hours: false,
                },
                {
                    day: "sun",
                    open: "08:00",
                    close: "20:00",
                    is_closed: false,
                    is_24_hours: false,
                },
            ]
            updateFormData("operating_hours", defaultHours)
        }

        setCurrentStep((prev) => Math.min(prev + 1, STEPS[STEPS.length - 1].id))
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const prevStep = () => {
        setError(null)
        setCurrentStep((prev) => Math.max(prev - 1, 0))
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    // State for image cropping
    const [croppingImage, setCroppingImage] = useState<File | null>(null)
    const [cropperOpen, setCropperOpen] = useState(false)

    const checkAspectRatio = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            const img = new Image()
            img.onload = () => {
                const aspect = img.width / img.height
                // Allow some tolerance for 16:9 (1.77)
                const is16by9 = Math.abs(aspect - 16 / 9) < 0.05
                resolve(is16by9)
            }
            img.src = URL.createObjectURL(file)
        })
    }

    const handleThumbnailChange = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0]
        if (!file) return

        const is16by9 = await checkAspectRatio(file)

        // If strict 16:9 check fails, open cropper
        // Or if you want to force cropper for all uploads to ensure perfect framing, just open it.
        // User requested: "allow the user to select where it gets cropped... when ... non-16:9"
        if (is16by9) {
            // Process normally
            setThumbnailFile(file)
            setThumbnailPreview(URL.createObjectURL(file))
        } else {
            setCroppingImage(file)
            setCropperOpen(true)
        }
    }

    const handleCropComplete = async (croppedBlob: Blob) => {
        const file = new File(
            [croppedBlob],
            croppingImage?.name || "cover.webp",
            {
                type: "image/webp",
                lastModified: Date.now(),
            },
        )

        // Compress cover image (250KB WebP)
        const finalFile = await compressCoverImage(file)

        setThumbnailFile(finalFile)
        setThumbnailPreview(URL.createObjectURL(finalFile))
        setCropperOpen(false)
        setCroppingImage(null)
    }

    const handleGoogleMapsUrl = async () => {
        if (!googleMapsUrl.trim()) return

        setIsParsingUrl(true)

        try {
            const coords = await extractCoordsFromGoogleMapsUrl(googleMapsUrl)
            if (coords) {
                // Update coordinates - this will trigger LocationPicker to update map
                // and eventually trigger reverse geocoding via onLocationMatch
                updateFormData("lat", coords.lat)
                updateFormData("lng", coords.lng)

                // Clear the input on success
                setGoogleMapsUrl("")
                addNotification(
                    "Location extracted from Google Maps!",
                    "success",
                )
            } else {
                addNotification(
                    "Could not extract coordinates from this URL",
                    "error",
                )
            }
        } catch (error) {
            console.error("Google Maps URL parsing error:", error)
            addNotification("Failed to parse URL", "error")
        } finally {
            setIsParsingUrl(false)
        }
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        setError(null)
        setUploadProgress({})
        setProcessingStatus("Preparing images...")
        setIsProcessing(true)

        try {
            console.log("[Cafe Submit] Starting submission...")

            // Validate ownership proof if claiming ownership
            if (formData.is_owner && ownershipProofFiles.length === 0) {
                throw new Error(
                    "At least one proof document is required when claiming ownership",
                )
            }

            // 1. Process Thumbnail (optional)
            let thumbnailUrl: string | null = null
            if (thumbnailFile) {
                setProcessingStatus("Compressing cover image...")
                // Compress cover image (250KB JPEG for Satori OG compatibility)
                const processedThumbnail =
                    await compressCoverImage(thumbnailFile)

                setIsProcessing(false)
                setProcessingStatus("Uploading images...")

                // 2. Upload Thumbnail
                console.log("[Cafe Submit] Uploading thumbnail...")
                setUploadProgress((prev) => ({ ...prev, thumbnail: 0 }))

                const thumbnailResult = await uploadCafeImageWithProgress(
                    processedThumbnail,
                    (progress: number) => {
                        setUploadProgress((prev) => ({
                            ...prev,
                            thumbnail: progress,
                        }))
                    },
                )

                if (!thumbnailResult.success || !thumbnailResult.url) {
                    throw new Error(
                        thumbnailResult.error || "Failed to upload thumbnail",
                    )
                }
                thumbnailUrl = thumbnailResult.url
            } else {
                setIsProcessing(false)
                setProcessingStatus("Uploading images...")
            }

            // 3. Process Gallery Images
            setProcessingStatus(
                `Compressing ${galleryFiles.length} gallery images...`,
            )
            const processedGalleryFiles: File[] = []
            for (let i = 0; i < galleryFiles.length; i++) {
                const file = galleryFiles[i]
                // Compress gallery image (120KB WebP)
                const processed = await compressGalleryImage(file)
                processedGalleryFiles.push(processed)
            }

            // 4. Upload Gallery Images
            console.log("[Cafe Submit] Uploading gallery images...")
            const galleryUrls: string[] = []

            for (let i = 0; i < processedGalleryFiles.length; i++) {
                const file = processedGalleryFiles[i]
                const key = `gallery-${i}`
                setUploadProgress((prev) => ({ ...prev, [key]: 0 }))

                const result = await uploadCafeImageWithProgress(
                    file,
                    (progress: number) => {
                        setUploadProgress((prev) => ({
                            ...prev,
                            [key]: progress,
                        }))
                    },
                )

                if (result.success && result.url) {
                    galleryUrls.push(result.url)
                }
            }

            // 5. Upload Ownership Proof Files (if owner)
            const proofUrls: string[] = []
            if (formData.is_owner && ownershipProofFiles.length > 0) {
                setProcessingStatus("Uploading ownership proof documents...")
                console.log(
                    "[Cafe Submit] Uploading ownership proofs...",
                    ownershipProofFiles.length,
                )

                for (let i = 0; i < ownershipProofFiles.length; i++) {
                    const file = ownershipProofFiles[i]
                    const key = `proof-${i}`
                    setUploadProgress((prev) => ({ ...prev, [key]: 0 }))

                    const result = await uploadOwnershipProofWithProgress(
                        file,
                        (progress: number) => {
                            setUploadProgress((prev) => ({
                                ...prev,
                                [key]: progress,
                            }))
                        },
                    )

                    if (result.success && result.url) {
                        proofUrls.push(result.url)
                    } else {
                        console.error(
                            "[Cafe Submit] Failed to upload proof:",
                            result.error,
                        )
                    }
                }

                if (proofUrls.length === 0) {
                    throw new Error(
                        "Failed to upload ownership proof documents",
                    )
                }
            }

            setProcessingStatus("Finalizing submission...")

            // 6. Submit cafe data
            console.log("[Cafe Submit] Submitting to server...")
            const {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                thumbnail,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                gallery,
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                ownership_proof_files,
                ...serializableFormData
            } = formData
            const result = await submitCafe(
                serializableFormData,
                thumbnailUrl,
                galleryUrls,
            )

            if (!result.success) {
                throw new Error(result.error || "Failed to submit cafe")
            }

            // 7. Create ownership claim if owner
            if (formData.is_owner && result.cafeId && proofUrls.length > 0) {
                console.log("[Cafe Submit] Creating ownership claim...")
                const proofText =
                    "Submitted during cafe registration with proof documents."
                // Use the first proof URL as the document URL
                const claimResult = await submitCafeClaim(
                    result.cafeId,
                    proofText,
                    proofUrls[0], // Primary proof document
                )

                if (!claimResult.success) {
                    console.error(
                        "[Cafe Submit] Failed to create claim:",
                        claimResult.error,
                    )
                    // Don't throw - cafe was already created, just log the warning
                }
            }

            // Success!
            console.log("[Cafe Submit] Success!")
            clearDraft()
            setSuccess(true)
            addNotification(
                "Cafe submitted successfully! We'll review it soon.",
                "success",
            )
            onSuccess?.(result.cafeId!, result.slug!)
        } catch (err: unknown) {
            console.error("[Cafe Submit] Error:", err)
            const errorMessage =
                err instanceof Error ? err.message : "An error occurred"
            setError(errorMessage)
            addNotification(errorMessage, "error")
        } finally {
            setIsSubmitting(false)
            setIsProcessing(false)
            setProcessingStatus("")
        }
    }

    // Get available provinces and cities based on selections
    const availableProvinces = formData.region
        ? getProvincesForRegion(formData.region)
        : []
    const availableCities =
        formData.region && formData.province
            ? getCitiesForProvince(formData.region, formData.province)
            : []

    if (success) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className='text-center py-12'
            >
                <div className='w-16 h-16 bg-green-200 rounded-full flex items-center justify-center mx-auto mb-6'>
                    <Check className='w-8 h-8 text-green-600' />
                </div>
                <h2 className='text-2xl font-bold font-serif mb-2'>
                    Submission Received!
                </h2>
                <p className='text-text/60 max-w-md mx-auto'>
                    Thank you for contributing to Grounds! Your cafe submission
                    is now under review. We&apos;ll notify you once it&apos;s
                    approved and live on the platform.
                </p>
                <button
                    onClick={resetForm}
                    className='mt-8 px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors cursor-pointer'
                >
                    Submit Another Cafe
                </button>
            </motion.div>
        )
    }

    return (
        <div className='w-full'>
            {/* Progress Steps */}
            <div className='flex items-center justify-between mb-8 overflow-x-auto pb-2'>
                {STEPS.map((step, idx) => {
                    const isActive = currentStep === step.id
                    const isComplete = currentStep > step.id

                    return (
                        <div
                            key={step.id}
                            className='flex items-center'
                        >
                            <div
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
                                    isActive && "bg-primary/10 text-primary",
                                    isComplete && "text-green-800",
                                    !isActive && !isComplete && "text-text/40",
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                                        isActive && "bg-primary text-white",
                                        isComplete &&
                                            "bg-green-200! text-green-600",
                                        !isActive &&
                                            !isComplete &&
                                            "bg-text/10",
                                    )}
                                >
                                    {isComplete ? (
                                        <Check className='w-4 h-4' />
                                    ) : (
                                        step.id
                                    )}
                                </div>
                                <span className='hidden md:block text-sm font-medium whitespace-nowrap'>
                                    {step.title}
                                </span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div
                                    className={cn(
                                        "w-8 h-0.5 mx-1",
                                        currentStep > step.id
                                            ? "bg-green-500"
                                            : "bg-text/10",
                                    )}
                                />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Error Display */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className='mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm'
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Step Content */}
            <div className='min-h-[400px]'>
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Step 0: Before We Begin */}
                        {currentStep === 0 && (
                            <div className='space-y-6'>
                                <div>
                                    <h3 className='text-xl font-semibold font-serif mb-1'>
                                        Before We Begin
                                    </h3>
                                    <p className='text-text/60 text-sm'>
                                        Please check if the cafe exists first
                                        and review the guidelines below
                                    </p>
                                </div>

                                {/* What qualifies as a cafe */}
                                <div className='p-5 bg-primary/5 border border-primary/20 rounded-xl'>
                                    <div className='flex items-start gap-3 mb-4'>
                                        <div className='p-2 bg-primary/10 rounded-full text-primary'>
                                            <Coffee className='w-5 h-5' />
                                        </div>
                                        <div>
                                            <h4 className='font-semibold text-lg'>
                                                What qualifies as a cafe?
                                            </h4>
                                            <p className='text-text/60 text-sm'>
                                                Grounds focuses on sit-down
                                                coffee experiences
                                            </p>
                                        </div>
                                    </div>
                                    <ul className='space-y-3 ml-1'>
                                        <li className='flex items-start gap-3'>
                                            <Check className='w-5 h-5 text-green-600 shrink-0 mt-0.5' />
                                            <span className='text-sm'>
                                                <strong>Seating area</strong> —
                                                Must have tables and chairs for
                                                customers to sit and enjoy their
                                                drinks
                                            </span>
                                        </li>
                                        <li className='flex items-start gap-3'>
                                            <Check className='w-5 h-5 text-green-600 shrink-0 mt-0.5' />
                                            <span className='text-sm'>
                                                <strong>
                                                    Coffee or tea service
                                                </strong>{" "}
                                                — Serves freshly prepared
                                                coffee, espresso, or tea
                                                beverages
                                            </span>
                                        </li>
                                        <li className='flex items-start gap-3'>
                                            <AlertCircle className='w-5 h-5 text-orange-500 shrink-0 mt-0.5' />
                                            <span className='text-sm'>
                                                <strong>
                                                    Not kiosks or stalls
                                                </strong>{" "}
                                                — Mall kiosks, grab-and-go
                                                stalls, or counters with
                                                shared/borrowed seating
                                                don&apos;t qualify
                                            </span>
                                        </li>
                                        <li className='flex items-start gap-3'>
                                            <AlertCircle className='w-5 h-5 text-orange-500 shrink-0 mt-0.5' />
                                            <span className='text-sm'>
                                                <strong>
                                                    Not convenience stores
                                                </strong>{" "}
                                                — Stores with a coffee machine
                                                (like 7-Eleven) are not cafes
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Search for existing cafe */}
                                <div className='p-5 bg-secondary/30 border border-secondary/50 rounded-xl'>
                                    <div className='flex items-start gap-3 mb-4'>
                                        <div className='p-2 bg-secondary/50 rounded-full text-text/80'>
                                            <Search className='w-5 h-5' />
                                        </div>
                                        <div>
                                            <h4 className='font-semibold text-lg'>
                                                Search for the cafe first
                                            </h4>
                                            <p className='text-text/60 text-sm'>
                                                You must search to confirm the
                                                cafe doesn&apos;t already exist
                                                before proceeding
                                            </p>
                                        </div>
                                    </div>

                                    <div className='relative'>
                                        <input
                                            type='text'
                                            value={preSearchQuery}
                                            onChange={(e) => {
                                                const query = e.target.value
                                                setPreSearchQuery(query)

                                                if (query.trim().length >= 3) {
                                                    // Immediately set searching to disable "Next" button while debounce waits
                                                    setIsSearching(true)
                                                } else {
                                                    setIsSearching(false)
                                                    setPreSearchResults([])
                                                }
                                            }}
                                            placeholder='Type the cafe name to search...'
                                            className='w-full px-4 py-3 pl-11 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                        />
                                        <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                                        {isSearching && (
                                            <Loader2 className='absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin' />
                                        )}
                                    </div>

                                    {/* Search Results */}
                                    <AnimatePresence>
                                        {preSearchResults.length > 0 && (
                                            <motion.div
                                                initial={{
                                                    opacity: 0,
                                                    height: 0,
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    height: "auto",
                                                }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className='overflow-hidden'
                                            >
                                                <div className='mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl'>
                                                    <p className='text-sm font-medium text-yellow-800 mb-2'>
                                                        Found{" "}
                                                        {
                                                            preSearchResults.length
                                                        }{" "}
                                                        similar cafe(s):
                                                    </p>
                                                    <div className='space-y-2'>
                                                        {preSearchResults.map(
                                                            (cafe) => (
                                                                <a
                                                                    key={
                                                                        cafe.id
                                                                    }
                                                                    href={`/cafes/${cafe.slug}`}
                                                                    target='_blank'
                                                                    rel='noopener noreferrer'
                                                                    className='flex items-center gap-3 p-2 bg-white/80 hover:bg-white rounded-lg border border-yellow-100 hover:border-yellow-300 transition-colors group'
                                                                >
                                                                    <div className='w-10 h-10 bg-gray-100 rounded-md overflow-hidden shrink-0'>
                                                                        {cafe.thumbnail_url ? (
                                                                            /* eslint-disable-next-line @next/next/no-img-element */
                                                                            <img
                                                                                src={
                                                                                    cafe.thumbnail_url
                                                                                }
                                                                                alt={
                                                                                    cafe.name
                                                                                }
                                                                                className='w-full h-full object-cover'
                                                                            />
                                                                        ) : (
                                                                            <div className='w-full h-full flex items-center justify-center text-gray-400'>
                                                                                <Coffee className='w-5 h-5' />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className='flex-1 min-w-0'>
                                                                        <p className='font-semibold text-sm truncate text-gray-900 group-hover:text-primary'>
                                                                            {
                                                                                cafe.name
                                                                            }
                                                                        </p>
                                                                        <p className='text-xs text-gray-500 truncate'>
                                                                            {cafe.address_display ||
                                                                                "No address provided"}
                                                                        </p>
                                                                    </div>
                                                                    <ExternalLink className='w-4 h-4 text-gray-400 group-hover:text-primary shrink-0' />
                                                                </a>
                                                            ),
                                                        )}
                                                    </div>
                                                    <p className='text-xs text-yellow-700 mt-3'>
                                                        If your cafe is listed
                                                        above, no need to submit
                                                        it again!
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {preSearchQuery.trim().length >= 3 &&
                                        preSearchResults.length === 0 &&
                                        !isSearching && (
                                            <p className='mt-3 text-sm text-green-700 flex items-center gap-2'>
                                                <Check className='w-4 h-4' />
                                                No existing cafes found with
                                                that name. You&apos;re good to
                                                go!
                                            </p>
                                        )}
                                </div>
                            </div>
                        )}

                        {/* Step 1: Basic Info */}
                        {currentStep === 1 && (
                            <div className='space-y-6'>
                                <div>
                                    <h3 className='text-xl font-semibold font-serif mb-1'>
                                        Basic Information
                                    </h3>
                                    <p className='text-text/60 text-sm'>
                                        Tell us about the cafe
                                    </p>
                                </div>

                                <div className='space-y-4'>
                                    <div>
                                        <label className='block text-sm font-medium mb-2'>
                                            Cafe Name{" "}
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                            <span className='block text-xs font-normal text-text/50 mt-1'>
                                                For chain branches, add the
                                                location:{" "}
                                                <span className='font-medium'>
                                                    Brand - Branch
                                                </span>{" "}
                                                (e.g. &quot;Bo&apos;s Coffee -
                                                IT Park&quot;). Independent
                                                cafes don&apos;t need this.
                                            </span>
                                        </label>
                                        <input
                                            type='text'
                                            value={formData.name}
                                            onChange={(e) =>
                                                updateFormData(
                                                    "name",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder='e.g. The Coffee House'
                                            className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                        />

                                        {/* Duplicate Warning */}
                                        <AnimatePresence>
                                            {possibleDuplicates.length > 0 && (
                                                <motion.div
                                                    initial={{
                                                        opacity: 0,
                                                        height: 0,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        height: "auto",
                                                    }}
                                                    exit={{
                                                        opacity: 0,
                                                        height: 0,
                                                    }}
                                                    className='overflow-hidden'
                                                >
                                                    <div className='mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl'>
                                                        <div className='flex items-start gap-2 mb-3'>
                                                            <div className='p-1.5 bg-yellow-100 rounded-full text-yellow-600'>
                                                                <Coffee className='w-4 h-4' />
                                                            </div>
                                                            <div>
                                                                <p className='text-sm font-semibold text-yellow-800'>
                                                                    One or more
                                                                    cafes with
                                                                    similar
                                                                    names
                                                                    already
                                                                    exist
                                                                </p>
                                                                <p className='text-xs text-yellow-700 mt-1'>
                                                                    Please check
                                                                    if the cafe
                                                                    you&apos;re
                                                                    adding is
                                                                    already
                                                                    listed to
                                                                    avoid
                                                                    duplicates.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className='space-y-2'>
                                                            {possibleDuplicates.map(
                                                                (cafe) => (
                                                                    <a
                                                                        key={
                                                                            cafe.id
                                                                        }
                                                                        href={`/cafes/${cafe.slug}`}
                                                                        target='_blank'
                                                                        rel='noopener noreferrer'
                                                                        className='flex items-center gap-3 p-2 bg-white/60 hover:bg-white rounded-lg border border-yellow-100 hover:border-yellow-300 transition-colors group'
                                                                    >
                                                                        <div className='w-10 h-10 bg-gray-100 rounded-md overflow-hidden shrink-0'>
                                                                            {cafe.thumbnail_url ? (
                                                                                /* eslint-disable-next-line @next/next/no-img-element -- External URL from search results */
                                                                                <img
                                                                                    src={
                                                                                        cafe.thumbnail_url
                                                                                    }
                                                                                    alt={
                                                                                        cafe.name
                                                                                    }
                                                                                    className='w-full h-full object-cover'
                                                                                />
                                                                            ) : (
                                                                                <div className='w-full h-full flex items-center justify-center text-gray-400'>
                                                                                    <Coffee className='w-5 h-5' />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className='flex-1 min-w-0'>
                                                                            <div className='flex items-center gap-2'>
                                                                                <p className='font-semibold text-sm truncate text-gray-900 group-hover:text-primary'>
                                                                                    {
                                                                                        cafe.name
                                                                                    }
                                                                                </p>
                                                                                {!cafe.is_published && (
                                                                                    <span className='text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium'>
                                                                                        Draft
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className='text-xs text-gray-500 truncate'>
                                                                                {cafe.address_display ||
                                                                                    "No address provided"}
                                                                            </p>
                                                                        </div>
                                                                        <ExternalLink className='w-4 h-4 text-gray-400 group-hover:text-primary' />
                                                                    </a>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div>
                                        <label className='block text-sm font-medium mb-2'>
                                            Description
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => {
                                                if (
                                                    e.target.value.length <= 300
                                                ) {
                                                    updateFormData(
                                                        "description",
                                                        e.target.value,
                                                    )
                                                }
                                            }}
                                            maxLength={300}
                                            placeholder='Describe what makes this cafe special...'
                                            rows={4}
                                            className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none'
                                        />
                                        <p
                                            className={`text-xs mt-1 ${formData.description.length >= 270 ? "text-orange-500" : "text-text/40"}`}
                                        >
                                            {300 - formData.description.length}{" "}
                                            characters remaining
                                        </p>
                                    </div>

                                    <div>
                                        <label className='block text-sm font-medium mb-1'>
                                            Cover Photo{" "}
                                            <span className='text-text/50 font-normal'>
                                                (Optional but recommended)
                                            </span>
                                        </label>
                                        <p className='text-xs text-text/50 mb-2'>
                                            A good cover photo helps your
                                            submission get approved faster.
                                            Cafes without photos won&apos;t
                                            appear in featured sections.
                                        </p>
                                        {thumbnailFile ? (
                                            <div className='relative w-full aspect-video rounded-xl overflow-hidden border-2 border-text/20 bg-text/5'>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={thumbnailPreview || ""}
                                                    alt='Thumbnail preview'
                                                    className='w-full h-full object-cover'
                                                />
                                                <button
                                                    type='button'
                                                    onClick={() =>
                                                        setThumbnailFile(null)
                                                    }
                                                    className='absolute top-3 right-3 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5'
                                                >
                                                    <svg
                                                        xmlns='http://www.w3.org/2000/svg'
                                                        width='16'
                                                        height='16'
                                                        viewBox='0 0 24 24'
                                                        fill='none'
                                                        stroke='currentColor'
                                                        strokeWidth='2'
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                    >
                                                        <path d='M3 6h18' />
                                                        <path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' />
                                                        <path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' />
                                                    </svg>
                                                    Remove
                                                </button>

                                                {/* Thumbnail Progress Overlay */}
                                                {uploadProgress.thumbnail !==
                                                    undefined &&
                                                    uploadProgress.thumbnail <
                                                        100 && (
                                                        <div className='absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none'>
                                                            <div className='w-32 h-1.5 bg-white/30 rounded-full overflow-hidden'>
                                                                <div
                                                                    className='h-full bg-white transition-all duration-300'
                                                                    style={{
                                                                        width: `${uploadProgress.thumbnail}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className='absolute mt-6 text-white text-xs font-medium'>
                                                                {Math.round(
                                                                    uploadProgress.thumbnail,
                                                                )}
                                                                %
                                                            </span>
                                                        </div>
                                                    )}
                                            </div>
                                        ) : (
                                            <label className='flex flex-col items-center justify-center w-full aspect-video rounded-xl border-2 border-dashed border-text/20 bg-text/5 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer'>
                                                <div className='flex flex-col items-center gap-2 text-text/50'>
                                                    <ImageIcon className='w-12 h-12 text-text opacity-30' />
                                                    <span className='font-medium'>
                                                        Click to upload
                                                        thumbnail
                                                    </span>
                                                    <span className='text-xs'>
                                                        JPG, PNG, WebP up to 5MB
                                                    </span>
                                                </div>
                                                <input
                                                    type='file'
                                                    accept='image/jpeg,image/png,image/webp,image/gif'
                                                    className='hidden'
                                                    onChange={
                                                        handleThumbnailChange
                                                    }
                                                />
                                            </label>
                                        )}
                                        <p className='text-xs text-text/40 mt-2'>
                                            This will be the main image shown in
                                            cafe listings
                                        </p>
                                    </div>

                                    <div>
                                        <label className='block text-sm font-medium mb-2'>
                                            Gallery Images{" "}
                                            <span className='text-text/40'>
                                                (optional)
                                            </span>
                                        </label>
                                        <ImageUpload
                                            value={galleryFiles}
                                            onChange={(files) =>
                                                setGalleryFiles(
                                                    files.filter(
                                                        (f): f is File =>
                                                            f instanceof File,
                                                    ),
                                                )
                                            }
                                            maxImages={5}
                                            progress={
                                                // Convert "gallery-i" keys to numeric index keys for ImageUpload
                                                Object.entries(uploadProgress)
                                                    .filter(([k]) =>
                                                        k.startsWith(
                                                            "gallery-",
                                                        ),
                                                    )
                                                    .reduce(
                                                        (acc, [k, v]) => {
                                                            const idx =
                                                                parseInt(
                                                                    k.split(
                                                                        "-",
                                                                    )[1],
                                                                )
                                                            if (!isNaN(idx))
                                                                acc[idx] = v
                                                            return acc
                                                        },
                                                        {} as Record<
                                                            number,
                                                            number
                                                        >,
                                                    )
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Location */}
                        {currentStep === 2 && (
                            <div className='space-y-6'>
                                <div>
                                    <h3 className='text-xl font-semibold font-serif mb-1'>
                                        Location
                                    </h3>
                                    <p className='text-text/60 text-sm'>
                                        Where is the cafe located?
                                    </p>
                                </div>

                                {/* Google Maps URL Input Step */}
                                <div className='p-5 bg-blue-50/30 border border-blue-100/60 rounded-xl space-y-4'>
                                    <div className='flex items-start gap-3 mb-1'>
                                        <div className='p-2 bg-blue-100/80 rounded-full text-blue-700'>
                                            <MapPin className='w-5 h-5' />
                                        </div>
                                        <div>
                                            <h4 className='font-semibold text-base'>
                                                Quick Fill from Google Maps
                                            </h4>
                                            <p className='text-xs text-text/60'>
                                                Paste a Google Maps link to
                                                automatically extract the
                                                location details
                                            </p>
                                        </div>
                                    </div>

                                    <div className='flex gap-2'>
                                        <div className='flex-1 relative'>
                                            <Link className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                                            <input
                                                type='text'
                                                value={googleMapsUrl}
                                                onChange={(e) => {
                                                    setGoogleMapsUrl(
                                                        e.target.value,
                                                    )
                                                }}
                                                onKeyDown={(e) =>
                                                    e.key === "Enter" &&
                                                    handleGoogleMapsUrl()
                                                }
                                                placeholder='https://maps.app.goo.gl/...'
                                                className='w-full pl-10 pr-4 py-2.5 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm'
                                            />
                                        </div>
                                        <button
                                            type='button'
                                            onClick={handleGoogleMapsUrl}
                                            disabled={
                                                isParsingUrl ||
                                                !googleMapsUrl.trim()
                                            }
                                            className='px-4 py-2 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2 min-w-[80px] justify-center'
                                        >
                                            {isParsingUrl ? (
                                                <Loader2 className='w-4 h-4 animate-spin' />
                                            ) : (
                                                "Fill"
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                    <div>
                                        <label className='block text-sm font-medium mb-2'>
                                            Region{" "}
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        </label>
                                        <select
                                            value={formData.region}
                                            onChange={(e) => {
                                                updateFormData(
                                                    "region",
                                                    e.target.value,
                                                )
                                                updateFormData("province", "")
                                                updateFormData(
                                                    "city_municipality",
                                                    "",
                                                )
                                            }}
                                            className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                        >
                                            <option value=''>
                                                Select region
                                            </option>
                                            {PHILIPPINES_LOCATIONS.regions.map(
                                                (r) => (
                                                    <option
                                                        key={r.name}
                                                        value={r.name}
                                                    >
                                                        {r.name}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </div>

                                    <div>
                                        <label className='block text-sm font-medium mb-2'>
                                            Province{" "}
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        </label>
                                        <select
                                            value={formData.province}
                                            onChange={(e) => {
                                                updateFormData(
                                                    "province",
                                                    e.target.value,
                                                )
                                                updateFormData(
                                                    "city_municipality",
                                                    "",
                                                )
                                            }}
                                            disabled={!formData.region}
                                            className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50'
                                        >
                                            <option value=''>
                                                Select province
                                            </option>
                                            {availableProvinces.map((p) => (
                                                <option
                                                    key={p.name}
                                                    value={p.name}
                                                >
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className='block text-sm font-medium mb-2'>
                                            City/Municipality{" "}
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        </label>
                                        <select
                                            value={formData.city_municipality}
                                            onChange={(e) =>
                                                updateFormData(
                                                    "city_municipality",
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!formData.province}
                                            className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50'
                                        >
                                            <option value=''>
                                                Select city
                                            </option>
                                            {availableCities.map((c) => (
                                                <option
                                                    key={c}
                                                    value={c}
                                                >
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Area/Neighborhood
                                    </label>
                                    <input
                                        type='text'
                                        value={formData.area}
                                        onChange={(e) =>
                                            updateFormData(
                                                "area",
                                                e.target.value,
                                            )
                                        }
                                        placeholder='e.g. IT Park, Ayala Center'
                                        className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                    />
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Full Address{" "}
                                        {!formData.is_hidden_gem ? (
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        ) : (
                                            <span className='text-text/40 font-normal'>
                                                (optional)
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type='text'
                                        value={formData.address_display}
                                        onChange={(e) =>
                                            updateFormData(
                                                "address_display",
                                                e.target.value,
                                            )
                                        }
                                        placeholder={
                                            formData.is_hidden_gem
                                                ? "e.g. Near the old church, General area description"
                                                : "e.g. 123 Main Street, Brgy. Example"
                                        }
                                        className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                    />
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Map Location{" "}
                                        {!formData.is_hidden_gem && (
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        )}
                                    </label>

                                    {/* Hidden Gem Toggle */}
                                    <div className='mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl'>
                                        <label className='flex items-start gap-3 cursor-pointer'>
                                            <input
                                                type='checkbox'
                                                checked={formData.is_hidden_gem}
                                                onChange={(e) => {
                                                    updateFormData(
                                                        "is_hidden_gem",
                                                        e.target.checked,
                                                    )
                                                    // Clear coordinates when switching to Hidden Gem
                                                    if (e.target.checked) {
                                                        updateFormData(
                                                            "lat",
                                                            null,
                                                        )
                                                        updateFormData(
                                                            "lng",
                                                            null,
                                                        )
                                                    }
                                                }}
                                                className='w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 mt-0.5'
                                            />
                                            <div className='flex-1'>
                                                <span className='font-medium text-amber-800 flex items-center gap-2'>
                                                    <Gem className='w-4 h-4' />
                                                    Submit as Hidden Gem
                                                </span>
                                                <p className='text-sm text-amber-700 mt-1'>
                                                    Check this if you don&apos;t
                                                    know the exact address or
                                                    want to keep the location
                                                    private. Hidden Gems show
                                                    only the city/area —
                                                    visitors will need to
                                                    explore to find it!
                                                </p>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Chain Cafe Toggle */}
                                    <div className='mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl'>
                                        <label className='flex items-start gap-3 cursor-pointer'>
                                            <input
                                                type='checkbox'
                                                checked={formData.is_chain}
                                                onChange={(e) => {
                                                    updateFormData(
                                                        "is_chain",
                                                        e.target.checked,
                                                    )
                                                }}
                                                className='w-5 h-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500 mt-0.5'
                                            />
                                            <div className='flex-1'>
                                                <span className='font-medium text-orange-800 flex items-center gap-2'>
                                                    <Store className='w-4 h-4' />
                                                    This is a Large Chain
                                                </span>
                                                <p className='text-sm text-orange-700 mt-1'>
                                                    Only check this for big
                                                    national/international
                                                    franchises (Starbucks,
                                                    Bo&apos;s Coffee, CBTL,
                                                    etc). Local cafes with 2-3
                                                    branches don&apos;t count —
                                                    we want to support them!
                                                    Chain cafes are not shown by
                                                    default in search results to
                                                    prioritize local independent
                                                    cafes, but can still be
                                                    accessed via direct links.
                                                </p>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Show map picker or finding hint based on Hidden Gem toggle */}
                                    {formData.is_hidden_gem ? (
                                        <div className='space-y-4'>
                                            <div className='p-4 bg-amber-50/50 border border-amber-100 rounded-xl'>
                                                <p className='text-sm text-amber-800 flex items-center gap-2'>
                                                    <Gem className='w-4 h-4' />
                                                    No exact location needed for
                                                    Hidden Gems
                                                </p>
                                            </div>
                                            <div>
                                                <label className='block text-sm font-medium mb-2'>
                                                    Finding Hint{" "}
                                                    <span className='text-text/40 font-normal'>
                                                        (optional)
                                                    </span>
                                                </label>
                                                <textarea
                                                    value={
                                                        formData.finding_hint
                                                    }
                                                    onChange={(e) =>
                                                        updateFormData(
                                                            "finding_hint",
                                                            e.target.value,
                                                        )
                                                    }
                                                    maxLength={200}
                                                    placeholder="Give visitors a clue on how to find this gem... (e.g. 'Look for the blue door near the old church')"
                                                    rows={3}
                                                    className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none'
                                                />
                                                <p className='text-xs text-text/40 mt-1'>
                                                    {200 -
                                                        (formData.finding_hint
                                                            ?.length || 0)}{" "}
                                                    characters remaining
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <LocationPicker
                                            lat={formData.lat}
                                            lng={formData.lng}
                                            onChange={(lat, lng) => {
                                                updateFormData("lat", lat)
                                                updateFormData("lng", lng)
                                            }}
                                            onAddressChange={(addr) => {
                                                if (!formData.address_display) {
                                                    updateFormData(
                                                        "address_display",
                                                        addr,
                                                    )
                                                }
                                            }}
                                            onLocationMatch={
                                                handleLocationMatch
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Amenities */}
                        {currentStep === 3 && (
                            <div className='space-y-6'>
                                <div>
                                    <h3 className='text-xl font-semibold font-serif mb-1'>
                                        Amenities & Features
                                    </h3>
                                    <p className='text-text/60 text-sm'>
                                        What does this cafe offer?
                                    </p>
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Price Level
                                    </label>
                                    <p className='text-xs text-text/50 mb-3'>
                                        Based on average drink prices (coffee,
                                        specialty drinks)
                                    </p>
                                    <div className='flex gap-3'>
                                        {[
                                            {
                                                value: "low" as const,
                                                symbol: "₱",
                                                desc: "Under ₱120",
                                            },
                                            {
                                                value: "medium" as const,
                                                symbol: "₱₱",
                                                desc: "₱120-200",
                                            },
                                            {
                                                value: "high" as const,
                                                symbol: "₱₱₱",
                                                desc: "Above ₱200",
                                            },
                                        ].map(({ value, symbol, desc }) => (
                                            <button
                                                key={value}
                                                type='button'
                                                onClick={() =>
                                                    updateFormData(
                                                        "price_level",
                                                        value,
                                                    )
                                                }
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl border-2 font-medium transition-all cursor-pointer text-center",
                                                    formData.price_level ===
                                                        value
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-text/10 text-text/60 hover:border-text/30",
                                                )}
                                            >
                                                <div>{symbol}</div>
                                                <div className='text-xs opacity-70 mt-0.5'>
                                                    {desc}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Coffee Style */}
                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Coffee Style{" "}
                                        <span className='text-text/40 font-normal'>
                                            (optional)
                                        </span>
                                    </label>
                                    <p className='text-xs text-text/50 mb-3'>
                                        How would you describe their coffee
                                        approach?
                                    </p>
                                    <div className='flex gap-3'>
                                        {COFFEE_STYLES.map(
                                            ({ value, label, description }) => (
                                                <button
                                                    key={value}
                                                    type='button'
                                                    onClick={() =>
                                                        updateFormData(
                                                            "coffee_style",
                                                            value as
                                                                | "classic"
                                                                | "artisan",
                                                        )
                                                    }
                                                    className={cn(
                                                        "flex-1 py-3 px-4 rounded-xl border-2 transition-all cursor-pointer text-left",
                                                        formData.coffee_style ===
                                                            value
                                                            ? "border-primary bg-primary/10 text-primary"
                                                            : "border-text/10 text-text/60 hover:border-text/30",
                                                    )}
                                                >
                                                    <div className='font-medium'>
                                                        {label}
                                                    </div>
                                                    <div className='text-xs opacity-70 mt-0.5'>
                                                        {description}
                                                    </div>
                                                </button>
                                            ),
                                        )}
                                        <button
                                            type='button'
                                            onClick={() =>
                                                updateFormData(
                                                    "coffee_style",
                                                    null,
                                                )
                                            }
                                            className={cn(
                                                "px-4 py-3 rounded-xl border-2 transition-all cursor-pointer",
                                                formData.coffee_style === null
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-text/10 text-text/60 hover:border-text/30",
                                            )}
                                        >
                                            <div className='font-medium'>
                                                None
                                            </div>
                                            <div className='text-xs opacity-70 mt-0.5'>
                                                Skip
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <AmenitiesSection
                                    cafe={
                                        formData as unknown as CafeWithRatings
                                    }
                                    onChange={(key, value) =>
                                        updateFormData(
                                            key as keyof CafeSubmission,
                                            value,
                                        )
                                    }
                                />

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Roaster / Coffee Source
                                    </label>
                                    <input
                                        type='text'
                                        value={formData.roaster}
                                        onChange={(e) =>
                                            updateFormData(
                                                "roaster",
                                                e.target.value,
                                            )
                                        }
                                        placeholder='e.g. Local roaster, Yardstick Coffee'
                                        className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 4: Operating Hours */}
                        {currentStep === 4 && (
                            <div className='space-y-6'>
                                <HoursSection
                                    hours={formData.operating_hours}
                                    onChange={(hours) =>
                                        updateFormData("operating_hours", hours)
                                    }
                                />
                            </div>
                        )}

                        {/* Step 5: Contact & Socials */}
                        {currentStep === 5 && (
                            <div className='space-y-6'>
                                <div>
                                    <h3 className='text-xl font-semibold font-serif mb-1'>
                                        Contact & Socials
                                    </h3>
                                    <p className='text-text/60 text-sm'>
                                        How can people reach this cafe?
                                    </p>
                                </div>

                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <div>
                                        <label className='block text-sm font-medium mb-2'>
                                            Website
                                        </label>
                                        <input
                                            type='url'
                                            value={formData.website_url}
                                            onChange={(e) =>
                                                updateFormData(
                                                    "website_url",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder='https://...'
                                            className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                        />
                                    </div>

                                    <div>
                                        <label className='block text-sm font-medium mb-2'>
                                            Phone
                                        </label>
                                        <input
                                            type='tel'
                                            value={formData.phone}
                                            onChange={(e) =>
                                                updateFormData(
                                                    "phone",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder='+63 XXX XXX XXXX'
                                            className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Email
                                    </label>
                                    <input
                                        type='email'
                                        value={formData.email}
                                        onChange={(e) =>
                                            updateFormData(
                                                "email",
                                                e.target.value,
                                            )
                                        }
                                        placeholder='cafe@example.com'
                                        className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                    />
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Social Links
                                    </label>
                                    <SocialLinksEditor
                                        value={formData.socials}
                                        onChange={(socials) =>
                                            updateFormData("socials", socials)
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 6: Review & Submit - Live Preview */}
                        {currentStep === 6 && (
                            <div className='space-y-6'>
                                <div>
                                    <h3 className='text-xl font-semibold font-serif mb-1'>
                                        Submit & Preview
                                    </h3>
                                    <p className='text-text/60 text-sm'>
                                        These are some of the details of the
                                        cafe you entered
                                    </p>
                                </div>

                                {/* LIVE PREVIEW CARD */}
                                <div className='bg-background rounded-2xl border border-text/10 overflow-hidden shadow-lg'>
                                    {/* Hero Header with Background Image */}
                                    <div className='relative h-64 md:h-80 bg-text/10'>
                                        {thumbnailFile ? (
                                            /* eslint-disable-next-line @next/next/no-img-element -- Blob URL from file input, next/image doesn't support */
                                            <img
                                                src={URL.createObjectURL(
                                                    thumbnailFile,
                                                )}
                                                alt={
                                                    formData.name ||
                                                    "Cafe preview"
                                                }
                                                className='w-full h-full object-cover'
                                            />
                                        ) : (
                                            <div className='w-full h-full flex items-center justify-center text-text opacity-30'>
                                                <MapPin className='w-16 h-16' />
                                            </div>
                                        )}

                                        {/* Thumbnail Upload Progress */}
                                        {isSubmitting &&
                                            uploadProgress.thumbnail !==
                                                undefined &&
                                            uploadProgress.thumbnail < 100 && (
                                                <div className='absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 transition-all'>
                                                    <div className='w-48 h-2 bg-white/30 rounded-full overflow-hidden mb-2'>
                                                        <div
                                                            className='h-full bg-primary transition-all duration-300'
                                                            style={{
                                                                width: `${uploadProgress.thumbnail}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className='text-white text-sm font-medium'>
                                                        Uploading cover...{" "}
                                                        {Math.round(
                                                            uploadProgress.thumbnail,
                                                        )}
                                                        %
                                                    </span>
                                                </div>
                                            )}
                                        <div className='absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent' />
                                        <div className='absolute bottom-0 left-0 right-0 p-6'>
                                            <div className='flex items-center gap-2 mb-2'>
                                                {formData.price_level && (
                                                    <span className='px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium'>
                                                        {formData.price_level ===
                                                            "low" && "₱"}
                                                        {formData.price_level ===
                                                            "medium" && "₱₱"}
                                                        {formData.price_level ===
                                                            "high" && "₱₱₱"}
                                                    </span>
                                                )}
                                                {formData.has_wifi && (
                                                    <span className='px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs'>
                                                        WiFi
                                                    </span>
                                                )}
                                            </div>
                                            <h1 className='text-2xl md:text-3xl font-serif font-bold text-white mb-1'>
                                                {formData.name || "Cafe Name"}
                                            </h1>
                                            <p className='text-white/80 text-sm flex items-center gap-1'>
                                                <MapPin className='w-3.5 h-3.5' />
                                                {formData.address_display ||
                                                    `${formData.area ? formData.area + ", " : ""}${formData.city_municipality}, ${formData.province}`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className='p-6 space-y-6'>
                                        {/* About Section */}
                                        {formData.description && (
                                            <div>
                                                <h2 className='text-lg font-serif font-semibold mb-3'>
                                                    About
                                                </h2>
                                                <p className='text-text/70 leading-relaxed'>
                                                    {formData.description}
                                                </p>
                                            </div>
                                        )}

                                        {/* Amenities */}
                                        {(formData.has_wifi ||
                                            formData.has_smoking ||
                                            formData.has_sockets ||
                                            formData.has_parking ||
                                            formData.has_aircon ||
                                            formData.is_pet_friendly ||
                                            formData.has_outdoor_seating ||
                                            formData.has_indoor_seating ||
                                            formData.has_restroom ||
                                            formData.has_bidet ||
                                            formData.has_non_dairy ||
                                            formData.has_decaf ||
                                            formData.serves_food) && (
                                            <div>
                                                <h2 className='text-lg font-serif font-semibold mb-3'>
                                                    Amenities
                                                </h2>
                                                <div className='flex flex-wrap gap-2'>
                                                    {formData.has_wifi && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Wifi className='w-4 h-4 text-primary' />{" "}
                                                            WiFi
                                                        </span>
                                                    )}
                                                    {formData.has_smoking && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Cigarette className='w-4 h-4 text-primary' />{" "}
                                                            Smoking Area
                                                        </span>
                                                    )}
                                                    {formData.has_sockets && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Plug className='w-4 h-4 text-primary' />{" "}
                                                            Power Outlets
                                                        </span>
                                                    )}
                                                    {formData.has_parking && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Car className='w-4 h-4 text-primary' />{" "}
                                                            Parking
                                                        </span>
                                                    )}
                                                    {formData.has_aircon && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Wind className='w-4 h-4 text-primary' />{" "}
                                                            Air Conditioned
                                                        </span>
                                                    )}
                                                    {formData.is_pet_friendly && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Dog className='w-4 h-4 text-primary' />{" "}
                                                            Pet Friendly
                                                        </span>
                                                    )}
                                                    {formData.has_outdoor_seating && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Sun className='w-4 h-4 text-primary' />{" "}
                                                            Outdoor Seating
                                                        </span>
                                                    )}
                                                    {formData.has_indoor_seating && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Armchair className='w-4 h-4 text-primary' />{" "}
                                                            Indoor Seating
                                                        </span>
                                                    )}
                                                    {formData.has_restroom && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Droplet className='w-4 h-4 text-primary' />{" "}
                                                            Restroom
                                                        </span>
                                                    )}
                                                    {formData.has_bidet && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Droplet className='w-4 h-4 text-primary' />{" "}
                                                            Bidet
                                                        </span>
                                                    )}
                                                    {formData.has_non_dairy && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <MilkOff className='w-4 h-4 text-primary' />{" "}
                                                            Non-Dairy Milk
                                                            {formData
                                                                .milk_options
                                                                .length > 0 && (
                                                                <span className='text-xs text-text/60'>
                                                                    (
                                                                    {formData.milk_options.join(
                                                                        ", ",
                                                                    )}
                                                                    )
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                    {formData.has_decaf && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Coffee className='w-4 h-4 text-primary' />{" "}
                                                            Decaf Options
                                                        </span>
                                                    )}
                                                    {formData.serves_food && (
                                                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-text/5 rounded-full text-sm'>
                                                            <Utensils className='w-4 h-4 text-primary' />{" "}
                                                            Serves Food
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Specialties & Tags */}
                                        {(formData.specialty.length > 0 ||
                                            formData.tags.length > 0) && (
                                            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                                {formData.specialty.length >
                                                    0 && (
                                                    <div>
                                                        <h2 className='text-lg font-serif font-semibold mb-3'>
                                                            Specialties
                                                        </h2>
                                                        <div className='flex flex-wrap gap-2'>
                                                            {formData.specialty.map(
                                                                (s) => (
                                                                    <span
                                                                        key={s}
                                                                        className='px-3 py-1 bg-primary/10 text-primary rounded-full text-sm capitalize'
                                                                    >
                                                                        {s.replace(
                                                                            /_/g,
                                                                            " ",
                                                                        )}
                                                                    </span>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {formData.tags.length > 0 && (
                                                    <div>
                                                        <h2 className='text-lg font-serif font-semibold mb-3'>
                                                            Vibe
                                                        </h2>
                                                        <div className='flex flex-wrap gap-2'>
                                                            {formData.tags.map(
                                                                (t) => (
                                                                    <span
                                                                        key={t}
                                                                        className='px-3 py-1 bg-secondary/30 text-text rounded-full text-sm capitalize'
                                                                    >
                                                                        {t.replace(
                                                                            /_/g,
                                                                            " ",
                                                                        )}
                                                                    </span>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Gallery Preview */}
                                        {galleryFiles.length > 0 && (
                                            <div>
                                                <h2 className='text-lg font-serif font-semibold mb-3'>
                                                    Gallery
                                                </h2>
                                                <div className='flex gap-2 overflow-x-auto pb-2'>
                                                    {galleryFiles
                                                        .slice(0, 5)
                                                        .map((file, idx) => (
                                                            <div
                                                                key={idx}
                                                                className='relative w-24 h-24 rounded-lg overflow-hidden shrink-0'
                                                            >
                                                                {/* eslint-disable-next-line @next/next/no-img-element -- Blob URL from file input, next/image doesn't support */}
                                                                <img
                                                                    src={URL.createObjectURL(
                                                                        file,
                                                                    )}
                                                                    alt={`Gallery ${idx + 1}`}
                                                                    className='w-full h-full object-cover'
                                                                />

                                                                {/* Gallery Image Progress */}
                                                                {isSubmitting &&
                                                                    uploadProgress[
                                                                        `gallery-${idx}`
                                                                    ] !==
                                                                        undefined &&
                                                                    uploadProgress[
                                                                        `gallery-${idx}`
                                                                    ] < 100 && (
                                                                        <div className='absolute inset-0 bg-black/50 flex items-center justify-center'>
                                                                            <div className='w-16 h-1 bg-white/30 rounded-full overflow-hidden'>
                                                                                <div
                                                                                    className='h-full bg-white transition-all duration-300'
                                                                                    style={{
                                                                                        width: `${uploadProgress[`gallery-${idx}`]}%`,
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        ))}
                                                    {galleryFiles.length >
                                                        5 && (
                                                        <div className='w-24 h-24 rounded-lg bg-text/10 flex items-center justify-center shrink-0'>
                                                            <span className='text-text/50 text-sm font-medium'>
                                                                +
                                                                {galleryFiles.length -
                                                                    5}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Contact Info */}
                                        {(formData.phone ||
                                            formData.email ||
                                            formData.website_url ||
                                            formData.socials.length > 0) && (
                                            <div>
                                                <h2 className='text-lg font-serif font-semibold mb-3'>
                                                    Contact
                                                </h2>
                                                <div className='flex flex-wrap gap-4 text-sm'>
                                                    {formData.phone && (
                                                        <span className='text-text/70'>
                                                            {formData.phone}
                                                        </span>
                                                    )}
                                                    {formData.email && (
                                                        <span className='text-text/70'>
                                                            {formData.email}
                                                        </span>
                                                    )}
                                                    {formData.website_url && (
                                                        <span className='text-primary'>
                                                            {
                                                                formData.website_url
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                                {formData.socials.length >
                                                    0 && (
                                                    <div className='flex flex-wrap gap-2 mt-2'>
                                                        {formData.socials.map(
                                                            (s, i) => (
                                                                <span
                                                                    key={i}
                                                                    className='text-xs text-text/50 capitalize'
                                                                >
                                                                    {s.title}
                                                                </span>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Owner Verification */}
                                <div className='bg-background border border-text/10 rounded-xl p-4 space-y-4'>
                                    <div className='flex items-start gap-4'>
                                        <div
                                            className={cn(
                                                "w-5 h-5 mt-0.5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors",
                                                formData.is_owner
                                                    ? "bg-primary border-primary text-white"
                                                    : "border-text/30 hover:border-primary",
                                            )}
                                            onClick={() => {
                                                updateFormData(
                                                    "is_owner",
                                                    !formData.is_owner,
                                                )
                                                // Clear proof files when unchecking
                                                if (formData.is_owner) {
                                                    setOwnershipProofFiles([])
                                                }
                                            }}
                                        >
                                            {formData.is_owner && (
                                                <Check className='w-3.5 h-3.5' />
                                            )}
                                        </div>
                                        <div
                                            className='flex-1 cursor-pointer'
                                            onClick={() => {
                                                updateFormData(
                                                    "is_owner",
                                                    !formData.is_owner,
                                                )
                                                if (formData.is_owner) {
                                                    setOwnershipProofFiles([])
                                                }
                                            }}
                                        >
                                            <div className='flex items-center gap-2 mb-1'>
                                                <BadgeCheck className='w-4 h-4 text-primary' />
                                                <span className='font-medium text-sm'>
                                                    I am the owner or manager of
                                                    this cafe
                                                </span>
                                            </div>
                                            <p className='text-xs text-text/60'>
                                                Check this only if you own or
                                                manage this cafe. You&apos;ll
                                                need to upload proof documents
                                                (free verification). Skip this
                                                if you&apos;re just a customer
                                                recommending a cafe.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Proof Upload Section - Only shown when is_owner is checked */}
                                    {formData.is_owner && (
                                        <div className='pl-9 space-y-3'>
                                            <div className='bg-amber-50 border border-amber-200 rounded-lg p-3'>
                                                <p className='text-sm text-amber-800 font-medium mb-1'>
                                                    Proof of Ownership Required
                                                </p>
                                                <p className='text-xs text-amber-700'>
                                                    Please upload at least one
                                                    document to verify your
                                                    ownership. Accepted:
                                                    Business permits, DTI/SEC
                                                    registration, lease
                                                    agreements, official
                                                    letterhead, or photo with
                                                    cafe signage.
                                                </p>
                                            </div>

                                            {/* File Upload Area */}
                                            <div className='border-2 border-dashed border-text/20 rounded-xl p-4 text-center hover:border-primary/50 transition-colors'>
                                                <input
                                                    type='file'
                                                    id='ownership-proof-upload'
                                                    accept='image/jpeg,image/png,image/webp,application/pdf'
                                                    multiple
                                                    className='hidden'
                                                    onChange={(e) => {
                                                        const files =
                                                            Array.from(
                                                                e.target
                                                                    .files ||
                                                                    [],
                                                            )
                                                        if (files.length > 0) {
                                                            setOwnershipProofFiles(
                                                                (prev) => [
                                                                    ...prev,
                                                                    ...files,
                                                                ],
                                                            )
                                                        }
                                                        // Reset input
                                                        e.target.value = ""
                                                    }}
                                                />
                                                <label
                                                    htmlFor='ownership-proof-upload'
                                                    className='cursor-pointer'
                                                >
                                                    <Upload className='w-8 h-8 mx-auto text-text/40 mb-2' />
                                                    <p className='text-sm font-medium text-text/70'>
                                                        Click to upload proof
                                                        documents
                                                    </p>
                                                    <p className='text-xs text-text/50 mt-1'>
                                                        JPEG, PNG, WebP, or PDF
                                                        (max 10MB each)
                                                    </p>
                                                </label>
                                            </div>

                                            {/* Uploaded Files List */}
                                            {ownershipProofFiles.length > 0 && (
                                                <div className='space-y-2'>
                                                    <p className='text-xs font-medium text-text/60'>
                                                        Uploaded Documents (
                                                        {
                                                            ownershipProofFiles.length
                                                        }
                                                        )
                                                    </p>
                                                    {ownershipProofFiles.map(
                                                        (file, idx) => (
                                                            <div
                                                                key={idx}
                                                                className='flex items-center gap-3 bg-text/5 rounded-lg p-2'
                                                            >
                                                                <FileText className='w-4 h-4 text-primary shrink-0' />
                                                                <span className='text-sm text-text/80 flex-1 truncate'>
                                                                    {file.name}
                                                                </span>
                                                                <span className='text-xs text-text/50'>
                                                                    {(
                                                                        file.size /
                                                                        1024
                                                                    ).toFixed(
                                                                        0,
                                                                    )}
                                                                    KB
                                                                </span>
                                                                <button
                                                                    type='button'
                                                                    onClick={() => {
                                                                        setOwnershipProofFiles(
                                                                            (
                                                                                prev,
                                                                            ) =>
                                                                                prev.filter(
                                                                                    (
                                                                                        _,
                                                                                        i,
                                                                                    ) =>
                                                                                        i !==
                                                                                        idx,
                                                                                ),
                                                                        )
                                                                    }}
                                                                    className='p-1 hover:bg-red-100 rounded transition-colors cursor-pointer'
                                                                >
                                                                    <Trash2 className='w-4 h-4 text-red-500' />
                                                                </button>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}

                                            {/* Validation Warning */}
                                            {formData.is_owner &&
                                                ownershipProofFiles.length ===
                                                    0 && (
                                                    <p className='text-xs text-red-500 flex items-center gap-1'>
                                                        <span>⚠</span>
                                                        At least one proof
                                                        document is required to
                                                        claim ownership
                                                    </p>
                                                )}
                                        </div>
                                    )}
                                </div>

                                {/* Submission Note */}
                                <div className='bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800'>
                                    <strong>Note:</strong> Your submission will
                                    be reviewed by our team before being
                                    published. This usually takes 1-2 business
                                    days. We may contact you for additional
                                    information.
                                </div>

                                {/* Terms Agreement */}
                                <p className='text-xs text-text/50 text-center'>
                                    By submitting, you agree to our{" "}
                                    <a
                                        href='/legal/terms'
                                        target='_blank'
                                        className='text-primary hover:underline'
                                    >
                                        Terms of Service
                                    </a>{" "}
                                    and{" "}
                                    <a
                                        href='/legal/content-policy'
                                        target='_blank'
                                        className='text-primary hover:underline'
                                    >
                                        Content Policy
                                    </a>
                                    . You confirm that you have the right to
                                    share any photos you upload.
                                </p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Buttons */}
            <div className='flex justify-between mt-8 pt-6 border-t border-text/10'>
                <button
                    type='button'
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className='flex items-center gap-2 px-6 py-3 text-text/60 hover:text-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer'
                >
                    <ChevronLeft className='w-5 h-5' />
                    Previous
                </button>

                {currentStep < STEPS[STEPS.length - 1].id ? (
                    <button
                        type='button'
                        onClick={nextStep}
                        disabled={currentStep === 0 && !isNameVerified}
                        className='flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        Next
                        <ChevronRight className='w-5 h-5' />
                    </button>
                ) : (
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className='px-8 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer'
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className='w-4 h-4 animate-spin' />
                                <span>
                                    {isProcessing
                                        ? processingStatus || "Processing..."
                                        : "Uploading..."}
                                </span>
                            </>
                        ) : (
                            <>
                                <span>Submit Cafe</span>
                                <Send className='w-4 h-4' />
                            </>
                        )}
                    </motion.button>
                )}
            </div>
            {/* Image Cropper */}
            <ImageCropper
                open={cropperOpen}
                image={croppingImage}
                aspect={16 / 9}
                onComplete={handleCropComplete}
                onCancel={() => {
                    setCropperOpen(false)
                    setCroppingImage(null)
                }}
            />
        </div>
    )
}
