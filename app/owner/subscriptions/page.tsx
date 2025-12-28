"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
    ChevronRight,
    Loader2,
    Shield,
    Check,
    AlertTriangle,
    Upload,
    CreditCard,
    ArrowLeft,
    Building2,
    ChevronDown,
} from "lucide-react"
import {
    SUBSCRIPTION_TIERS,
    SubscriptionTier,
    OwnedCafe,
} from "@/utils/types/owner"
import { submitManualPayment } from "@/app/api/actions/subscription"
import { uploadCafeImageWithProgress } from "@/utils/supabase/storage-client"
import { useNotification } from "@/components/NotificationProvider"
import Image from "next/image"
import Link from "next/link"
import { getOwnedCafes } from "@/app/api/actions/owner"
import { getCafeThumbnailUrl } from "@/utils/extras"
import qrph from "@/assets/qrph-dono.jpg"
import gcash from "@/assets/gcash-dono.png"

export default function SubscriptionsPage() {
    return (
        <Suspense
            fallback={
                <div className='flex items-center justify-center min-h-[60vh]'>
                    <Loader2 className='w-8 h-8 animate-spin text-primary' />
                </div>
            }
        >
            <SubscriptionsContent />
        </Suspense>
    )
}

function SubscriptionsContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const preselectedSlug = searchParams.get("cafe")
    const { addNotification } = useNotification()

    const [cafes, setCafes] = useState<OwnedCafe[]>([])
    const [selectedCafe, setSelectedCafe] = useState<OwnedCafe | null>(null)
    const [cafeDropdownOpen, setCafeDropdownOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [selectedTier, setSelectedTier] = useState<"pro" | "premium" | null>(
        null
    )
    const [paymentProof, setPaymentProof] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    // Load owned cafes
    useEffect(() => {
        async function loadCafes() {
            try {
                const ownedCafes = await getOwnedCafes()
                setCafes(ownedCafes)

                // Pre-select cafe if slug provided
                if (preselectedSlug) {
                    const cafe = ownedCafes.find(
                        (c) => c.slug === preselectedSlug
                    )
                    if (cafe) setSelectedCafe(cafe)
                }
                // Auto-select if only one cafe
                else if (ownedCafes.length === 1) {
                    setSelectedCafe(ownedCafes[0])
                }
            } catch (error) {
                console.error("Failed to load cafes:", error)
                addNotification("Failed to load your cafes", "error")
            } finally {
                setLoading(false)
            }
        }
        loadCafes()
    }, [preselectedSlug, addNotification])

    const currentTier = selectedCafe?.subscription?.tier || "free"

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setPaymentProof(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }

    const handleSubmit = async () => {
        if (!selectedTier || !paymentProof || !selectedCafe) return

        setUploading(true)
        try {
            // 1. Upload proof to public cafes bucket
            const uploadResult = await uploadCafeImageWithProgress(
                paymentProof,
                (progress) => setUploadProgress(progress),
                "cafes",
                `payment-proofs/${selectedCafe.id}/${Date.now()}_${paymentProof.name}`
            )

            if (!uploadResult.success || !uploadResult.url) {
                throw new Error("Failed to upload proof of payment")
            }

            // 2. Submit payment record
            const result = await submitManualPayment(
                selectedCafe.id,
                selectedTier,
                uploadResult.url
            )

            if (result.success) {
                addNotification(
                    "Payment submitted successfully! You now have access.",
                    "success"
                )
                router.refresh()
                router.push(`/owner/cafes/${selectedCafe.slug}`)
            } else {
                throw new Error(result.error || "Failed to submit payment")
            }
        } catch (error) {
            console.error("Payment submission error:", error)
            addNotification(
                error instanceof Error ? error.message : "An error occurred",
                "error"
            )
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    if (loading) {
        return (
            <div className='flex items-center justify-center min-h-[60vh]'>
                <Loader2 className='w-8 h-8 animate-spin text-primary' />
            </div>
        )
    }

    if (cafes.length === 0) {
        return (
            <div className='max-w-4xl mx-auto py-8 px-4 text-center'>
                <Building2 className='w-16 h-16 mx-auto mb-4 text-text/30' />
                <h1 className='text-2xl font-serif font-bold mb-2'>
                    No Cafes Found
                </h1>
                <p className='text-text/60 mb-6'>
                    You need to own at least one cafe to upgrade a subscription.
                </p>
                <Link
                    href='/owner'
                    className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg'
                >
                    <ArrowLeft className='w-4 h-4' />
                    Back to Dashboard
                </Link>
            </div>
        )
    }

    return (
        <div className='max-w-4xl mx-auto py-8 px-4 [&_button]:cursor-pointer'>
            <Link
                href='/owner'
                className='inline-flex items-center gap-2 text-text/60 hover:text-text mb-6 transition-colors'
            >
                <ArrowLeft className='w-4 h-4' />
                Back to Dashboard
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className='text-3xl font-serif font-bold mb-2'>
                    Upgrade Your Cafe
                </h1>
                <p className='text-text/60 mb-8 max-w-2xl'>
                    Unlock premium features to grow your business and reach more
                    coffee lovers. Support the platform with our special
                    Founders&apos; Promo rates.
                </p>

                {/* Cafe Selector */}
                <div className='mb-8'>
                    <label className='block text-sm font-medium text-text/60 mb-2'>
                        Select Cafe to Upgrade
                    </label>
                    <div className='relative'>
                        <button
                            onClick={() =>
                                setCafeDropdownOpen(!cafeDropdownOpen)
                            }
                            className='w-full flex items-center justify-between gap-3 p-4 bg-text/5 border border-text/10 rounded-xl hover:border-primary/30 transition-colors'
                        >
                            {selectedCafe ? (
                                <div className='flex items-center gap-3'>
                                    {selectedCafe.thumbnail ? (
                                        <div className='relative w-10 h-10 rounded-lg overflow-hidden shrink-0'>
                                            <Image
                                                src={getCafeThumbnailUrl(
                                                    selectedCafe.thumbnail
                                                )}
                                                alt={selectedCafe.name}
                                                fill
                                                className='object-cover'
                                            />
                                        </div>
                                    ) : (
                                        <div className='w-10 h-10 rounded-lg bg-text/10 flex items-center justify-center'>
                                            <Building2 className='w-5 h-5 text-text/40' />
                                        </div>
                                    )}
                                    <div className='text-left'>
                                        <p className='font-semibold'>
                                            {selectedCafe.name}
                                        </p>
                                        <p className='text-xs text-text/50'>
                                            Current:{" "}
                                            {selectedCafe.subscription?.tier ||
                                                "Free"}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <span className='text-text/50'>
                                    Choose a cafe...
                                </span>
                            )}
                            <ChevronDown
                                className={`w-5 h-5 text-text/50 transition-transform ${cafeDropdownOpen ? "rotate-180" : ""}`}
                            />
                        </button>

                        <AnimatePresence>
                            {cafeDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className='absolute top-full left-0 right-0 mt-2 bg-background border border-text/10 rounded-xl shadow-lg z-10 overflow-hidden'
                                >
                                    {cafes.map((cafe) => (
                                        <button
                                            key={cafe.id}
                                            onClick={() => {
                                                setSelectedCafe(cafe)
                                                setCafeDropdownOpen(false)
                                                setSelectedTier(null) // Reset tier selection
                                            }}
                                            className={`w-full flex items-center gap-3 p-4 hover:bg-text/5 transition-colors ${
                                                selectedCafe?.id === cafe.id
                                                    ? "bg-primary/5"
                                                    : ""
                                            }`}
                                        >
                                            {cafe.thumbnail ? (
                                                <div className='relative w-10 h-10 rounded-lg overflow-hidden shrink-0'>
                                                    <Image
                                                        src={getCafeThumbnailUrl(
                                                            cafe.thumbnail
                                                        )}
                                                        alt={cafe.name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                </div>
                                            ) : (
                                                <div className='w-10 h-10 rounded-lg bg-text/10 flex items-center justify-center'>
                                                    <Building2 className='w-5 h-5 text-text/40' />
                                                </div>
                                            )}
                                            <div className='text-left flex-1'>
                                                <p className='font-semibold'>
                                                    {cafe.name}
                                                </p>
                                                <p className='text-xs text-text/50'>
                                                    {cafe.city_municipality},{" "}
                                                    {cafe.region}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-xs px-2 py-1 rounded-full ${
                                                    cafe.subscription?.tier ===
                                                    "premium"
                                                        ? "bg-amber-100 text-amber-700"
                                                        : cafe.subscription
                                                                ?.tier === "pro"
                                                          ? "bg-blue-100 text-blue-700"
                                                          : "bg-gray-100 text-gray-600"
                                                }`}
                                            >
                                                {cafe.subscription?.tier ||
                                                    "Free"}
                                            </span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Plans Grid - Only show when cafe is selected */}
                {selectedCafe && (
                    <>
                        <div className='grid md:grid-cols-2 gap-6 mb-12'>
                            {/* Pro Plan */}
                            <div
                                className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                                    selectedTier === "pro"
                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                        : "border-text/10 bg-background hover:border-primary/50"
                                }`}
                                onClick={() => setSelectedTier("pro")}
                            >
                                {currentTier === "pro" && (
                                    <div className='absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full'>
                                        CURRENT PLAN
                                    </div>
                                )}
                                <h3 className='text-xl font-bold mb-2'>
                                    Pro Plan
                                </h3>
                                <div className='mb-4'>
                                    <span className='text-3xl font-bold font-serif'>
                                        ₱2,000
                                    </span>
                                    <span className='text-text/60'>
                                        {" "}
                                        / 6 months
                                    </span>
                                </div>
                                <div className='inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded mb-6'>
                                    FOUNDER&apos;S PROMO
                                </div>

                                <ul className='space-y-3 mb-6'>
                                    {SUBSCRIPTION_TIERS.pro.features.map(
                                        (feature, i) => (
                                            <li
                                                key={i}
                                                className='flex items-start gap-2 text-sm text-text/80'
                                            >
                                                <Check className='w-4 h-4 text-green-500 shrink-0 mt-0.5' />
                                                {feature}
                                            </li>
                                        )
                                    )}
                                </ul>
                            </div>

                            {/* Premium Plan */}
                            <div
                                className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                                    selectedTier === "premium"
                                        ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20"
                                        : "border-text/10 bg-background hover:border-amber-500/50"
                                }`}
                                onClick={() => setSelectedTier("premium")}
                            >
                                {currentTier === "premium" && (
                                    <div className='absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full'>
                                        CURRENT PLAN
                                    </div>
                                )}
                                <h3 className='text-xl font-bold mb-2 flex items-center gap-2'>
                                    Premium Plan
                                    <Shield className='w-5 h-5 text-amber-500' />
                                </h3>
                                <div className='mb-4'>
                                    <span className='text-3xl font-bold font-serif'>
                                        ₱4,000
                                    </span>
                                    <span className='text-text/60'>
                                        {" "}
                                        / 6 months
                                    </span>
                                </div>
                                <div className='inline-block bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded mb-6'>
                                    FOUNDER&apos;S PROMO
                                </div>

                                <ul className='space-y-3 mb-6'>
                                    {SUBSCRIPTION_TIERS.premium.features.map(
                                        (feature, i) => (
                                            <li
                                                key={i}
                                                className='flex items-start gap-2 text-sm text-text/80'
                                            >
                                                <Check className='w-4 h-4 text-green-500 shrink-0 mt-0.5' />
                                                {feature}
                                            </li>
                                        )
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Payment Section */}
                        <AnimatePresence>
                            {selectedTier && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className='bg-background rounded-2xl border border-text/10 overflow-hidden shadow-md'
                                >
                                    <div className='p-6 md:p-8'>
                                        <h3 className='text-xl font-bold mb-6 flex items-center gap-2'>
                                            <CreditCard className='w-5 h-5 text-primary' />
                                            Complete Payment
                                        </h3>

                                        <div className='grid md:grid-cols-2 gap-8'>
                                            {/* Left Column: Instructions */}
                                            <div className='space-y-6'>
                                                <div className='bg-text/5 p-4 rounded-xl space-y-3'>
                                                    <h4 className='font-semibold text-sm uppercase tracking-wider text-text/60'>
                                                        Payment Option 1: GCash
                                                        / QR Ph
                                                    </h4>
                                                    <div>
                                                        <p className='text-sm text-text/60'>
                                                            Scan either QR code
                                                            using your payment
                                                            app (GCash, Maya,
                                                            etc).
                                                            <br />
                                                            Important: Please
                                                            save your proof of
                                                            payment
                                                            (screenshot).
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className='space-y-4'>
                                                    {/* Amount Due */}
                                                    <div className='bg-background rounded-lg p-3 border border-tertiary/30'>
                                                        <p className='text-xs text-text/40 uppercase font-bold tracking-wider mb-1'>
                                                            Amount Due
                                                        </p>
                                                        <p className='font-mono text-xl font-bold text-primary'>
                                                            ₱
                                                            {selectedTier ===
                                                            "pro"
                                                                ? "2,000"
                                                                : "4,000"}
                                                        </p>
                                                    </div>

                                                    {/* QR Codes Grid */}
                                                    <div className='grid grid-cols-2 gap-3'>
                                                        <div className='bg-background rounded-lg p-3 border border-tertiary/30 flex flex-col items-center text-center'>
                                                            <div className='relative w-full aspect-square mb-2 bg-white rounded overflow-hidden'>
                                                                <Image
                                                                    src={qrph}
                                                                    alt='QR Ph Code'
                                                                    fill
                                                                    className='object-contain'
                                                                />
                                                            </div>
                                                            <p className='text-xs font-bold text-text/60'>
                                                                GoTyme (QR Ph)
                                                            </p>
                                                        </div>

                                                        <div className='bg-background rounded-lg p-3 border border-tertiary/30 flex flex-col items-center text-center'>
                                                            <div className='relative w-full aspect-square mb-2 bg-white rounded overflow-hidden'>
                                                                <Image
                                                                    src={gcash}
                                                                    alt='GCash QR Code'
                                                                    fill
                                                                    className='object-contain'
                                                                />
                                                            </div>
                                                            <p className='text-xs font-bold text-[#007DFE]'>
                                                                GCash
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Column: Upload Proof */}
                                            <div>
                                                <h3 className='font-semibold text-lg flex items-center gap-2 mb-4'>
                                                    <span className='bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm'>
                                                        3
                                                    </span>
                                                    Upload Proof of Payment
                                                </h3>

                                                <div className='bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6'>
                                                    <div className='flex gap-3'>
                                                        <AlertTriangle className='w-5 h-5 text-amber-600 shrink-0' />
                                                        <div className='space-y-1'>
                                                            <p className='font-medium text-amber-700'>
                                                                Warning
                                                            </p>
                                                            <p className='text-sm text-amber-700/80 leading-relaxed'>
                                                                Please ensure
                                                                you upload a
                                                                valid proof of
                                                                payment.
                                                                Submitting fake
                                                                or invalid
                                                                proofs may
                                                                result in the
                                                                <strong>
                                                                    {" "}
                                                                    permanent
                                                                    banning
                                                                </strong>{" "}
                                                                of your account
                                                                and the removal
                                                                of owner access
                                                                to all your
                                                                cafes.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className='relative mb-6'>
                                                    <input
                                                        type='file'
                                                        accept='image/*'
                                                        onChange={
                                                            handleFileChange
                                                        }
                                                        className='hidden'
                                                        id='proof-upload'
                                                    />
                                                    <label
                                                        htmlFor='proof-upload'
                                                        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                                                            paymentProof
                                                                ? "border-primary bg-primary/5"
                                                                : "border-text/20 hover:border-primary/50 hover:bg-text/5"
                                                        }`}
                                                    >
                                                        {previewUrl ? (
                                                            <div className='relative w-full h-full p-2'>
                                                                <Image
                                                                    src={
                                                                        previewUrl
                                                                    }
                                                                    alt='Payment proof'
                                                                    fill
                                                                    className='object-contain rounded-lg'
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className='flex flex-col items-center text-text/30'>
                                                                <Upload className='w-8 h-8 mb-2 opacity-30 text-text' />
                                                                <span className='text-sm font-medium'>
                                                                    Click to
                                                                    upload
                                                                    receipt
                                                                </span>
                                                                <span className='text-xs'>
                                                                    JPG, PNG,
                                                                    WEBP
                                                                </span>
                                                            </div>
                                                        )}
                                                    </label>
                                                </div>

                                                <button
                                                    onClick={handleSubmit}
                                                    disabled={
                                                        !paymentProof ||
                                                        uploading
                                                    }
                                                    className='w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                                                >
                                                    {uploading ? (
                                                        <>
                                                            <Loader2 className='w-5 h-5 animate-spin' />
                                                            Uploading...{" "}
                                                            {Math.round(
                                                                uploadProgress
                                                            )}
                                                            %
                                                        </>
                                                    ) : (
                                                        <>
                                                            Submit Payment &amp;
                                                            Upgrade
                                                            <ChevronRight className='w-5 h-5' />
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </motion.div>
        </div>
    )
}
