"use client"

import { useState } from "react"
import {
    Award,
    Coffee,
    CheckCircle,
    AlertCircle,
    Loader2,
    ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import {
    claimSupporterStatus,
    ClaimResult,
} from "@/app/api/actions/claim-supporter"

export default function ClaimSupporter() {
    const [email, setEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState<ClaimResult | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return

        setIsSubmitting(true)
        setResult(null)

        try {
            const res = await claimSupporterStatus(email)
            setResult(res)
        } catch {
            setResult({
                success: false,
                error: "Something went wrong. Please try again.",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className='min-h-screen bg-background py-12 px-6'>
            <div className='max-w-md mx-auto'>
                {/* Back link */}
                <Link
                    href='/donate'
                    className='inline-flex items-center gap-2 text-text/60 hover:text-text mb-8 transition-colors'
                >
                    <ArrowLeft className='w-4 h-4' />
                    Back to Donate
                </Link>

                {/* Header */}
                <div className='text-center mb-8'>
                    <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4'>
                        <Award className='w-8 h-8 text-primary' />
                    </div>
                    <h1 className='font-serif text-3xl font-bold text-text mb-2'>
                        Claim Supporter Badge
                    </h1>
                    <p className='text-text/70'>
                        Already donated on Ko-fi? Link your donation to receive
                        your badge.
                    </p>
                </div>

                {/* Success State */}
                {result?.success && (
                    <div className='bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center mb-6'>
                        <CheckCircle className='w-12 h-12 text-green-500 mx-auto mb-3' />
                        <h2 className='font-semibold text-text text-lg mb-2'>
                            {result.alreadySupporter
                                ? "You're already a supporter!"
                                : "Badge Claimed Successfully!"}
                        </h2>
                        <p className='text-text/70 text-sm mb-4'>
                            {result.alreadySupporter
                                ? "Your profile already shows the Grounds Supporter badge."
                                : "Thank you for your support! Your badge is now visible on your profile."}
                        </p>
                        <Link
                            href='/profile'
                            className='inline-flex items-center gap-2 bg-primary text-background font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors'
                        >
                            View Your Profile
                        </Link>
                    </div>
                )}

                {/* Error State */}
                {result && !result.success && (
                    <div className='bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6'>
                        <div className='flex items-start gap-3'>
                            <AlertCircle className='w-5 h-5 text-red-500 mt-0.5 shrink-0' />
                            <p className='text-text/80 text-sm'>
                                {result.error}
                            </p>
                        </div>
                    </div>
                )}

                {/* Form */}
                {!result?.success && (
                    <form
                        onSubmit={handleSubmit}
                        className='space-y-4'
                    >
                        <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                            <label className='block text-sm font-medium text-text mb-2'>
                                Ko-fi Email Address
                            </label>
                            <input
                                type='email'
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder='your-kofi-email@example.com'
                                className='w-full px-4 py-3 bg-background border border-text/20 rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary'
                                required
                            />
                            <p className='text-text/50 text-xs mt-2'>
                                Enter the email you used when donating on Ko-fi
                            </p>
                        </div>

                        <button
                            type='submit'
                            disabled={isSubmitting || !email.trim()}
                            className='w-full flex items-center justify-center gap-2 bg-[#FF5E5B] hover:bg-[#FF5E5B]/90 disabled:bg-text/20 text-white disabled:text-text/40 font-semibold px-5 py-3 rounded-lg transition-colors'
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className='w-5 h-5 animate-spin' />
                                    Checking...
                                </>
                            ) : (
                                <>
                                    <Coffee className='w-5 h-5' />
                                    Claim My Badge
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* Info */}
                <div className='mt-8 text-center'>
                    <p className='text-text/50 text-xs'>
                        Haven&apos;t donated yet?{" "}
                        <Link
                            href='/donate'
                            className='text-primary hover:underline'
                        >
                            Support Grounds on Ko-fi
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    )
}
