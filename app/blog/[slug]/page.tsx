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
import { Calendar, Clock, ArrowLeft, Eye, Coffee, User } from "lucide-react"
import ShareButton from "@/components/blog/ShareButton"
import ReportButton from "@/components/blog/ReportButton"

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
            title: "Post Not Found | Grounds PH",
        }
    }

    return {
        title: `${post.title} | Grounds PH Blog`,
        description: post.excerpt || post.content.substring(0, 160),
        openGraph: {
            title: post.title,
            description: post.excerpt || post.content.substring(0, 160),
            images: post.cover_image ? [post.cover_image] : [],
        },
    }
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const post = await getBlogPostBySlug(slug)

    if (!post) {
        notFound()
    }

    // Increment view count (fire and forget)
    incrementViewCount(post.id)

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
                                    {post.author.avatar_url ? (
                                        <Image
                                            src={post.author.avatar_url}
                                            alt={post.author.display_name}
                                            width={44}
                                            height={44}
                                            className='rounded-full object-cover'
                                        />
                                    ) : (
                                        <div className='w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center'>
                                            <User className='w-5 h-5 text-primary' />
                                        </div>
                                    )}
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
                            <div className='flex items-center gap-1.5'>
                                <Eye className='w-4 h-4' />
                                <span>{post.views_count || 0} views</span>
                            </div>
                            <div className='border-l border-text/10 pl-4 ml-2'>
                                <ReportButton
                                    postId={post.id}
                                    className='text-xs px-2 py-1'
                                />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className='prose prose-lg prose-stone max-w-none mb-12'>
                    <MarkdownRender content={post.content} />
                </div>

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

                {/* Share Section */}
                <div className='flex items-center justify-center gap-4 py-8 border-y border-text/10 mb-12'>
                    <span className='text-text/60 text-sm'>
                        Share this article
                    </span>
                    <ShareButton title={post.title} />
                </div>

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
