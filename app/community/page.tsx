import { Metadata } from "next"
import { Suspense } from "react"
import CommunityPage from "@/components/community/CommunityPage"
import {
    getPublicCollections,
    getFeaturedUsers,
    getPublicCafeCrawls,
} from "@/app/api/actions/community"
import { getUpcomingEvents } from "@/app/api/actions/events"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    title: "Community",
    description:
        "Discover curated cafe collections, connect with coffee enthusiasts, and find upcoming events across the Philippines.",
    openGraph: {
        title: "Community | Grounds",
        description:
            "Explore collections, meet fellow coffee lovers, and discover events near you.",
    },
}

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>
}) {
    const params = await searchParams
    const initialTab = params.tab || "crawls"

    // Fetch initial data for all tabs in parallel
    const [crawlsData, collectionsData, eventsData, featuredUsers] = await Promise.all([
        getPublicCafeCrawls(1, 12, "recent"),
        getPublicCollections(1, 12, "recent"),
        getUpcomingEvents(12),
        getFeaturedUsers(8),
    ])

    return (
        <Suspense fallback={<CommunityPageSkeleton />}>
            <CommunityPage
                initialTab={initialTab}
                initialCrawls={crawlsData.crawls}
                initialCrawlsTotal={crawlsData.total}
                initialCollections={collectionsData.collections}
                initialCollectionsTotal={collectionsData.total}
                initialEvents={eventsData}
                initialFeaturedUsers={featuredUsers}
            />
        </Suspense>
    )
}

function CommunityPageSkeleton() {
    return (
        <div className='min-h-screen w-full bg-background animate-pulse'>
            <div className='max-w-7xl mx-auto px-6 py-8'>
                <div className='h-12 w-64 bg-secondary/20 rounded-lg mb-8' />
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className='h-48 bg-secondary/20 rounded-xl'
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
