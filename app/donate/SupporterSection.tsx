"use client"

import { useState } from "react"
import {
    Sparkles,
    Check,
    CreditCard,
    Star,
    Award,
    Loader2,
    ExternalLink,
} from "lucide-react"

interface SupporterSectionProps {
    isSupporter: boolean
    isLoggedIn: boolean
}

const PERKS = [
    { icon: Award, text: "Exclusive Supporter Badge" },
    { icon: Star, text: "Profile Flair & Recognition" },
    { icon: Check, text: "Supporter Tag on Reviews" },
]

export default function SupporterSection({
    isSupporter,
    isLoggedIn,
}: SupporterSectionProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isPortalLoading, setIsPortalLoading] = useState(false)

    const handleBecomeSupporter = async () => {
        setIsLoading(true)
        try {
            const response = await fetch("/api/polar/checkout", {
                method: "POST",
            })
            const data = await response.json()

            if (data.url) {
                window.location.href = data.url
            } else {
                console.error("No checkout URL received")
            }
        } catch (error) {
            console.error("Failed to start checkout:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleManageSubscription = async () => {
        setIsPortalLoading(true)
        try {
            const response = await fetch("/api/polar/portal", {
                method: "POST",
            })
            const data = await response.json()

            if (data.url) {
                window.open(data.url, "_blank")
            } else {
                console.error("No portal URL received")
            }
        } catch (error) {
            console.error("Failed to open portal:", error)
        } finally {
            setIsPortalLoading(false)
        }
    }

    return (
        <div className='bg-linear-to-br from-purple-500/10 via-primary/5 to-purple-500/10 border border-purple-500/20 rounded-xl p-6'>
            <div className='flex items-center gap-3 mb-4'>
                <div className='w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center'>
                    <Sparkles className='w-5 h-5 text-purple-500' />
                </div>
                <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                        <h2 className='font-serif text-xl font-semibold text-text'>
                            Become a Supporter
                        </h2>
                        {isSupporter && (
                            <span className='text-xs bg-purple-500/20 text-purple-600 px-2 py-0.5 rounded-full font-medium'>
                                Active
                            </span>
                        )}
                    </div>
                    <p className='text-text/60 text-sm'>
                        Monthly subscription to support development
                    </p>
                </div>
            </div>

            {/* Perks List */}
            <div className='mb-6 space-y-2'>
                {PERKS.map((perk, i) => (
                    <div
                        key={i}
                        className='flex items-center gap-2 text-text/70'
                    >
                        <perk.icon className='w-4 h-4 text-purple-500' />
                        <span className='text-sm'>{perk.text}</span>
                    </div>
                ))}
            </div>

            {isSupporter ? (
                <div className='space-y-3'>
                    <div className='bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 text-center'>
                        <div className='flex items-center justify-center gap-2 text-purple-600 mb-1'>
                            <Check className='w-5 h-5' />
                            <span className='font-semibold'>
                                Thank you for your support!
                            </span>
                        </div>
                        <p className='text-sm text-text/60'>
                            You&apos;re helping keep Grounds running ☕
                        </p>
                    </div>
                    <button
                        onClick={handleManageSubscription}
                        disabled={isPortalLoading}
                        className='w-full flex items-center justify-center gap-2 bg-text/5 hover:bg-text/10 text-text/70 font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50'
                    >
                        {isPortalLoading ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                            <>
                                <ExternalLink className='w-4 h-4' />
                                Manage Subscription
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleBecomeSupporter}
                    disabled={isLoading || !isLoggedIn}
                    className='w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                    {isLoading ? (
                        <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                        <>
                            <CreditCard className='w-4 h-4' />
                            {isLoggedIn
                                ? "Become a Supporter"
                                : "Sign in to Subscribe"}
                        </>
                    )}
                </button>
            )}

            {!isLoggedIn && !isSupporter && (
                <p className='text-xs text-text/50 text-center mt-2'>
                    You need to be signed in to subscribe
                </p>
            )}
        </div>
    )
}
