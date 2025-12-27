import { getPublishedBlogPosts, getFeaturedPosts } from "@/app/api/actions/blog"
import { BLOG_CATEGORIES, estimateReadingTime } from "@/utils/types/blog"
import Image from "next/image"
import Link from "next/link"
import { Calendar, Clock, ArrowRight, Coffee, User } from "lucide-react"

export const metadata = {
    title: "Blog | Grounds PH",
    description:
        "Coffee stories, brewing guides, and news from the Philippine coffee community",
}

export const revalidate = 300 // Revalidate every 5 minutes

export default async function BlogPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; page?: string }>
}) {
    const params = await searchParams
    const category = params.category as
        | "news"
        | "guides"
        | "events"
        | "promotions"
        | "community"
        | "cafe_update"
        | undefined
    const page = parseInt(params.page || "1")

    const [featuredResult, postsResult] = await Promise.all([
        page === 1 ? getFeaturedPosts(3) : Promise.resolve([]),
        getPublishedBlogPosts({ page, pageSize: 12, category }),
    ])

    const featuredPosts = featuredResult
    const { posts, total, hasMore } = postsResult

    return (
        <main className='w-full min-h-screen bg-background'>
            {/* Hero Section */}
            <section className='relative bg-linear-to-br from-primary/10 via-secondary/5 to-tertiary/10 py-16 md:py-24'>
                <div className='max-w-7xl mx-auto px-4'>
                    <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold font-serif text-text mb-4'>
                        The Grounds Blog
                    </h1>
                    <p className='text-lg md:text-xl text-text/70 max-w-2xl'>
                        Discover coffee stories, brewing guides, cafe updates,
                        and news from the Philippine coffee community.
                    </p>
                </div>
            </section>

            {/* Category Tabs */}
            <section className='sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-text/10'>
                <div className='max-w-7xl mx-auto px-4'>
                    <nav className='flex gap-1 overflow-x-auto py-3 scrollbar-hide'>
                        <Link
                            href='/blog'
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                !category
                                    ? "bg-primary text-white"
                                    : "bg-text/5 text-text/70 hover:bg-text/10"
                            }`}
                        >
                            All Posts
                        </Link>
                        {BLOG_CATEGORIES.map((cat) => (
                            <Link
                                key={cat.value}
                                href={`/blog?category=${cat.value}`}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                    category === cat.value
                                        ? "bg-primary text-white"
                                        : "bg-text/5 text-text/70 hover:bg-text/10"
                                }`}
                            >
                                {cat.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </section>

            <div className='max-w-7xl mx-auto px-4 py-12'>
                {/* Featured Posts - Only on first page with no category filter */}
                {page === 1 && !category && featuredPosts.length > 0 && (
                    <section className='mb-16'>
                        <h2 className='text-2xl font-bold font-serif text-text mb-6'>
                            Featured
                        </h2>
                        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
                            {featuredPosts.map((post, index) => (
                                <Link
                                    key={post.id}
                                    href={`/blog/${post.slug}`}
                                    className={`group relative overflow-hidden rounded-2xl bg-text/5 ${
                                        index === 0
                                            ? "md:col-span-2 md:row-span-2"
                                            : ""
                                    }`}
                                >
                                    <div
                                        className={`relative ${
                                            index === 0
                                                ? "aspect-video md:aspect-16/10"
                                                : "aspect-video"
                                        }`}
                                    >
                                        {post.cover_image ? (
                                            <Image
                                                src={post.cover_image}
                                                alt={post.title}
                                                fill
                                                className='object-cover transition-transform duration-500 group-hover:scale-105'
                                            />
                                        ) : (
                                            <div className='w-full h-full bg-linear-to-br from-primary/20 to-secondary/20 flex items-center justify-center'>
                                                <Coffee className='w-12 h-12 text-primary/40' />
                                            </div>
                                        )}
                                        <div className='absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent' />
                                    </div>
                                    <div className='absolute bottom-0 left-0 right-0 p-6'>
                                        <span className='inline-block px-3 py-1 bg-primary/90 text-white text-xs font-medium rounded-full mb-3'>
                                            Featured
                                        </span>
                                        <h3
                                            className={`font-bold font-serif text-white mb-2 line-clamp-2 ${
                                                index === 0
                                                    ? "text-2xl md:text-3xl"
                                                    : "text-lg"
                                            }`}
                                        >
                                            {post.title}
                                        </h3>
                                        {post.excerpt && (
                                            <p
                                                className={`text-white/70 line-clamp-2 ${
                                                    index === 0
                                                        ? "text-base"
                                                        : "text-sm"
                                                }`}
                                            >
                                                {post.excerpt}
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* All Posts Grid */}
                <section>
                    <div className='flex items-center justify-between mb-6'>
                        <h2 className='text-2xl font-bold font-serif text-text'>
                            {category
                                ? BLOG_CATEGORIES.find(
                                      (c) => c.value === category
                                  )?.label
                                : "Latest Posts"}
                        </h2>
                        <span className='text-sm text-text/60'>
                            {total} {total === 1 ? "post" : "posts"}
                        </span>
                    </div>

                    {posts.length === 0 ? (
                        <div className='text-center py-16'>
                            <Coffee className='w-16 h-16 text-text/20 mx-auto mb-4' />
                            <p className='text-text/60'>
                                No posts found in this category yet.
                            </p>
                        </div>
                    ) : (
                        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
                            {posts.map((post) => (
                                <article
                                    key={post.id}
                                    className='group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-text/5'
                                >
                                    <Link href={`/blog/${post.slug}`}>
                                        <div className='relative aspect-video overflow-hidden'>
                                            {post.cover_image ? (
                                                <Image
                                                    src={post.cover_image}
                                                    alt={post.title}
                                                    fill
                                                    className='object-cover transition-transform duration-500 group-hover:scale-105'
                                                />
                                            ) : (
                                                <div className='w-full h-full bg-linear-to-br from-secondary/20 to-tertiary/20 flex items-center justify-center'>
                                                    <Coffee className='w-10 h-10 text-primary/30' />
                                                </div>
                                            )}
                                            {post.cafe && (
                                                <div className='absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg flex items-center gap-1.5'>
                                                    <Coffee className='w-3 h-3 text-white' />
                                                    <span className='text-xs text-white font-medium'>
                                                        {post.cafe.name}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className='p-5'>
                                            <div className='flex items-center gap-2 mb-3'>
                                                <span className='px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full'>
                                                    {
                                                        BLOG_CATEGORIES.find(
                                                            (c) =>
                                                                c.value ===
                                                                post.category
                                                        )?.label
                                                    }
                                                </span>
                                            </div>
                                            <h3 className='font-bold font-serif text-text text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors'>
                                                {post.title}
                                            </h3>
                                            {post.excerpt && (
                                                <p className='text-text/60 text-sm line-clamp-2 mb-4'>
                                                    {post.excerpt}
                                                </p>
                                            )}
                                            <div className='flex items-center justify-between text-xs text-text/50'>
                                                <div className='flex items-center gap-3'>
                                                    {post.author && (
                                                        <div className='flex items-center gap-1.5'>
                                                            {post.author
                                                                .avatar_url ? (
                                                                <Image
                                                                    src={
                                                                        post
                                                                            .author
                                                                            .avatar_url
                                                                    }
                                                                    alt={
                                                                        post
                                                                            .author
                                                                            .display_name
                                                                    }
                                                                    width={20}
                                                                    height={20}
                                                                    className='rounded-full object-cover'
                                                                />
                                                            ) : (
                                                                <User className='w-4 h-4' />
                                                            )}
                                                            <span>
                                                                {
                                                                    post.author
                                                                        .display_name
                                                                }
                                                            </span>
                                                        </div>
                                                    )}
                                                    {post.published_at && (
                                                        <div className='flex items-center gap-1'>
                                                            <Calendar className='w-3.5 h-3.5' />
                                                            <span>
                                                                {new Date(
                                                                    post.published_at
                                                                ).toLocaleDateString(
                                                                    "en-US",
                                                                    {
                                                                        month: "short",
                                                                        day: "numeric",
                                                                    }
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className='flex items-center gap-1'>
                                                    <Clock className='w-3.5 h-3.5' />
                                                    <span>
                                                        {estimateReadingTime(
                                                            post.content
                                                        )}{" "}
                                                        min
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </article>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {(page > 1 || hasMore) && (
                        <nav className='flex items-center justify-center gap-4 mt-12'>
                            {page > 1 && (
                                <Link
                                    href={`/blog?${category ? `category=${category}&` : ""}page=${page - 1}`}
                                    className='px-6 py-2.5 bg-text/5 text-text font-medium rounded-xl hover:bg-text/10 transition-colors'
                                >
                                    Previous
                                </Link>
                            )}
                            <span className='text-text/60'>Page {page}</span>
                            {hasMore && (
                                <Link
                                    href={`/blog?${category ? `category=${category}&` : ""}page=${page + 1}`}
                                    className='px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2'
                                >
                                    Next
                                    <ArrowRight className='w-4 h-4' />
                                </Link>
                            )}
                        </nav>
                    )}
                </section>
            </div>
        </main>
    )
}
