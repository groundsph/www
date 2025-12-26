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
} from "lucide-react"
import { cn } from "@/utils/cn"
import { CafeSubmission, DEFAULT_CAFE_SUBMISSION } from "@/utils/types/extra"
import {
    PHILIPPINES_LOCATIONS,
    getProvincesForRegion,
    getCitiesForProvince,
    CAFE_VIBE_TAGS,
    CAFE_SPECIALTIES,
    BREW_METHODS,
    PAYMENT_METHODS,
} from "@/utils/data/philippines"
import { uploadCafeImageWithProgress } from "@/utils/supabase/storage-client"
import { submitCafe } from "@/app/api/actions/submit"
import { searchCafesSimple } from "@/app/api/actions/cafe"
import ImageUpload from "@/components/reviews/ImageUpload"
import AmenityToggles from "./AmenityToggles"
import OperatingHoursEditor from "./OperatingHoursEditor"
import SocialLinksEditor from "./SocialLinksEditor"
import LocationPicker from "./LocationPicker"
import { cropAndResizeImage, resizeImage } from "@/utils/image-processing"
import ImageCropper from "@/components/ui/ImageCropper"

const STEPS = [
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
    const [currentStep, setCurrentStep] = useState(1)
    const [formData, setFormData] = useState<CafeSubmission>(
        DEFAULT_CAFE_SUBMISSION
    )
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
        null
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
    const [customPaymentMethods, setCustomPaymentMethods] = useState("")
    const [customSpecialties, setCustomSpecialties] = useState("")
    const [customTags, setCustomTags] = useState("")

    // Duplicate checking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cafe search results have dynamic shape
    const [possibleDuplicates, setPossibleDuplicates] = useState<any[]>([])

    useEffect(() => {
        const checkDuplicates = async () => {
            const trimmedName = formData.name.trim()
            console.log(
                "[CafeSubmission] Checking duplicates for:",
                trimmedName
            )
            if (trimmedName.length >= 3) {
                try {
                    const results = await searchCafesSimple(trimmedName)
                    console.log("[CafeSubmission] Results:", results)
                    setPossibleDuplicates(results)
                } catch (err) {
                    console.error(
                        "[CafeSubmission] Error checking duplicates:",
                        err
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
        []
    )

    const resetForm = () => {
        setFormData(DEFAULT_CAFE_SUBMISSION)
        setThumbnailFile(null)
        setGalleryFiles([])
        setUploadProgress({})
        setProcessingStatus("")
        setIsProcessing(false)
        setSuccess(false)
        setCurrentStep(1)
        setError(null)
        setPossibleDuplicates([])
        setCustomPaymentMethods("")
        setCustomSpecialties("")
        setCustomTags("")
        clearDraft()
    }

    const validateStep = (step: number): string | null => {
        switch (step) {
            case 1:
                if (!formData.name.trim()) return "Cafe name is required"
                if (!thumbnailFile) return "Thumbnail image is required"
                break
            case 2:
                if (!formData.region) return "Please select a region"
                if (!formData.province) return "Please select a province"
                if (!formData.city_municipality) return "Please select a city"
                if (!formData.address_display.trim())
                    return "Address is required"
                if (formData.lat === null || formData.lng === null)
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
        setCurrentStep((prev) => Math.min(prev + 1, STEPS.length))
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const prevStep = () => {
        setError(null)
        setCurrentStep((prev) => Math.max(prev - 1, 1))
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
        e: React.ChangeEvent<HTMLInputElement>
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
            }
        )

        // Resize final cropped image to max dimensions if needed
        const finalFile = await resizeImage(file, {
            maxWidth: 2560,
            maxHeight: 1440,
            quality: 0.9,
            format: "image/webp",
        })

        setThumbnailFile(finalFile)
        setThumbnailPreview(URL.createObjectURL(finalFile))
        setCropperOpen(false)
        setCroppingImage(null)
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        setError(null)
        setUploadProgress({})
        setProcessingStatus("Preparing images...")
        setIsProcessing(true)

        try {
            console.log("[Cafe Submit] Starting submission...")

            // 1. Process Thumbnail
            if (!thumbnailFile) {
                throw new Error("Thumbnail is required")
            }

            setProcessingStatus("Cropping and compressing thumbnail...")
            const processedThumbnail = await cropAndResizeImage(thumbnailFile, {
                targetAspectRatio: 16 / 9,
                maxWidth: 2560,
                maxHeight: 1440,
                quality: 0.9,
                format: "image/webp",
            })

            // 2. Process Gallery Images
            setProcessingStatus(
                `Compressing ${galleryFiles.length} gallery images...`
            )
            const processedGalleryFiles: File[] = []
            for (let i = 0; i < galleryFiles.length; i++) {
                const file = galleryFiles[i]
                const processed = await resizeImage(file, {
                    maxWidth: 1920,
                    maxHeight: 1920,
                    quality: 0.85,
                    format: "image/webp",
                })
                processedGalleryFiles.push(processed)
            }

            setIsProcessing(false)
            setProcessingStatus("Uploading images...")

            // 3. Upload Thumbnail
            console.log("[Cafe Submit] Uploading thumbnail...")
            setUploadProgress((prev) => ({ ...prev, thumbnail: 0 }))

            const thumbnailResult = await uploadCafeImageWithProgress(
                processedThumbnail,
                (progress: number) => {
                    setUploadProgress((prev) => ({
                        ...prev,
                        thumbnail: progress,
                    }))
                }
            )

            if (!thumbnailResult.success || !thumbnailResult.url) {
                throw new Error(
                    thumbnailResult.error || "Failed to upload thumbnail"
                )
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
                    }
                )

                if (result.success && result.url) {
                    galleryUrls.push(result.url)
                }
            }

            setProcessingStatus("Finalizing submission...")

            // 5. Submit cafe data
            console.log("[Cafe Submit] Submitting to server...")
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to exclude file fields
            const { thumbnail, gallery, ...serializableFormData } = formData
            const result = await submitCafe(
                serializableFormData,
                thumbnailResult.url,
                galleryUrls
            )

            if (!result.success) {
                throw new Error(result.error || "Failed to submit cafe")
            }

            // Success!
            console.log("[Cafe Submit] Success!")
            clearDraft()
            setSuccess(true)
            onSuccess?.(result.cafeId!, result.slug!)
        } catch (err: unknown) {
            console.error("[Cafe Submit] Error:", err)
            setError(err instanceof Error ? err.message : "An error occurred")
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
                                    !isActive && !isComplete && "text-text/40"
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                                        isActive && "bg-primary text-white",
                                        isComplete &&
                                            "bg-green-200! text-green-600",
                                        !isActive && !isComplete && "bg-text/10"
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
                                            : "bg-text/10"
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
                                                For branches, use:{" "}
                                                <span className='font-medium'>
                                                    Cafe Name - Location
                                                </span>{" "}
                                                (e.g. Starbucks - Ayala Center)
                                            </span>
                                        </label>
                                        <input
                                            type='text'
                                            value={formData.name}
                                            onChange={(e) =>
                                                updateFormData(
                                                    "name",
                                                    e.target.value
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
                                                                )
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
                                                        e.target.value
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
                                        <label className='block text-sm font-medium mb-2'>
                                            Cover Photo{" "}
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        </label>
                                        {thumbnailFile ? (
                                            <div className='relative w-full aspect-video rounded-xl overflow-hidden border-2 border-text/20 bg-text/5'>
                                                {/* eslint-disable-next-line @next/next/no-img-element -- Blob URL from file input, next/image doesn't support */}
                                                <img
                                                    src={URL.createObjectURL(
                                                        thumbnailFile
                                                    )}
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
                                                                    uploadProgress.thumbnail
                                                                )}
                                                                %
                                                            </span>
                                                        </div>
                                                    )}
                                            </div>
                                        ) : (
                                            <label className='flex flex-col items-center justify-center w-full aspect-video rounded-xl border-2 border-dashed border-text/20 bg-text/5 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer'>
                                                <div className='flex flex-col items-center gap-2 text-text/50'>
                                                    <svg
                                                        xmlns='http://www.w3.org/2000/svg'
                                                        width='40'
                                                        height='40'
                                                        viewBox='0 0 24 24'
                                                        fill='none'
                                                        stroke='currentColor'
                                                        strokeWidth='1.5'
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                    >
                                                        <rect
                                                            width='18'
                                                            height='18'
                                                            x='3'
                                                            y='3'
                                                            rx='2'
                                                            ry='2'
                                                        />
                                                        <circle
                                                            cx='9'
                                                            cy='9'
                                                            r='2'
                                                        />
                                                        <path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' />
                                                    </svg>
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
                                                            f instanceof File
                                                    )
                                                )
                                            }
                                            maxImages={0}
                                            progress={
                                                // Convert "gallery-i" keys to numeric index keys for ImageUpload
                                                Object.entries(uploadProgress)
                                                    .filter(([k]) =>
                                                        k.startsWith("gallery-")
                                                    )
                                                    .reduce(
                                                        (acc, [k, v]) => {
                                                            const idx =
                                                                parseInt(
                                                                    k.split(
                                                                        "-"
                                                                    )[1]
                                                                )
                                                            if (!isNaN(idx))
                                                                acc[idx] = v
                                                            return acc
                                                        },
                                                        {} as Record<
                                                            number,
                                                            number
                                                        >
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
                                                    e.target.value
                                                )
                                                updateFormData("province", "")
                                                updateFormData(
                                                    "city_municipality",
                                                    ""
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
                                                )
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
                                                    e.target.value
                                                )
                                                updateFormData(
                                                    "city_municipality",
                                                    ""
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
                                                    e.target.value
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
                                                e.target.value
                                            )
                                        }
                                        placeholder='e.g. IT Park, Ayala Center'
                                        className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                    />
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Full Address{" "}
                                        <span className='text-red-500'>*</span>
                                    </label>
                                    <input
                                        type='text'
                                        value={formData.address_display}
                                        onChange={(e) =>
                                            updateFormData(
                                                "address_display",
                                                e.target.value
                                            )
                                        }
                                        placeholder='e.g. 123 Main Street, Brgy. Example'
                                        className='w-full px-4 py-3 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none'
                                    />
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Map Location{" "}
                                        <span className='text-red-500'>*</span>
                                    </label>
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
                                                    addr
                                                )
                                            }
                                        }}
                                    />
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
                                    <label className='block text-sm font-medium mb-3'>
                                        Amenities
                                    </label>
                                    <AmenityToggles
                                        values={{
                                            has_wifi: formData.has_wifi,
                                            has_sockets: formData.has_sockets,
                                            has_parking: formData.has_parking,
                                            has_aircon: formData.has_aircon,
                                            is_pet_friendly:
                                                formData.is_pet_friendly,
                                            has_outdoor_seating:
                                                formData.has_outdoor_seating,
                                            serves_food: formData.serves_food,
                                            is_work_friendly:
                                                formData.is_work_friendly,
                                        }}
                                        onChange={(key, value) =>
                                            updateFormData(
                                                key as keyof CafeSubmission,
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                value as any
                                            )
                                        }
                                    />
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Price Level
                                    </label>
                                    <div className='flex gap-3'>
                                        {(
                                            ["low", "medium", "high"] as const
                                        ).map((level) => (
                                            <button
                                                key={level}
                                                type='button'
                                                onClick={() =>
                                                    updateFormData(
                                                        "price_level",
                                                        level
                                                    )
                                                }
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl border-2 font-medium transition-all cursor-pointer",
                                                    formData.price_level ===
                                                        level
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-text/10 text-text/60 hover:border-text/30"
                                                )}
                                            >
                                                {level === "low" && "₱"}
                                                {level === "medium" && "₱₱"}
                                                {level === "high" && "₱₱₱"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Payment Methods
                                    </label>
                                    <div className='flex flex-wrap gap-2 mb-3'>
                                        {PAYMENT_METHODS.map((method) => {
                                            const isSelected =
                                                formData.payment_methods.includes(
                                                    method
                                                )
                                            return (
                                                <button
                                                    key={method}
                                                    type='button'
                                                    onClick={() => {
                                                        const current =
                                                            formData.payment_methods
                                                                .split(",")
                                                                .map((s) =>
                                                                    s.trim()
                                                                )
                                                                .filter(Boolean)
                                                        const updated =
                                                            isSelected
                                                                ? current.filter(
                                                                      (m) =>
                                                                          m !==
                                                                          method
                                                                  )
                                                                : [
                                                                      ...current,
                                                                      method,
                                                                  ]
                                                        updateFormData(
                                                            "payment_methods",
                                                            updated.join(", ")
                                                        )
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-all cursor-pointer",
                                                        isSelected
                                                            ? "bg-primary text-white"
                                                            : "bg-text/10 text-text/60 hover:bg-text/20"
                                                    )}
                                                >
                                                    {method.replace("_", " ")}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <input
                                        type='text'
                                        value={customPaymentMethods}
                                        onChange={(e) =>
                                            setCustomPaymentMethods(
                                                e.target.value
                                            )
                                        }
                                        onBlur={() => {
                                            if (customPaymentMethods.trim()) {
                                                const current =
                                                    formData.payment_methods
                                                        .split(",")
                                                        .map((s) => s.trim())
                                                        .filter(Boolean)
                                                const custom =
                                                    customPaymentMethods
                                                        .split(",")
                                                        .map((s) => s.trim())
                                                        .filter(Boolean)
                                                const merged = [
                                                    ...new Set([
                                                        ...current,
                                                        ...custom,
                                                    ]),
                                                ]
                                                updateFormData(
                                                    "payment_methods",
                                                    merged.join(", ")
                                                )
                                                setCustomPaymentMethods("")
                                            }
                                        }}
                                        placeholder='Add more (comma separated): e.g. PayPal, Grab Pay'
                                        className='w-full px-4 py-2 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm'
                                    />
                                    {/* Show selected payment methods */}
                                    {formData.payment_methods && (
                                        <div className='flex flex-wrap gap-2 mt-3'>
                                            {formData.payment_methods
                                                .split(",")
                                                .map((m) => m.trim())
                                                .filter(Boolean)
                                                .map((method) => (
                                                    <span
                                                        key={method}
                                                        className='inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium capitalize'
                                                    >
                                                        {method.replace(
                                                            /_/g,
                                                            " "
                                                        )}
                                                        <button
                                                            type='button'
                                                            onClick={() => {
                                                                const updated =
                                                                    formData.payment_methods
                                                                        .split(
                                                                            ","
                                                                        )
                                                                        .map(
                                                                            (
                                                                                m
                                                                            ) =>
                                                                                m.trim()
                                                                        )
                                                                        .filter(
                                                                            (
                                                                                m
                                                                            ) =>
                                                                                m &&
                                                                                m !==
                                                                                    method
                                                                        )
                                                                        .join(
                                                                            ", "
                                                                        )
                                                                updateFormData(
                                                                    "payment_methods",
                                                                    updated
                                                                )
                                                            }}
                                                            className='ml-0.5 hover:text-red-500 cursor-pointer'
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Specialties
                                    </label>
                                    <div className='flex flex-wrap gap-2 mb-3'>
                                        {CAFE_SPECIALTIES.map((spec) => {
                                            const isSelected =
                                                formData.specialty.includes(
                                                    spec
                                                )
                                            return (
                                                <button
                                                    key={spec}
                                                    type='button'
                                                    onClick={() => {
                                                        const updated =
                                                            isSelected
                                                                ? formData.specialty.filter(
                                                                      (s) =>
                                                                          s !==
                                                                          spec
                                                                  )
                                                                : [
                                                                      ...formData.specialty,
                                                                      spec,
                                                                  ]
                                                        updateFormData(
                                                            "specialty",
                                                            updated
                                                        )
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-all cursor-pointer",
                                                        isSelected
                                                            ? "bg-primary text-white"
                                                            : "bg-text/10 text-text/60 hover:bg-text/20"
                                                    )}
                                                >
                                                    {spec.replace("_", " ")}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <input
                                        type='text'
                                        value={customSpecialties}
                                        onChange={(e) =>
                                            setCustomSpecialties(e.target.value)
                                        }
                                        onBlur={() => {
                                            if (customSpecialties.trim()) {
                                                const custom = customSpecialties
                                                    .split(",")
                                                    .map((s) =>
                                                        s
                                                            .trim()
                                                            .toLowerCase()
                                                            .replace(
                                                                /\s+/g,
                                                                "_"
                                                            )
                                                    )
                                                    .filter(Boolean)
                                                const merged = [
                                                    ...new Set([
                                                        ...formData.specialty,
                                                        ...custom,
                                                    ]),
                                                ]
                                                updateFormData(
                                                    "specialty",
                                                    merged
                                                )
                                                setCustomSpecialties("")
                                            }
                                        }}
                                        placeholder='Add more (comma separated): e.g. cold brew, single origin'
                                        className='w-full px-4 py-2 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm'
                                    />
                                    {/* Show selected specialties */}
                                    {formData.specialty.length > 0 && (
                                        <div className='flex flex-wrap gap-2 mt-3'>
                                            {formData.specialty.map((spec) => (
                                                <span
                                                    key={spec}
                                                    className='inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium'
                                                >
                                                    {spec.replace(/_/g, " ")}
                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            updateFormData(
                                                                "specialty",
                                                                formData.specialty.filter(
                                                                    (s) =>
                                                                        s !==
                                                                        spec
                                                                )
                                                            )
                                                        }
                                                        className='ml-0.5 hover:text-red-500 cursor-pointer'
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Vibe Tags
                                    </label>
                                    <div className='flex flex-wrap gap-2 mb-3'>
                                        {CAFE_VIBE_TAGS.map((tag) => {
                                            const isSelected =
                                                formData.tags.includes(tag)
                                            return (
                                                <button
                                                    key={tag}
                                                    type='button'
                                                    onClick={() => {
                                                        const updated =
                                                            isSelected
                                                                ? formData.tags.filter(
                                                                      (t) =>
                                                                          t !==
                                                                          tag
                                                                  )
                                                                : [
                                                                      ...formData.tags,
                                                                      tag,
                                                                  ]
                                                        updateFormData(
                                                            "tags",
                                                            updated
                                                        )
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-all cursor-pointer",
                                                        isSelected
                                                            ? "bg-secondary text-text"
                                                            : "bg-text/10 text-text/60 hover:bg-text/20"
                                                    )}
                                                >
                                                    {tag.replace("_", " ")}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <input
                                        type='text'
                                        value={customTags}
                                        onChange={(e) =>
                                            setCustomTags(e.target.value)
                                        }
                                        onBlur={() => {
                                            if (customTags.trim()) {
                                                const custom = customTags
                                                    .split(",")
                                                    .map((s) =>
                                                        s
                                                            .trim()
                                                            .toLowerCase()
                                                            .replace(
                                                                /\s+/g,
                                                                "_"
                                                            )
                                                    )
                                                    .filter(Boolean)
                                                const merged = [
                                                    ...new Set([
                                                        ...formData.tags,
                                                        ...custom,
                                                    ]),
                                                ]
                                                updateFormData("tags", merged)
                                                setCustomTags("")
                                            }
                                        }}
                                        placeholder='Add more (comma separated): e.g. hidden gem, rooftop'
                                        className='w-full px-4 py-2 border border-text/20 rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm'
                                    />
                                    {/* Show selected tags */}
                                    {formData.tags.length > 0 && (
                                        <div className='flex flex-wrap gap-2 mt-3'>
                                            {formData.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className='inline-flex items-center gap-1 px-2.5 py-1 bg-secondary/20 text-text border border-secondary/30 rounded-full text-xs font-medium'
                                                >
                                                    {tag.replace(/_/g, " ")}
                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            updateFormData(
                                                                "tags",
                                                                formData.tags.filter(
                                                                    (t) =>
                                                                        t !==
                                                                        tag
                                                                )
                                                            )
                                                        }
                                                        className='ml-0.5 hover:text-red-500 cursor-pointer'
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Brew Methods
                                    </label>
                                    <div className='flex flex-wrap gap-2'>
                                        {BREW_METHODS.map((method) => {
                                            const isSelected =
                                                formData.brew_methods.includes(
                                                    method
                                                )
                                            return (
                                                <button
                                                    key={method}
                                                    type='button'
                                                    onClick={() => {
                                                        const updated =
                                                            isSelected
                                                                ? formData.brew_methods.filter(
                                                                      (m) =>
                                                                          m !==
                                                                          method
                                                                  )
                                                                : [
                                                                      ...formData.brew_methods,
                                                                      method,
                                                                  ]
                                                        updateFormData(
                                                            "brew_methods",
                                                            updated
                                                        )
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer",
                                                        isSelected
                                                            ? "bg-primary/20 text-primary border border-primary/30"
                                                            : "bg-text/10 text-text/60 hover:bg-text/20"
                                                    )}
                                                >
                                                    {method}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

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
                                                e.target.value
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
                                <div>
                                    <h3 className='text-xl font-semibold font-serif mb-1'>
                                        Operating Hours
                                    </h3>
                                    <p className='text-text/60 text-sm'>
                                        When is the cafe open?
                                    </p>
                                </div>

                                <OperatingHoursEditor
                                    value={formData.operating_hours}
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
                                                    e.target.value
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
                                                    e.target.value
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
                                                e.target.value
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
                                                    thumbnailFile
                                                )}
                                                alt={
                                                    formData.name ||
                                                    "Cafe preview"
                                                }
                                                className='w-full h-full object-cover'
                                            />
                                        ) : (
                                            <div className='w-full h-full flex items-center justify-center text-text/30'>
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
                                                            uploadProgress.thumbnail
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
                                            formData.has_sockets ||
                                            formData.has_parking ||
                                            formData.has_aircon ||
                                            formData.is_pet_friendly ||
                                            formData.has_outdoor_seating ||
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
                                                                            " "
                                                                        )}
                                                                    </span>
                                                                )
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
                                                                            " "
                                                                        )}
                                                                    </span>
                                                                )
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
                                                                        file
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
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Owner Verification */}
                                <div className='bg-background border border-text/10 rounded-xl p-4 flex items-start gap-4'>
                                    <div
                                        className={cn(
                                            "w-5 h-5 mt-0.5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors",
                                            formData.is_owner
                                                ? "bg-primary border-primary text-white"
                                                : "border-text/30 hover:border-primary"
                                        )}
                                        onClick={() =>
                                            updateFormData(
                                                "is_owner",
                                                !formData.is_owner
                                            )
                                        }
                                    >
                                        {formData.is_owner && (
                                            <Check className='w-3.5 h-3.5' />
                                        )}
                                    </div>
                                    <div
                                        className='flex-1 cursor-pointer'
                                        onClick={() =>
                                            updateFormData(
                                                "is_owner",
                                                !formData.is_owner
                                            )
                                        }
                                    >
                                        <div className='flex items-center gap-2 mb-1'>
                                            <BadgeCheck className='w-4 h-4 text-primary' />
                                            <span className='font-medium text-sm'>
                                                I am the owner or manager of
                                                this cafe
                                            </span>
                                        </div>
                                        <p className='text-xs text-text/60'>
                                            By checking this, you request to
                                            claim manage rights for this cafe
                                            page. You will need to provide
                                            verification documents upon admin
                                            request.
                                        </p>
                                    </div>
                                </div>

                                {/* Submission Note */}
                                <div className='bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800'>
                                    <strong>Note:</strong> Your submission will
                                    be reviewed by our team before being
                                    published. This usually takes 1-2 business
                                    days. We may contact you for additional
                                    information.
                                </div>
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
                    disabled={currentStep === 1}
                    className='flex items-center gap-2 px-6 py-3 text-text/60 hover:text-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer'
                >
                    <ChevronLeft className='w-5 h-5' />
                    Previous
                </button>

                {currentStep < STEPS.length ? (
                    <button
                        type='button'
                        onClick={nextStep}
                        className='flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors cursor-pointer'
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
                        className='px-8 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
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
