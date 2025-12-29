"use client"

import { Heart, ArrowRightIcon, Building2, Users } from "lucide-react"
import Link from "next/link"
import Image, { StaticImageData } from "next/image"
import { motion, useInView } from "motion/react"
import { useRef } from "react"

// =============================================================================
// LOGO DATA - Edit these arrays to add/remove logos
// =============================================================================

import devgoLogo from "@/assets/logos/devgo-logo.png"

// =============================================================================
// SUPPORTER DATA - Edit these arrays to add/remove supporters
// =============================================================================

interface CompanySponsor {
    name: string
    logo: string | StaticImageData // Path to logo image in /public or URL
    url?: string
}

interface IndividualSupporter {
    name: string
    url?: string
}

// Company sponsors with logos
const COMPANY_SPONSORS: CompanySponsor[] = [
    // Example:
    // { name: "Acme Coffee Co.", logo: "/sponsors/acme.png", url: "https://acme.com" },
    // { name: "DEVGO Studio", logo: devgoLogo, url: "https://devgo.studio" },
]

// Individual supporters (names only)
const INDIVIDUAL_SUPPORTERS: IndividualSupporter[] = [
    // Example:
    // { name: "Juan Dela Cruz", url: "https://twitter.com/juandelacruz" },
    // { name: "Maria Santos" },
]

// =============================================================================
// COMPONENT
// =============================================================================

export default function SupportersSection() {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })

    const hasCompanySponsors = COMPANY_SPONSORS.length > 0
    const hasIndividualSupporters = INDIVIDUAL_SUPPORTERS.length > 0
    const hasSupporters = hasCompanySponsors || hasIndividualSupporters

    return (
        <section
            ref={ref}
            className='w-full flex flex-col gap-8 mb-8'
        >
            {/* Support Banner */}
            <div className='w-full bg-linear-to-br from-primary/90 via-secondary to-primary/80 py-12 px-6 flex flex-col items-center justify-center gap-4 relative overflow-hidden'>
                {/* Background decoration */}
                <Heart className='absolute h-[200%] aspect-square w-auto text-background opacity-5 -right-1/4 -top-1/2 rotate-12' />
                <Heart className='absolute h-32 w-32 text-background opacity-10 left-8 bottom-4 -rotate-12' />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5 }}
                    className='text-center z-10'
                >
                    <h2 className='font-serif text-3xl md:text-4xl font-bold text-background mb-3'>
                        Support Grounds
                    </h2>
                    <p className='text-background/90 max-w-md mx-auto mb-6'>
                        Grounds is a community-driven platform funded entirely
                        by supporters like you. Help us keep the coffee flowing!
                    </p>
                    <div className='flex flex-col sm:flex-row items-center justify-center gap-3'>
                        <Link
                            href='/donate'
                            className='px-6 py-3 bg-background text-primary font-semibold rounded-xl hover:bg-background/90 transition-colors shadow-lg flex items-center gap-2'
                        >
                            <Heart className='w-5 h-5' />
                            Donate Now
                        </Link>
                        <Link
                            href='/contact'
                            className='px-6 py-3 bg-transparent border-2 border-background/80 text-background font-semibold rounded-xl hover:bg-background/10 transition-colors flex items-center gap-2'
                        >
                            Become a Sponsor
                            <ArrowRightIcon className='w-4 h-4' />
                        </Link>
                    </div>
                </motion.div>
            </div>

            {/* Supporters List */}
            {hasSupporters && (
                <div className='px-6 max-w-4xl mx-auto w-full'>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className='text-center mb-8'
                    >
                        <h3 className='font-serif text-2xl font-semibold text-text mb-2'>
                            Our Supporters
                        </h3>
                        <p className='text-text/60 text-sm'>
                            Thank you to everyone who helps keep Grounds running
                            ☕
                        </p>
                    </motion.div>

                    {/* Company Sponsors */}
                    {hasCompanySponsors && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className='mb-8'
                        >
                            <div className='flex items-center gap-2 mb-4'>
                                <Building2 className='w-4 h-4 text-primary' />
                                <span className='text-sm font-medium text-text/70 uppercase tracking-wide'>
                                    Company Sponsors
                                </span>
                            </div>
                            <div className='flex flex-wrap items-center justify-center gap-6 bg-text/5 border border-text/10 rounded-2xl p-6'>
                                {COMPANY_SPONSORS.map((sponsor, idx) => (
                                    <motion.div
                                        key={sponsor.name}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={
                                            isInView
                                                ? { opacity: 1, scale: 1 }
                                                : {}
                                        }
                                        transition={{
                                            duration: 0.3,
                                            delay: 0.4 + idx * 0.1,
                                        }}
                                    >
                                        {sponsor.url ? (
                                            <a
                                                href={sponsor.url}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className='block grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all'
                                                title={sponsor.name}
                                            >
                                                <Image
                                                    src={sponsor.logo}
                                                    alt={sponsor.name}
                                                    width={120}
                                                    height={48}
                                                    className='h-12 w-auto object-contain'
                                                />
                                            </a>
                                        ) : (
                                            <div
                                                className='grayscale opacity-70'
                                                title={sponsor.name}
                                            >
                                                <Image
                                                    src={sponsor.logo}
                                                    alt={sponsor.name}
                                                    width={120}
                                                    height={48}
                                                    className='h-12 w-auto object-contain'
                                                />
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Individual Supporters */}
                    {hasIndividualSupporters && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.5, delay: 0.4 }}
                        >
                            <div className='flex items-center gap-2 mb-4'>
                                <Users className='w-4 h-4 text-primary' />
                                <span className='text-sm font-medium text-text/70 uppercase tracking-wide'>
                                    Individual Supporters
                                </span>
                            </div>
                            <div className='bg-text/5 border border-text/10 rounded-2xl p-6'>
                                <div className='flex flex-wrap items-center justify-center gap-x-3 gap-y-2'>
                                    {INDIVIDUAL_SUPPORTERS.map(
                                        (supporter, idx) => (
                                            <span
                                                key={supporter.name}
                                                className='inline-flex items-center'
                                            >
                                                {supporter.url ? (
                                                    <a
                                                        href={supporter.url}
                                                        target='_blank'
                                                        rel='noopener noreferrer'
                                                        className='text-text/80 hover:text-primary transition-colors'
                                                    >
                                                        {supporter.name}
                                                    </a>
                                                ) : (
                                                    <span className='text-text/80'>
                                                        {supporter.name}
                                                    </span>
                                                )}
                                                {idx <
                                                    INDIVIDUAL_SUPPORTERS.length -
                                                        1 && (
                                                    <span className='text-text/30 ml-3'>
                                                        •
                                                    </span>
                                                )}
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            {/* No supporters yet - show placeholder */}
            {!hasSupporters && (
                <div className='px-6 max-w-4xl mx-auto w-full'>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className='bg-text/5 border border-text/10 rounded-2xl p-8 text-center'
                    >
                        <Heart className='w-10 h-10 text-primary/30 mx-auto mb-3' />
                        <h3 className='font-serif text-xl font-semibold text-text mb-2'>
                            Be Our First Supporter
                        </h3>
                        <p className='text-text/60 text-sm max-w-md mx-auto mb-4'>
                            Your name or company logo could be here! Supporters
                            help us cover server costs and improve the platform.
                        </p>
                        <Link
                            href='/contact'
                            className='inline-flex items-center gap-2 text-primary font-medium hover:underline'
                        >
                            Get in touch
                            <ArrowRightIcon className='w-4 h-4' />
                        </Link>
                    </motion.div>
                </div>
            )}
        </section>
    )
}
