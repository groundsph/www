import Link from "next/link"
import { Check, ChevronDown, Coffee, MapPin, Store } from "lucide-react"
import {
    BENEFIT_GROUPS,
    CLAIM_STEPS,
    CLAIM_STEPS_HEADING,
    CLOSING,
    CONTACT_CTA,
    FAQ_HEADING,
    FAQ_ITEMS,
    FREE_PILLARS,
    FREE_PILLARS_HEADING,
    FREE_PILLARS_NOTE,
    HERO,
    INCLUDED_FEATURES,
    INCLUDED_HEADING,
    PRIMARY_CTA,
    SECONDARY_CTA,
} from "@/components/owner/owner-benefits-content"

export default function OwnerBenefits() {
    return (
        <main className='w-full min-h-screen bg-background'>
            {/* Hero */}
            <section className='relative bg-linear-to-br from-primary/10 via-secondary/5 to-tertiary/10 py-20 overflow-hidden'>
                <div
                    className='absolute inset-0 pointer-events-none select-none overflow-hidden'
                    aria-hidden='true'
                >
                    <Coffee className='absolute -top-6 -right-6 w-48 h-48 text-primary opacity-5 rotate-12' />
                    <Store className='absolute -bottom-12 -left-12 w-64 h-64 text-accent opacity-5 -rotate-12' />
                    <div className='absolute top-1/4 right-1/4 w-32 h-32 bg-accent/5 rounded-full blur-3xl' />
                </div>

                <div className='max-w-7xl mx-auto px-4 relative z-10'>
                    <span className='inline-block px-3 py-1 mb-4 bg-background/50 backdrop-blur-sm border border-text/5 rounded-full text-xs font-medium text-text/60 uppercase tracking-wider'>
                        {HERO.eyebrow}
                    </span>
                    <h1 className='text-4xl md:text-6xl font-bold font-serif text-text mb-6 tracking-tight max-w-3xl'>
                        {HERO.heading}
                    </h1>
                    <p className='text-lg md:text-xl text-text/70 max-w-2xl leading-relaxed mb-6'>
                        {HERO.lede}
                    </p>
                    <p className='text-sm font-semibold text-primary mb-8'>
                        {HERO.reassurance}
                    </p>

                    <div className='flex flex-col sm:flex-row gap-3'>
                        <Link
                            href={PRIMARY_CTA.href}
                            className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                        >
                            <Store className='w-5 h-5' aria-hidden='true' />
                            {PRIMARY_CTA.label}
                        </Link>
                        <Link
                            href={SECONDARY_CTA.href}
                            className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-text/10 text-text font-semibold rounded-lg hover:bg-text/20 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                        >
                            <MapPin className='w-5 h-5' aria-hidden='true' />
                            {SECONDARY_CTA.label}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Free pillars */}
            <section className='w-full py-16 px-4'>
                <div className='max-w-7xl mx-auto'>
                    <h2 className='text-2xl md:text-3xl font-bold font-serif text-text'>
                        {FREE_PILLARS_HEADING}
                    </h2>

                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8'>
                        {FREE_PILLARS.map((pillar) => {
                            const Icon = pillar.icon
                            return (
                                <div
                                    key={pillar.title}
                                    className='p-5 bg-text/5 border border-text/10 rounded-xl'
                                >
                                    <div className='w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3'>
                                        <Icon
                                            className='w-5 h-5 text-primary'
                                            aria-hidden='true'
                                        />
                                    </div>
                                    <h3 className='font-semibold text-text mb-1'>
                                        {pillar.title}
                                    </h3>
                                    <p className='text-text/60 text-sm leading-relaxed'>
                                        {pillar.description}
                                    </p>
                                </div>
                            )
                        })}
                    </div>

                    <p className='text-text/50 text-sm mt-6 max-w-2xl leading-relaxed'>
                        {FREE_PILLARS_NOTE}
                    </p>
                </div>
            </section>

            {/* Benefit groups */}
            <div className='w-full'>
                {BENEFIT_GROUPS.map((group) => {
                    const GroupIcon = group.icon
                    return (
                        <section
                            key={group.id}
                            id={group.id}
                            className='w-full py-12 px-4'
                        >
                            <div className='max-w-7xl mx-auto'>
                                <div className='flex items-start gap-3 mb-6'>
                                    <div className={`p-2 rounded-xl ${group.accent}`}>
                                        <GroupIcon
                                            className='w-5 h-5'
                                            aria-hidden='true'
                                        />
                                    </div>
                                    <div>
                                        <h2 className='text-2xl font-bold font-serif text-text'>
                                            {group.title}
                                        </h2>
                                        <p className='text-text/60 mt-1 max-w-2xl leading-relaxed'>
                                            {group.intro}
                                        </p>
                                    </div>
                                </div>

                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    {group.items.map((item) => {
                                        const ItemIcon = item.icon
                                        return (
                                            <div
                                                key={item.title}
                                                className='p-5 bg-text/5 border border-text/10 rounded-xl hover:border-text/20 transition-colors'
                                            >
                                                <div className='flex items-start gap-4'>
                                                    <div className='p-2 bg-background rounded-lg text-primary shrink-0'>
                                                        <ItemIcon
                                                            className='w-5 h-5'
                                                            aria-hidden='true'
                                                        />
                                                    </div>
                                                    <div>
                                                        <h3 className='font-semibold text-text mb-1'>
                                                            {item.title}
                                                        </h3>
                                                        <p className='text-text/60 text-sm leading-relaxed'>
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </section>
                    )
                })}
            </div>

            {/* How claiming works */}
            <section className='w-full bg-text/5 py-16 px-4'>
                <div className='max-w-3xl mx-auto'>
                    <h2 className='text-2xl md:text-3xl font-bold font-serif text-text mb-8'>
                        {CLAIM_STEPS_HEADING}
                    </h2>

                    <ol className='flex flex-col gap-6'>
                        {CLAIM_STEPS.map((step, index) => (
                            <li
                                key={step.title}
                                className='flex items-start gap-4'
                            >
                                <span className='shrink-0 w-8 h-8 rounded-full bg-primary text-background text-sm font-bold flex items-center justify-center'>
                                    {index + 1}
                                </span>
                                <div>
                                    <h3 className='font-semibold text-text mb-1'>
                                        {step.title}
                                    </h3>
                                    <p className='text-text/60 text-sm leading-relaxed'>
                                        {step.description}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* Included from day one */}
            <section className='w-full py-16 px-4'>
                <div className='max-w-7xl mx-auto'>
                    <h2 className='text-2xl md:text-3xl font-bold font-serif text-text mb-8'>
                        {INCLUDED_HEADING}
                    </h2>

                    <ul className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        {INCLUDED_FEATURES.map((feature) => (
                            <li
                                key={feature}
                                className='flex items-start gap-3 p-4 bg-text/5 border border-text/10 rounded-xl text-text/70'
                            >
                                <Check
                                    className='w-5 h-5 text-primary shrink-0 mt-0.5'
                                    aria-hidden='true'
                                />
                                <span className='text-sm leading-relaxed'>
                                    {feature}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* FAQ */}
            <section className='w-full bg-text/5 py-16 px-4'>
                <div className='max-w-3xl mx-auto'>
                    <h2 className='text-2xl md:text-3xl font-bold font-serif text-text mb-8'>
                        {FAQ_HEADING}
                    </h2>

                    <div className='divide-y divide-text/10 border-y border-text/10'>
                        {FAQ_ITEMS.map((faq) => (
                            <details key={faq.question} className='group py-4'>
                                <summary className='flex items-center justify-between gap-4 list-none font-semibold text-text'>
                                    <span>{faq.question}</span>
                                    <ChevronDown
                                        className='w-5 h-5 text-text/40 shrink-0 transition-transform group-open:rotate-180'
                                        aria-hidden='true'
                                    />
                                </summary>
                                <p className='text-text/60 text-sm leading-relaxed mt-3'>
                                    {faq.answer}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Closing call to action */}
            <section className='w-full bg-linear-to-br from-secondary via-primary/80 to-secondary py-16 px-6'>
                <div className='max-w-3xl mx-auto text-center'>
                    <h2 className='font-serif text-3xl md:text-4xl font-bold text-background mb-3'>
                        {CLOSING.heading}
                    </h2>
                    <p className='text-background/90 mb-8 max-w-xl mx-auto leading-relaxed'>
                        {CLOSING.body}
                    </p>

                    <div className='flex flex-col sm:flex-row gap-3 justify-center'>
                        <Link
                            href={PRIMARY_CTA.href}
                            className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-background text-primary font-semibold rounded-lg hover:bg-background/90 transition-colors shadow-lg hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background'
                        >
                            <Store className='w-5 h-5' aria-hidden='true' />
                            {PRIMARY_CTA.label}
                        </Link>
                        <Link
                            href={SECONDARY_CTA.href}
                            className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-background/20 text-background font-semibold rounded-lg hover:bg-background/30 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background'
                        >
                            <MapPin className='w-5 h-5' aria-hidden='true' />
                            {SECONDARY_CTA.label}
                        </Link>
                    </div>

                    <p className='text-background/70 text-sm mt-6'>
                        Already claimed by someone else?{" "}
                        <Link
                            href={CONTACT_CTA.href}
                            className='underline hover:text-background transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background'
                        >
                            {CONTACT_CTA.label}
                        </Link>{" "}
                        and we will sort it out.
                    </p>
                </div>
            </section>

            {/* Legal footnote */}
            <footer className='w-full py-8 px-4'>
                <p className='max-w-7xl mx-auto text-text/50 text-xs leading-relaxed'>
                    Claiming a cafe is subject to our{" "}
                    <Link
                        href='/legal/terms'
                        className='text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                    >
                        Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link
                        href='/legal/content-policy'
                        className='text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                    >
                        Content Policy
                    </Link>
                    .
                </p>
            </footer>
        </main>
    )
}
