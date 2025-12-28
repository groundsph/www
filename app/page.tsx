import "@/app/map.css"
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
import {
    SearchIcon,
    CalendarIcon,
    MapPinIcon,
    ArrowRightIcon,
    Coffee,
} from "lucide-react"
import Image from "next/image"
import { format } from "date-fns"
import { BLOG_CATEGORIES } from "@/utils/types/blog"

// SSR revalidation every hour
export const revalidate = 3600

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
            getAllCafes(1, 10, {}) as Promise<CafeWithRatings[]>,
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

            <section className='w-full min-h-max bg-secondary mb-4 flex flex-col items-center justify-center py-10 gap-4 px-6 overflow-clip relative'>
                {/* BG */}
                <SearchIcon className='absolute h-[140%] aspect-square w-auto text-background opacity-10' />
                {/* Content */}
                <h2 className='font-serif text-3xl md:text-5xl font-semibold z-1 text-center'>
                    Found a spot we missed?
                </h2>
                <p className='max-w-md text-background text-center font-medium z-1'>
                    We currently have{" "}
                    <span className='font-bold text-primary'>
                        {cafeCount} cafes
                    </span>{" "}
                    in our catalogue waiting for you to browse. Help the
                    community grow by sharing your favorite spots.
                </p>
                <Link
                    href='/submit'
                    className='px-4 py-1 w-max bg-text text-background font-serif italic font-semibold rounded-lg transition-colors hover:bg-text/60 relative group shadow-lg text-nowrap text-xl z-1'
                >
                    Submit a Cafe
                </Link>
            </section>

            {/* Recently Added */}
            <RecentlyAddedSection cafes={recentlyAdded} />

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
                <section className='w-full min-h-max flex flex-col'>
                    <div className='flex items-center justify-between px-6'>
                        <h2 className='font-semibold font-serif text-2xl'>
                            Upcoming Events
                        </h2>
                        <Link
                            href='/events'
                            className='text-primary text-sm font-medium hover:underline flex items-center gap-1'
                        >
                            View all <ArrowRightIcon className='w-4 h-4' />
                        </Link>
                    </div>
                    <div className='flex flex-row gap-8 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-4 pb-10 snap-x snap-mandatory scroll-px-4'>
                        {upcomingEvents.map((event, idx) => {
                            const startDate = new Date(event.start_date)
                            return (
                                <Link
                                    key={event.id}
                                    href='/events'
                                    className='min-w-full md:min-w-80 md:w-80 snap-center md:snap-start flex flex-col gap-2 bg-background border-text/10 border shadow-sm rounded-4xl p-4 group hover:border-primary/30 transition-colors'
                                    style={{
                                        animationDelay: `${idx * 100}ms`,
                                    }}
                                >
                                    <div className='relative rounded-3xl overflow-clip w-full h-auto aspect-video select-none bg-secondary/10'>
                                        {event.image_url ? (
                                            <Image
                                                src={event.image_url}
                                                alt={event.title}
                                                fill
                                                className='object-cover'
                                                draggable={false}
                                            />
                                        ) : (
                                            <div className='w-full h-full flex items-center justify-center'>
                                                <CalendarIcon className='w-12 h-12 text-text opacity-20' />
                                            </div>
                                        )}
                                        {/* Date badge */}
                                        <div className='absolute top-3 left-3 flex flex-col items-center bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md'>
                                            <span className='text-xs font-medium text-primary uppercase'>
                                                {format(startDate, "MMM")}
                                            </span>
                                            <span className='text-2xl font-bold text-text'>
                                                {format(startDate, "d")}
                                            </span>
                                        </div>
                                        {event.is_national && (
                                            <div className='absolute top-3 right-3 bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full'>
                                                National
                                            </div>
                                        )}
                                    </div>
                                    <span className='font-semibold text-xl line-clamp-1 group-hover:text-primary transition-colors'>
                                        {event.title}
                                    </span>
                                    {event.location_name && (
                                        <span className='text-text/60 text-sm flex items-center gap-1'>
                                            <MapPinIcon className='w-3 h-3' />
                                            {event.location_name}
                                            {event.city && `, ${event.city}`}
                                        </span>
                                    )}
                                    <div className='flex-1' />
                                    <div className='flex flex-row justify-end items-center gap-2 text-text/60 group-hover:text-primary transition-colors'>
                                        View Details{" "}
                                        <ArrowRightIcon className='w-4 h-4' />
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* Latest Stories */}
            {latestPosts.length > 0 && (
                <section className='w-full min-h-max flex flex-col mb-8'>
                    <div className='flex items-center justify-between px-6'>
                        <h2 className='font-semibold font-serif text-2xl'>
                            Latest Stories
                        </h2>
                        <Link
                            href='/blog'
                            className='text-primary text-sm font-medium hover:underline flex items-center gap-1'
                        >
                            Read more <ArrowRightIcon className='w-4 h-4' />
                        </Link>
                    </div>
                    <div className='flex flex-row gap-8 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-4 pb-10 snap-x snap-mandatory scroll-px-4'>
                        {latestPosts.map((post, idx) => (
                            <Link
                                key={post.id}
                                href={`/blog/${post.slug}`}
                                className='min-w-full md:min-w-80 md:w-80 snap-center md:snap-start flex flex-col gap-2 bg-background border-text/10 border shadow-sm rounded-4xl p-4 group hover:border-primary/30 transition-colors'
                                style={{
                                    animationDelay: `${idx * 100}ms`,
                                }}
                            >
                                <div className='relative rounded-3xl overflow-clip w-full h-auto aspect-video select-none bg-secondary/10'>
                                    {post.cover_image ? (
                                        <Image
                                            src={post.cover_image}
                                            alt={post.title}
                                            fill
                                            className='object-cover'
                                            draggable={false}
                                        />
                                    ) : (
                                        <div className='w-full h-full flex items-center justify-center bg-linear-to-br from-primary/20 to-secondary/20'>
                                            <Coffee className='w-12 h-12 text-primary/40' />
                                        </div>
                                    )}
                                    {/* Category badge */}
                                    <div className='absolute top-3 left-3 bg-primary/90 text-white text-xs font-medium px-2 py-1 rounded-full'>
                                        {
                                            BLOG_CATEGORIES.find(
                                                (c) => c.value === post.category
                                            )?.label
                                        }
                                    </div>
                                </div>
                                <span className='font-semibold text-xl line-clamp-2 group-hover:text-primary transition-colors'>
                                    {post.title}
                                </span>
                                {post.excerpt && (
                                    <span className='text-text/60 text-sm line-clamp-2'>
                                        {post.excerpt}
                                    </span>
                                )}
                                <div className='flex-1' />
                                <div className='flex flex-row justify-end items-center gap-2 text-text/60 group-hover:text-primary transition-colors'>
                                    Read More{" "}
                                    <ArrowRightIcon className='w-4 h-4' />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </>
    )
}
