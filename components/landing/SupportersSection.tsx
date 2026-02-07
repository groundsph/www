"use client"

import { Sparkles, Check, Star, Award, Clock } from "lucide-react"

interface SupportersSectionProps {
    isSupporter: boolean
    isLoggedIn: boolean
}

const PERKS = [
    { icon: Award, text: "Exclusive Supporter Badge" },
    { icon: Star, text: "Profile Flair & Recognition" },
    { icon: Check, text: "Supporter Tag on Reviews" },
]

export default function SupportersSection({
    isSupporter,
}: SupportersSectionProps) {
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
                </div>
            ) : (
                <div className='bg-text/5 border border-text/10 rounded-lg p-4 text-center'>
                    <div className='flex items-center justify-center gap-2 text-text/50 mb-2'>
                        <Clock className='w-5 h-5' />
                        <span className='font-semibold'>Coming Soon</span>
                    </div>
                    <p className='text-sm text-text/50'>
                        We&apos;re setting up our new payment system. Check back
                        soon!
                    </p>
                </div>
            )}
        </div>
    )
}
