import { Metadata } from "next"
import { Suspense } from "react"
import CommunityPage from "@/components/community/CommunityPage"
import {
    getPublicCollections,
    getPublicCafeCrawls,
} from "@/app/api/actions/community"
import { getUpcomingEvents } from "@/app/api/actions/events"
import { getFeaturedPosts, getPublishedBlogPosts } from "@/app/api/actions/blog"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    title: "Blog",
    description:
        "Coffee stories, brewing guides, and news from the Philippine coffee community",
    alternates: {
        canonical: "/community?tab=blogs",
    },
}

export default async function BlogPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>
}) {
    const params = await searchParams
    const page = parseInt(params.page || "1")

    // Fetch blog data and other community data
    const [crawlsData, collectionsData, eventsData, featuredResult, postsResult] = await Promise.all([
        getPublicCafeCrawls(1, 12, "recent"),
        getPublicCollections(1, 12, "recent"),
        getUpcomingEvents(12),
        page === 1 ? getFeaturedPosts(3) : Promise.resolve([]),
        getPublishedBlogPosts({ page, pageSize: 12 }),
    ])

    return (
        <Suspense fallback={<BlogPageSkeleton />}>
            <CommunityPage
                initialTab="blogs"
                initialCrawls={crawlsData.crawls}
                initialCrawlsTotal={crawlsData.total}
                initialCollections={collectionsData.collections}
                initialCollectionsTotal={collectionsData.total}
                initialEvents={eventsData}
                initialFeaturedPosts={featuredResult}
                initialPosts={postsResult.posts}
                initialPostsTotal={postsResult.total}
                initialPostsHasMore={postsResult.hasMore}
                initialPostsPage={page}
            />
        </Suspense>
    )
}

function BlogPageSkeleton() {
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
