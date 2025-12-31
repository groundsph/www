import {
    getDailyFeatured,
    getAllCafes,
    getPublishedCafeCount,
} from "@/app/api/actions/cafe"
import { getUpcomingEvents } from "@/app/api/actions/events"
import { getPublishedBlogPosts } from "@/app/api/actions/blog"
import LandingHero from "@/components/LandingHero"
import RecentlyAddedSection from "@/components/RecentlyAddedSection"
import { CafeWithRatings } from "@/utils/types/extra"
import Link from "next/link"
import { MapPinIcon, ArrowRightIcon, Coffee } from "lucide-react"
import { format } from "date-fns"

// Dynamic rendering for Dokploy build compatibility
export const dynamic = "force-dynamic"

export default async function Home() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": "https://grounds.ph/#organization",
                name: "Grounds",
                url: "https://grounds.ph",
                logo: {
                    "@type": "ImageObject",
                    url: "https://grounds.ph/og-image.png",
                },
                description:
                    "Community-driven cafe database featuring the best cafes in Cebu",
                address: {
                    "@type": "PostalAddress",
                    addressLocality: "Cebu",
                    addressRegion: "Cebu",
                    addressCountry: "PH",
                },
            },
            {
                "@type": "WebSite",
                "@id": "https://grounds.ph/#website",
                url: "https://grounds.ph",
                name: "Grounds - Discover Cebu's Best Cafes",
                description: "Discover and explore the best cafes in Cebu",
                publisher: {
                    "@id": "https://grounds.ph/#organization",
                },
                inLanguage: "en-PH",
            },
        ],
    }
    // Fetch data using server actions
    const [featured, recentlyAdded, cafeCount, upcomingEvents, blogResult] =
        await Promise.all([
            getDailyFeatured() as Promise<CafeWithRatings | null>,
            getAllCafes(1, 10, { exclude_hidden_gems: true }) as Promise<
                CafeWithRatings[]
            >,
            getPublishedCafeCount(),
            getUpcomingEvents(5),
            getPublishedBlogPosts({ pageSize: 4 }),
        ])

    const latestPosts = blogResult.posts

    return (
        <>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <LandingHero featured={featured} />

            <section className='w-full bg-linear-to-br from-secondary via-primary/80 to-secondary py-12 px-6 flex flex-col items-center justify-center gap-4 overflow-hidden relative'>
                {/* Background decorations */}
                <MapPinIcon className='absolute h-32 w-32 text-background opacity-10 left-8 bottom-4 -rotate-12' />
                <Coffee className='absolute h-24 w-24 text-background opacity-10 right-12 top-8 rotate-6' />

                {/* Content */}
                <div className='text-center z-10'>
                    <h2 className='font-serif text-3xl md:text-4xl font-bold text-background mb-3'>
                        Found a spot we missed?
                    </h2>
                    <p className='max-w-md mx-auto text-background/90 mb-6'>
                        We currently have{" "}
                        <span className='font-bold text-tertiary'>
                            {cafeCount} cafes
                        </span>{" "}
                        in our catalogue waiting for you to browse. Help the
                        community grow by sharing your favorite spots.
                    </p>
                    <Link
                        href='/submit'
                        className='inline-flex items-center gap-2 px-6 py-3 bg-background text-primary font-semibold rounded-xl hover:bg-background/90 transition-colors shadow-lg'
                    >
                        <MapPinIcon className='w-5 h-5' />
                        Submit a Cafe
                    </Link>
                </div>
            </section>

            {/* Recently Added */}
            <RecentlyAddedSection cafes={recentlyAdded} />

            {/* Stories & Events Section - Side by Side */}
            {(latestPosts.length > 0 || upcomingEvents.length > 0) && (
                <section className='w-full px-6 py-12 mb-8'>
                    <div className='w-full grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16'>
                        {/* Latest Stories - Chapter Style */}
                        {latestPosts.length > 0 && (
                            <div className='flex flex-col'>
                                <div className='flex items-center justify-between mb-2'>
                                    <h2 className='font-semibold font-serif text-2xl'>
                                        Latest Stories
                                    </h2>
                                    <Link
                                        href='/blog'
                                        className='text-primary text-sm font-medium hover:underline flex items-center gap-1'
                                    >
                                        Read more{" "}
                                        <ArrowRightIcon className='w-4 h-4' />
                                    </Link>
                                </div>
                                <div className='flex flex-col gap-4'>
                                    {latestPosts.slice(0, 4).map((post) => (
                                        <Link
                                            key={post.id}
                                            href={`/blog/${post.slug}`}
                                            className='group flex items-start gap-5 hover:opacity-80 transition-all hover:bg-secondary/10 py-2 px-2 rounded-xl'
                                        >
                                            {/* <span className='font-serif text-3xl md:text-4xl font-bold text-text/30 group-hover:text-primary transition-colors min-w-12 text-right'>
                                                    {String(idx + 1).padStart(
                                                        2,
                                                        "0"
                                                    )}
                                                </span> */}
                                            <div className='flex flex-col gap-1 pt-1'>
                                                <span className='font-semibold text-lg md:text-xl group-hover:text-primary transition-colors line-clamp-2'>
                                                    {post.title}
                                                </span>
                                                {post.excerpt && (
                                                    <span className='text-text/50 text-sm line-clamp-2'>
                                                        {post.excerpt}
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Upcoming Events - Chapter Style */}
                        {upcomingEvents.length > 0 && (
                            <div className='flex flex-col'>
                                <div className='flex items-center justify-between mb-2'>
                                    <h2 className='font-semibold font-serif text-2xl'>
                                        Upcoming Events
                                    </h2>
                                    <Link
                                        href='/events'
                                        className='text-primary text-sm font-medium hover:underline flex items-center gap-1'
                                    >
                                        View all{" "}
                                        <ArrowRightIcon className='w-4 h-4' />
                                    </Link>
                                </div>
                                <div className='flex flex-col gap-4'>
                                    {upcomingEvents.slice(0, 4).map((event) => {
                                        const startDate = new Date(
                                            event.start_date
                                        )
                                        return (
                                            <Link
                                                key={event.id}
                                                href='/events'
                                                className='group flex items-start gap-5 hover:opacity-80 transition-all hover:bg-secondary/10 py-2 px-2 rounded-xl'
                                            >
                                                <span className='font-serif text-3xl md:text-4xl font-bold text-text/30 group-hover:text-primary transition-colors min-w-12 text-right'>
                                                    {format(startDate, "dd")}
                                                </span>
                                                <div className='flex flex-col gap-1 pt-1'>
                                                    <span className='font-semibold text-lg md:text-xl group-hover:text-primary transition-colors line-clamp-2'>
                                                        {event.title}
                                                    </span>
                                                    <div className='flex flex-wrap items-center gap-2 text-text/50 text-sm'>
                                                        {event.location_name && (
                                                            <span className='flex items-center gap-1'>
                                                                <MapPinIcon className='w-3 h-3' />
                                                                {
                                                                    event.location_name
                                                                }
                                                            </span>
                                                        )}
                                                        {event.is_national && (
                                                            <span className='bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full'>
                                                                National
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Supporters Section */}
            {/* <SupportersSection /> */}
        </>
    )
}
