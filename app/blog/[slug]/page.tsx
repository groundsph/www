import {
    getBlogPostBySlug,
    incrementViewCount,
    getPublishedBlogPosts,
} from "@/app/api/actions/blog"
import { BLOG_CATEGORIES, estimateReadingTime } from "@/utils/types/blog"
import MarkdownRender from "@/components/ui/MarkdownRender"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Calendar, Clock, ArrowLeft, Eye, Coffee, Pencil } from "lucide-react"
import { UserAvatar } from "@/components/ui/UserAvatar"
import ShareButton from "@/components/blog/ShareButton"
import ReportButton from "@/components/blog/ReportButton"
import { getCafesByIds, getCafesBySlugs } from "@/app/api/actions/cafe"
import { getCafeCrawlById } from "@/app/api/actions/cafe-crawls"
import { extractCafeSlugsFromContent } from "@/utils/blog/link-detection"
import { mergeCafeTags } from "@/utils/blog/merge-cafe-tags"
import BlogImageGallery from "@/components/blog/BlogImageGallery"
import BlogCafeHighlights from "@/components/blog/BlogCafeHighlights"
import BlogCrawlEmbed from "@/components/blog/BlogCrawlEmbed"
import { buildPageMetadata } from "@/utils/seo/metadata"
import { getCurrentUser } from "@/lib/auth"

