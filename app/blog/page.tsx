import { getPublishedBlogPosts, getFeaturedPosts } from "@/app/api/actions/blog"
import { BLOG_CATEGORIES, estimateReadingTime } from "@/utils/types/blog"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Coffee, MapPin, BookOpen } from "lucide-react"

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
            <section className='relative bg-linear-to-br from-primary/10 via-secondary/5 to-tertiary/10 py-20 overflow-hidden'>
                {/* Decorative Background Elements */}
                <div className='absolute inset-0 pointer-events-none select-none overflow-hidden'>
                    <Coffee className='absolute -top-6 -right-6 w-48 h-48 text-primary/5 rotate-12' />
                    <BookOpen className='absolute -bottom-12 -left-12 w-64 h-64 text-secondary/5 -rotate-12' />
                    <div className='absolute top-1/4 right-1/4 w-32 h-32 bg-accent/5 rounded-full blur-3xl' />
                    <div className='absolute bottom-1/4 left-1/3 w-40 h-40 bg-primary/5 rounded-full blur-3xl' />
                    <MapPin className='absolute top-20 right-[20%] w-16 h-16 text-text/5 rotate-12' />
                </div>

                <div className='max-w-7xl mx-auto px-4 relative z-10'>
                    <span className='inline-block px-3 py-1 mb-4 bg-background/50 backdrop-blur-sm border border-text/5 rounded-full text-xs font-medium text-text/60 uppercase tracking-wider'>
                        Grounds Editorial
                    </span>
                    <h1 className='text-5xl md:text-6xl lg:text-7xl font-bold font-serif text-text mb-6 tracking-tight'>
                        The Grounds Blog
                    </h1>
                    <p className='text-xl md:text-2xl text-text/70 max-w-2xl font-light leading-relaxed'>
                        Discover stories, brewing guides, cafe updates, and news
                        from the Philippine community.
                    </p>
                </div>
            </section>

            {/* Category Tabs */}
            <section className='sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-text/10'>
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
                                                sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
                                                placeholder='blur'
                                                blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAAUDBAMAAAAAAAAAAAAAAAECAwQFESESBhMxQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABoRAAICAwAAAAAAAAAAAAAAAAECABEDITH/2gAMAwEAAhEDEEA/ALS9cV6W3HuVPUYuT/qZSyH6k+AAFZdD/9k='
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
                        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-2'>
                            {posts.map((post) => (
                                <article
                                    key={post.id}
                                    className='group flex flex-col border border-text/10 p-4 hover:border-text/20 transition-all shadow-none hover:shadow-md'
                                >
                                    <Link
                                        href={`/blog/${post.slug}`}
                                        className='flex flex-col h-full'
                                    >
                                        <div className='flex-1 flex flex-col'>
                                            {/* Header - Date and Category */}
                                            <div className='flex items-center justify-between mb-3'>
                                                {post.published_at && (
                                                    <span className='text-sm text-text/50'>
                                                        {new Date(
                                                            post.published_at
                                                        ).toLocaleDateString(
                                                            "en-US",
                                                            {
                                                                day: "numeric",
                                                                month: "long",
                                                                year: "numeric",
                                                            }
                                                        )}
                                                    </span>
                                                )}
                                                <span className='px-3 py-1 border border-text/20 text-text/70 text-xs font-medium rounded-full uppercase tracking-wide'>
                                                    {
                                                        BLOG_CATEGORIES.find(
                                                            (c) =>
                                                                c.value ===
                                                                post.category
                                                        )?.label
                                                    }
                                                </span>
                                            </div>

                                            {/* Image - Portrait aspect ratio */}
                                            <div className='relative aspect-video overflow-hidden mb-5'>
                                                {post.cover_image ? (
                                                    <Image
                                                        src={post.cover_image}
                                                        alt={post.title}
                                                        fill
                                                        className='object-cover grayscale group-hover:grayscale-0 transition-all duration-500'
                                                        sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
                                                        placeholder='blur'
                                                        blurDataURL='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAAUDBAMAAAAAAAAAAAAAAAECAwQFESESBhMxQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABoRAAICAwAAAAAAAAAAAAAAAAECABEDITH/2gAMAwEAAhEDEEA/ALS9cV6W3HuVPUYuT/qZSyH6k+AAFZdD/9k='
                                                    />
                                                ) : (
                                                    <div className='w-full h-full bg-text/5 flex items-center justify-center'>
                                                        <Coffee className='w-12 h-12 text-text/20' />
                                                    </div>
                                                )}
                                                {post.cafe && (
                                                    <div className='absolute bottom-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg flex items-center gap-1.5'>
                                                        <Coffee className='w-3 h-3 text-primary' />
                                                        <span className='text-xs text-text font-medium'>
                                                            {post.cafe.name}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Title */}
                                            <h3 className='font-bold font-serif text-text text-xl mb-3 line-clamp-2 group-hover:text-primary transition-colors'>
                                                {post.title}
                                            </h3>

                                            {/* Excerpt */}
                                            {post.excerpt && (
                                                <p className='text-text/60 text-sm line-clamp-4 mb-6 leading-relaxed'>
                                                    {post.excerpt}
                                                </p>
                                            )}
                                        </div>

                                        {/* Footer - Author and Duration */}
                                        <div className='mt-auto pt-4 border-t border-text/10 flex items-center justify-between text-xs text-text/50'>
                                            {post.author && (
                                                <div className='flex items-center gap-1'>
                                                    <span className='text-text/40'>
                                                        Text
                                                    </span>
                                                    <span className='text-text font-medium'>
                                                        {
                                                            post.author
                                                                .display_name
                                                        }
                                                    </span>
                                                </div>
                                            )}
                                            <div className='flex items-center gap-1'>
                                                <span className='text-text/40'>
                                                    Duration
                                                </span>
                                                <span className='text-text font-medium'>
                                                    {estimateReadingTime(
                                                        post.content
                                                    )}{" "}
                                                    Min
                                                </span>
                                            </div>
                                        </div>

                                        {/* Read More CTA */}
                                        <div className='mt-4 flex items-center gap-2 text-primary font-medium text-sm group-hover:gap-3 transition-all'>
                                            Read More
                                            <ArrowRight className='w-4 h-4' />
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
