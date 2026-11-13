import Link from "next/link"
import { Check, ChevronDown, Coffee, MapPin, Store } from "lucide-react"
import { BenefitPreview, HeroScreen } from "@/components/owner/OwnerScreenPreview"
import { cn } from "@/utils/cn"
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

/**
 * Splits an inclusion line on its em dash so the key part can lead and the
 * detail can sit under it in a lighter weight. The rendered text is identical
 * to the source string, which keeps the copy greppable and the reading order
 * intact.
 */
function InclusionLine({ text }: { text: string }) {
    const [lead, ...detail] = text.split(" — ")

    return (
        <span className='text-[13px] leading-relaxed'>
            <span className='block font-semibold text-text'>{lead} —</span>{" "}
            <span className='block text-text/55'>{detail.join(" — ")}</span>
        </span>
    )
}

export default function OwnerBenefits() {
    return (
        <main className='w-full min-h-screen bg-background'>
            {/* Hero */}
            <section className='relative bg-linear-to-br from-primary/10 via-secondary/5 to-tertiary/10 py-16 md:py-20 overflow-hidden'>
                <div
                    className='absolute inset-0 pointer-events-none select-none overflow-hidden'
                    aria-hidden='true'
                >
                    <Coffee className='absolute -top-6 -right-6 w-48 h-48 text-primary opacity-5 rotate-12' />
                    <Store className='absolute -bottom-12 -left-12 w-64 h-64 text-accent opacity-5 -rotate-12' />
                    <div className='absolute top-1/4 right-1/4 w-32 h-32 bg-accent/5 rounded-full blur-3xl' />
                </div>

                <div className='max-w-7xl mx-auto px-4 relative z-10'>
                    <div className='grid items-center gap-12 lg:grid-cols-2 lg:gap-16'>
                        <div>
                            <span className='inline-block px-3 py-1 mb-4 bg-background/50 backdrop-blur-sm border border-text/5 rounded-full text-xs font-medium text-text/60 uppercase tracking-wider'>
                                {HERO.eyebrow}
                            </span>
                            <h1 className='text-4xl md:text-6xl font-bold font-serif text-text mb-6 tracking-tight'>
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
                                    <Store
                                        className='w-5 h-5'
                                        aria-hidden='true'
                                    />
                                    {PRIMARY_CTA.label}
                                </Link>
                                <Link
                                    href={SECONDARY_CTA.href}
                                    className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-text/10 text-text font-semibold rounded-lg hover:bg-text/20 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                                >
                                    <MapPin
                                        className='w-5 h-5'
                                        aria-hidden='true'
                                    />
                                    {SECONDARY_CTA.label}
                                </Link>
                            </div>
                        </div>

                        <div className='relative'>
                            <p className='sr-only'>
                                A preview of a claimed cafe page on Grounds,
                                with its rating, amenities, menu and a live
                                discount campaign.
                            </p>
                            <div aria-hidden='true'>
                                <HeroScreen />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Free pillars */}
            <section className='w-full py-16 px-4'>
                <div className='max-w-7xl mx-auto'>
                    <h2 className='text-2xl md:text-3xl font-bold font-serif text-text'>
                        {FREE_PILLARS_HEADING}
                    </h2>
                    <p className='text-text/60 mt-2 max-w-2xl leading-relaxed'>
                        Nothing to buy, nothing to unlock, nothing taken.
                    </p>

                    <div className='mt-8 grid grid-cols-1 gap-6 rounded-2xl bg-text/5 px-6 py-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-text/10'>
                        {FREE_PILLARS.map((pillar, index) => {
                            const Icon = pillar.icon
                            return (
                                <div
                                    key={pillar.title}
                                    className={cn(
                                        "lg:px-6",
                                        index === 0 && "lg:pl-0",
                                        index === FREE_PILLARS.length - 1 &&
                                            "lg:pr-0"
                                    )}
                                >
                                    <div className='flex items-center gap-2.5'>
                                        <div className='w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0'>
                                            <Icon
                                                className='w-4 h-4 text-primary'
                                                aria-hidden='true'
                                            />
                                        </div>
                                        <h3 className='font-semibold text-text'>
                                            {pillar.title}
                                        </h3>
                                    </div>
                                    <p className='mt-3 text-sm font-semibold text-primary'>
                                        {pillar.highlight}
                                    </p>
                                    <p className='mt-1 text-[13px] text-text/60 leading-relaxed'>
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
                {BENEFIT_GROUPS.map((group, groupIndex) => {
                    const GroupIcon = group.icon
                    const isPreviewFirst = groupIndex % 2 === 1

                    return (
                        <section
                            key={group.id}
                            id={group.id}
                            className='w-full py-12 px-4'
                        >
                            <div className='max-w-7xl mx-auto'>
                                <div className='flex items-start gap-3 mb-6'>
                                    <div
                                        className={`p-2 rounded-xl ${group.accent}`}
                                    >
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

                                <div className='grid gap-6 lg:grid-cols-5 lg:items-start'>
                                    <div
                                        className={cn(
                                            "min-w-0 lg:col-span-2",
                                            isPreviewFirst
                                                ? "lg:order-1"
                                                : "lg:order-2"
                                        )}
                                    >
                                        <div className='lg:sticky lg:top-24'>
                                            <p className='sr-only'>
                                                A preview of the Grounds owner
                                                dashboard for{" "}
                                                {group.title.toLowerCase()}.
                                            </p>
                                            <BenefitPreview
                                                groupId={group.id}
                                            />
                                        </div>
                                    </div>

                                    <div
                                        className={cn(
                                            "grid min-w-0 grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2 lg:col-span-3",
                                            isPreviewFirst
                                                ? "lg:order-2"
                                                : "lg:order-1"
                                        )}
                                    >
                                        {group.items.map((item) => {
                                            const ItemIcon = item.icon
                                            return (
                                                <div
                                                    key={item.title}
                                                    className='border-t border-text/10 pt-5'
                                                >
                                                    <div className='flex items-center gap-3'>
                                                        <ItemIcon
                                                            className='w-5 h-5 shrink-0 text-primary'
                                                            aria-hidden='true'
                                                        />
                                                        <h3 className='font-semibold text-text leading-snug'>
                                                            {item.title}
                                                        </h3>
                                                    </div>
                                                    <p className='mt-3 text-[13px] font-semibold text-primary'>
                                                        {item.highlight}
                                                    </p>
                                                    <p className='mt-1 text-[13px] text-text/60 leading-relaxed'>
                                                        {item.description}
                                                    </p>
                                                </div>
                                            )
                                        })}
                                    </div>
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
                                    <h3 className='font-semibold text-text'>
                                        {step.title}
                                    </h3>
                                    <p className='mt-2 text-sm font-semibold text-primary'>
                                        {step.highlight}
                                    </p>
                                    <p className='mt-1 text-[13px] text-text/60 leading-relaxed'>
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

                    <ul className='grid grid-cols-1 gap-x-10 gap-y-4 rounded-2xl bg-text/5 px-6 py-7 md:grid-cols-2'>
                        {INCLUDED_FEATURES.map((feature) => (
                            <li
                                key={feature}
                                className='flex items-start gap-3'
                            >
                                <Check
                                    className='w-4 h-4 text-primary shrink-0 mt-0.5'
                                    aria-hidden='true'
                                />
                                <InclusionLine text={feature} />
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