// Dynamic rendering for Dokploy build
export const dynamic = "force-dynamic"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const post = await getBlogPostBySlug(slug)

    if (!post) {
        return {
            title: "Post Not Found",
        }
    }

    const ogImagePath = post.cover_image ? post.cover_image : "/og-image.jpg"
    const isPublished = post.status === "published"

    if (!isPublished) {
        return {
            ...buildPageMetadata({ title: `[Draft] ${post.title}`, description: post.excerpt || post.content.substring(0, 160), urlPath: `/blog/${post.slug}`, ogImagePath }),
            robots: { index: false, follow: false },
        }
    }

    return buildPageMetadata({
        title: post.title,
        description: post.excerpt || post.content.substring(0, 160),
        urlPath: `/blog/${post.slug}`,
        ogImagePath,
    })
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const [post, currentUser] = await Promise.all([
        getBlogPostBySlug(slug),
        getCurrentUser(),
    ])

    if (!post) {
        notFound()
    }

    const isDraft = post.status === "draft"
    const isPending = post.status === "pending"
    const isPublished = post.status === "published"
    const isAuthor = currentUser?.id === post.author_id

    // Skip view count increment for non-published posts
    if (isPublished) {
        incrementViewCount(post.id)
    }

    // Extract cafe slugs from content
    const detectedSlugs = extractCafeSlugsFromContent(post.content)

    // Fetch cafes by detected slugs and explicit tagged IDs in parallel
    const [cafesBySlugs, cafesByIds] = await Promise.all([
        detectedSlugs.length > 0 ? getCafesBySlugs(detectedSlugs) : Promise.resolve([]),
        post.tagged_cafe_ids && post.tagged_cafe_ids.length > 0
            ? getCafesByIds(post.tagged_cafe_ids)
            : Promise.resolve([]),
    ])

    // Merge cafe IDs, dedupe and preserve order
    const explicitIds = post.tagged_cafe_ids || []
    const detectedIds = cafesBySlugs.map((c) => c.id)
    const mergedCafeIds = mergeCafeTags(explicitIds, detectedIds)

    // Build final cafe list preserving merge order
    const cafeMap = new Map<string, typeof cafesByIds[0]>([
        ...cafesByIds.map((c) => [c.id, c] as const),
        ...cafesBySlugs.map((c) => [c.id, c] as const),
    ])
    const mergedCafes = mergedCafeIds
        .map((id) => cafeMap.get(id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined)

    // Fetch crawl if linked
    const crawl = post.crawl_id
        ? await getCafeCrawlById(post.crawl_id)
        : null

    // Get related posts (same category, excluding current)
    const { posts: relatedPosts } = await getPublishedBlogPosts({
        category: post.category,
        pageSize: 5,
    })
    const filteredRelated = relatedPosts
        .filter((p) => p.id !== post.id)
        .slice(0, 3)

    const readingTime = estimateReadingTime(post.content)
    const categoryInfo = BLOG_CATEGORIES.find((c) => c.value === post.category)

    return (
        <main className='w-full min-h-screen bg-background [&_button]:cursor-pointer'>
            {/* Draft Banner */}
            {(isDraft || isPending) && (
                <div className='sticky top-0 z-30 bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-4'>
                    <span>
                        {isDraft ? "Draft Preview" : "Pending Review"} — {isDraft ? "Not visible to the public" : "Awaiting approval"}
                    </span>
                    {isAuthor && isDraft && (
                        <Link
                            href={`/blog/edit/${post.id}`}
                            className='inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors text-xs'
                        >
                            <Pencil className='w-3 h-3' />
                            Edit Draft
                        </Link>
                    )}
                </div>
            )}

            {/* Cover Image Section */}
            {post.cover_image && (
                <div className='relative w-full aspect-21/9 md:aspect-3/1 bg-text/5'>
                    <Image
                        src={post.cover_image}
                        alt={post.title}
                        fill
                        priority
                        className='object-cover'
                    />
                </div>
            )}
            <article className='max-w-6xl mx-auto px-4 py-8 md:py-12'>
                {/* Back Link */}
                <Link
                    href='/blog'
                    className='inline-flex items-center gap-2 text-text/60 hover:text-primary transition-colors mb-8'
                >
                    <ArrowLeft className='w-4 h-4' />
                    <span className='text-sm font-medium'>Back to Blog</span>
                </Link>

                {/* Header */}
                <header className='mb-8'>
                    {/* Cafe Badge */}
                    {post.cafe && (
                        <Link
                            href={`/cafes/${post.cafe.slug}`}
                            className='inline-flex items-center gap-2 px-3 py-1.5 bg-secondary/20 text-secondary rounded-lg mb-4 hover:bg-secondary/30 transition-colors'
                        >
                            <Coffee className='w-4 h-4' />
                            <span className='text-sm font-medium'>
                                {post.cafe.name}
                            </span>
                        </Link>
                    )}

                    {/* Category & Reading Time */}
                    <div className='flex items-center gap-3 mb-4'>
                        <span className='px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full'>
                            {categoryInfo?.label}
                        </span>
                        <div className='flex items-center gap-1.5 text-text/50 text-sm'>
                            <Clock className='w-4 h-4' />
                            <span>{readingTime} min read</span>
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className='text-3xl md:text-4xl lg:text-5xl font-bold font-serif text-text mb-6 leading-tight'>
                        {post.title}
                    </h1>

                    {/* Excerpt */}
                    {post.excerpt && (
                        <p className='text-lg text-text/70 leading-relaxed mb-6'>
                            {post.excerpt}
                        </p>
                    )}

                    {/* Author & Meta */}
                    <div className='flex items-center justify-between flex-wrap gap-4 py-4 border-y border-text/10'>
                        <div className='flex items-center gap-4'>
                            {post.author && (
                                <Link
                                    href={`/profile/${post.author.username}`}
                                    className='flex items-center gap-3 hover:opacity-80 transition-opacity'
                                >
                                    <UserAvatar
                                        src={post.author.avatar_url}
                                        alt={post.author.display_name}
                                        size={44}
                                    />
                                    <div>
                                        <p className='font-medium text-text'>
                                            {post.author.display_name}
                                        </p>
                                        <p className='text-sm text-text/50'>
                                            @{post.author.username}
                                        </p>
                                    </div>
                                </Link>
                            )}
                        </div>
                        <div className='flex items-center gap-4 text-sm text-text/50'>
                            {post.published_at && (
                                <div className='flex items-center gap-1.5'>
                                    <Calendar className='w-4 h-4' />
                                    <span>
                                        {new Date(
                                            post.published_at
                                        ).toLocaleDateString("en-US", {
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </span>
                                </div>
                            )}
                            {isPublished && (
                                <div className='flex items-center gap-1.5'>
                                    <Eye className='w-4 h-4' />
                                    <span>{post.views_count || 0} views</span>
                                </div>
                            )}
                            <div className='border-l border-text/10 pl-4 ml-2'>
                                <ReportButton
                                    postId={post.id}
                                    className='text-xs px-2 py-1'
                                />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Gallery */}
                {post.images && post.images.length > 0 && (
                    <BlogImageGallery images={post.images} />
                )}

                {/* Content */}
                <div className='prose prose-lg prose-stone max-w-none mb-12'>
                    <MarkdownRender content={post.content} />
                </div>

                {/* Cafe Highlights */}
                {mergedCafes.length > 0 && <BlogCafeHighlights cafes={mergedCafes} />}

                {/* Crawl Embed */}
                {crawl && <BlogCrawlEmbed crawl={crawl} />}

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                    <div className='flex flex-wrap gap-2 mb-12'>
                        {post.tags.map((tag) => (
                            <span
                                key={tag}
                                className='px-3 py-1 bg-text/5 text-text/70 text-sm rounded-full'
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                {isPublished && (
                    <div className='flex items-center justify-center gap-4 py-8 border-y border-text/10 mb-12'>
                        <span className='text-text/60 text-sm'>
                            Share this article
                        </span>
                        <ShareButton title={post.title} />
                    </div>
                )}

                {/* Related Posts */}
                {filteredRelated.length > 0 && (
                    <section className='max-w-6xl mx-auto'>
                        <div className='flex items-center justify-between mb-8'>
                            <h2 className='text-2xl font-bold font-serif text-text'>
                                Related Posts
                            </h2>
                            <Link
                                href='/blog'
                                className='text-primary text-sm font-medium hover:underline'
                            >
                                View all items
                            </Link>
                        </div>

                        <div className='flex flex-col gap-4'>
                            {filteredRelated.map((relatedPost, idx) => (
                                <Link
                                    key={relatedPost.id}
                                    href={`/blog/${relatedPost.slug}`}
                                    className='group flex items-start gap-5 hover:bg-secondary/5 p-4 -mx-4 rounded-xl transition-all'
                                >
                                    <span className='font-serif text-3xl font-bold text-text/10 group-hover:text-primary transition-colors min-w-10 text-right mt-0.5'>
                                        {String(idx + 1).padStart(2, "0")}
                                    </span>
                                    <div className='flex flex-col gap-1.5'>
                                        <h3 className='font-bold text-lg text-text group-hover:text-primary transition-colors leading-tight'>
                                            {relatedPost.title}
                                        </h3>
                                        {relatedPost.excerpt && (
                                            <p className='text-text/50 text-sm line-clamp-2 leading-relaxed'>
                                                {relatedPost.excerpt}
                                            </p>
                                        )}
                                        <div className='flex items-center gap-3 mt-1 text-xs text-text/40'>
                                            <span className='font-medium text-text/60 bg-text/5 px-2 py-0.5 rounded-md'>
                                                {
                                                    BLOG_CATEGORIES.find(
                                                        (c) =>
                                                            c.value ===
                                                            relatedPost.category
                                                    )?.label
                                                }
                                            </span>
                                            {relatedPost.published_at && (
                                                <span>
                                                    {new Date(
                                                        relatedPost.published_at
                                                    ).toLocaleDateString(
                                                        "en-US",
                                                        {
                                                            month: "short",
                                                            day: "numeric",
                                                        }
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </article>
        </main>
    )
}
