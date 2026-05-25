import { Metadata } from "next"
import { Suspense } from "react"
import CommunityPage from "@/components/community/CommunityPage"
import { getFeaturedPosts, getPublishedBlogPosts } from "@/app/api/actions/blog"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    title: "Blog | Grounds PH",
    description: "Latest cafe news, guides, and community stories from Grounds PH.",
    alternates: {
        canonical: "/blog",
    },
    keywords: [
        "cafe blog", "coffee guides", "cafe news Philippines",
        "coffee culture", "Philippines cafe stories",
    ],
    openGraph: {
        title: "Blog | Grounds PH",
        description: "Latest cafe news, guides, and community stories from Grounds PH.",
    },
}

export default async function BlogPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>
}) {
    const params = await searchParams
    const page = parseInt(params.page || "1")

    // Fetch only blog data needed for this page
    let featuredResult: Awaited<ReturnType<typeof getFeaturedPosts>> = []
    let postsResult = { posts: [] as Awaited<ReturnType<typeof getPublishedBlogPosts>>['posts'], total: 0, hasMore: false }

    try {
        const [featuredRes, postsRes] = await Promise.all([
            page === 1 ? getFeaturedPosts(3) : Promise.resolve([]),
            getPublishedBlogPosts({ page, pageSize: 12 }),
        ])
        featuredResult = featuredRes
        postsResult = postsRes
    } catch (error) {
        console.error("Failed to fetch blog data:", error)
    }

    return (
        <Suspense fallback={<BlogPageSkeleton />}>
            <CommunityPage
                initialTab="blogs"
                initialCrawls={[]}
                initialCrawlsTotal={0}
                initialCollections={[]}
                initialCollectionsTotal={0}
                initialEvents={[]}
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
