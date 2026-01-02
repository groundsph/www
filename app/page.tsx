import {
    getDailyFeatured,
    getAllCafes,
    getPublishedCafeCount,
} from "@/app/api/actions/cafe"
import { getUpcomingEvents } from "@/app/api/actions/events"
import { getPublishedBlogPosts } from "@/app/api/actions/blog"
import LandingHero from "@/components/LandingHero"
import RecentlyAddedSection from "@/components/RecentlyAddedSection"
import SubmitCafeSection from "@/components/SubmitCafeSection"
import StoriesEventsSection from "@/components/StoriesEventsSection"
import { CafeWithRatings } from "@/utils/types/extra"

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

            <SubmitCafeSection cafeCount={cafeCount} />

            {/* Recently Added */}
            <RecentlyAddedSection cafes={recentlyAdded} />

            {/* Stories & Events Section - Side by Side */}
            <StoriesEventsSection
                latestPosts={latestPosts}
                upcomingEvents={upcomingEvents}
            />

            {/* Supporters Section */}
            {/* <SupportersSection /> */}
        </>
    )
}
