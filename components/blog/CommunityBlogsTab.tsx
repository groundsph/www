"use client"

import Link from "next/link"
import Image from "next/image"
import { BlogPost } from "@/utils/types/blog"
import { estimateReadingTime, BLOG_CATEGORIES } from "@/utils/types/blog"
import { ArrowRight, Coffee, BookOpen } from "lucide-react"

interface CommunityBlogsTabProps {
    featuredPosts: BlogPost[]
    posts: BlogPost[]
    total: number
    hasMore: boolean
    page: number
}

export default function CommunityBlogsTab({
    featuredPosts,
    posts,
    total,
    hasMore,
    page,
}: CommunityBlogsTabProps) {
    const categoryLabel = (category: string) =>
        BLOG_CATEGORIES.find((c) => c.value === category)?.label || category

    return (
        <div className='space-y-12'>
            {/* Featured Posts */}
            {page === 1 && featuredPosts.length > 0 && (
                <section>
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
                                            <Coffee className='w-12 h-12 text-primary opacity-40' />
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

            {/* All Posts */}
            <section>
                <div className='flex items-center justify-between mb-6'>
                    <h2 className='text-2xl font-bold font-serif text-text'>
                        Latest Posts
                    </h2>
                    <span className='text-sm text-text/60'>
                        {total} {total === 1 ? "post" : "posts"}
                    </span>
                </div>

                {posts.length === 0 ? (
                    <div className='text-center py-16'>
                        <BookOpen className='w-16 h-16 text-text opacity-20 mx-auto mb-4' />
                        <p className='text-text/60'>
                            No blog posts yet.
                        </p>
                    </div>
                ) : (
                    <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
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
                                                {categoryLabel(post.category)}
                                            </span>
                                        </div>

                                        {/* Image */}
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
                                                    <Coffee className='w-12 h-12 text-text opacity-20' />
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
                                                    {post.author.display_name}
                                                </span>
                                            </div>
                                        )}
                                        <div className='flex items-center gap-1'>
                                            <span className='text-text/40'>
                                                Duration
                                            </span>
                                            <span className='text-text font-medium'>
                                                {estimateReadingTime(post.content)}{" "}
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
                                href={`/community?tab=blogs&page=${page - 1}`}
                                className='px-6 py-2.5 bg-text/5 text-text font-medium rounded-xl hover:bg-text/10 transition-colors'
                            >
                                Previous
                            </Link>
                        )}
                        <span className='text-text/60'>Page {page}</span>
                        {hasMore && (
                            <Link
                                href={`/community?tab=blogs&page=${page + 1}`}
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
    )
}
