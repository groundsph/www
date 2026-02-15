"use client"

import { useState } from "react"
import Link from "next/link"
import {
    FileText,
    Plus,
    Pencil,
    Eye,
    Loader2,
    Calendar,
    Tag,
    Search,
    Trash2,
} from "lucide-react"
import { BlogPost, BlogStatus, BLOG_CATEGORIES } from "@/utils/types/blog"
import { getWriterBlogPosts, deleteBlogPost } from "@/app/api/actions/blog"
import { formatDistanceToNow } from "date-fns"

interface WriterDashboardProps {
    initialPosts: BlogPost[]
}

export default function WriterDashboard({
    initialPosts,
}: WriterDashboardProps) {
    const [posts, setPosts] = useState<BlogPost[]>(initialPosts)
    const [isLoading, setIsLoading] = useState(false)
    const [processing, setProcessing] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<BlogStatus | "all">("all")
    const [searchQuery, setSearchQuery] = useState("")

    const loadPosts = async () => {
        setIsLoading(true)
        try {
            const result = await getWriterBlogPosts({
                search: searchQuery || undefined,
                status: filterStatus === "all" ? undefined : filterStatus,
                pageSize: 50,
            })
            setPosts(result.posts)
        } catch (error) {
            console.error("Failed to load posts", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (postId: string) => {
        if (
            !confirm(
                "Are you sure you want to delete this post? This cannot be undone."
            )
        )
            return

        setProcessing(postId)
        try {
            const result = await deleteBlogPost(postId)
            if (result.success) {
                setPosts((prev) => prev.filter((p) => p.id !== postId))
            } else {
                alert(result.error || "Failed to delete post")
            }
        } catch (error) {
            console.error("Error deleting post:", error)
        } finally {
            setProcessing(null)
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        loadPosts()
    }

    return (
        <div className='space-y-6'>
            <header className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                <div>
                    <h1 className='text-3xl font-bold font-serif text-text'>
                        My Stories
                    </h1>
                    <p className='text-text/60 mt-1'>
                        Manage and publish your blog posts
                    </p>
                </div>
                <Link
                    href='/writer/new'
                    className='flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm font-medium'
                >
                    <Plus className='w-5 h-5' />
                    Write New Story
                </Link>
            </header>

            {/* Filters */}
            <div className='flex flex-col md:flex-row gap-4 py-4 border-y border-text/5'>
                <div className='flex items-center gap-2 overflow-x-auto pb-2 md:pb-0'>
                    {(["all", "published", "draft", "archived"] as const).map(
                        (status) => (
                            <button
                                key={status}
                                onClick={() => {
                                    setFilterStatus(status)
                                    // Trigger reload in useEffect or manual call
                                    // For simplicity, we'll assume user clicks search or we add effect
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
                                    filterStatus === status
                                        ? "bg-text/10 text-text"
                                        : "text-text/60 hover:text-text hover:bg-text/5"
                                }`}
                            >
                                {status}
                            </button>
                        )
                    )}
                </div>
                <form
                    onSubmit={handleSearch}
                    className='flex-1 max-w-md relative'
                >
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                    <input
                        type='text'
                        placeholder='Search stories...'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className='w-full pl-9 pr-4 py-2 bg-background border border-text/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm'
                    />
                </form>
                <button
                    onClick={loadPosts}
                    className='px-4 py-2 bg-text/5 hover:bg-text/10 text-text/80 rounded-xl text-sm font-medium transition-colors'
                >
                    Refresh
                </button>
            </div>

            {/* Posts List */}
            {isLoading ? (
                <div className='flex justify-center py-20'>
                    <Loader2 className='w-8 h-8 animate-spin text-text opacity-20' />
                </div>
            ) : posts.length === 0 ? (
                <div className='text-center py-20 bg-text/5 rounded-2xl border border-dashed border-text/10'>
                    <div className='w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm'>
                        <FileText className='w-8 h-8 text-text opacity-30' />
                    </div>
                    <h3 className='text-lg font-semibold text-text'>
                        No stories founding
                    </h3>
                    <p className='text-text/60 max-w-sm mx-auto mt-2 mb-6'>
                        You haven&apos;t written any stories yet, or none match
                        your search filters.
                    </p>
                    <Link
                        href='/writer/new'
                        className='inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors font-medium'
                    >
                        <Plus className='w-4 h-4' />
                        Start Writing
                    </Link>
                </div>
            ) : (
                <div className='grid gap-4'>
                    {posts.map((post) => (
                        <div
                            key={post.id}
                            className='group bg-background border border-text/10 rounded-2xl p-5 hover:border-text/20 hover:shadow-sm transition-all flex flex-col sm:flex-row gap-5'
                        >
                            {/* Thumbnail */}
                            <div className='relative w-full sm:w-48 h-32 bg-text/5 rounded-xl overflow-hidden shrink-0'>
                                {post.cover_image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={post.cover_image}
                                        alt={post.title}
                                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                                    />
                                ) : (
                                    <div className='w-full h-full flex items-center justify-center text-text/20'>
                                        <FileText className='w-8 h-8' />
                                    </div>
                                )}
                                <div className='absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium rounded-md capitalize'>
                                    {post.status}
                                </div>
                            </div>

                            {/* Content */}
                            <div className='flex-1 min-w-0 py-1 flex flex-col'>
                                <div className='flex items-start justify-between gap-4'>
                                    <div className='space-y-1'>
                                        <div className='flex items-center gap-2 text-xs text-text/50 mb-1'>
                                            <span className='flex items-center gap-1 bg-text/5 px-1.5 py-0.5 rounded'>
                                                <Tag className='w-3 h-3' />
                                                {BLOG_CATEGORIES.find(
                                                    (c) =>
                                                        c.value ===
                                                        post.category
                                                )?.label || post.category}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                {post.updated_at
                                                    ? `Updated ${formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}`
                                                    : "Just now"}
                                            </span>
                                        </div>
                                        <h3 className='text-xl font-bold font-serif text-text line-clamp-1 group-hover:text-primary transition-colors'>
                                            {post.title}
                                        </h3>
                                        <p className='text-text/60 text-sm line-clamp-2'>
                                            {post.excerpt || "No excerpt"}
                                        </p>
                                    </div>
                                </div>

                                <div className='mt-auto pt-4 flex items-center justify-between'>
                                    <div className='flex items-center gap-4 text-xs text-text/50 font-medium'>
                                        <span className='flex items-center gap-1.5'>
                                            <Eye className='w-3.5 h-3.5' />
                                            {post.views_count || 0} views
                                        </span>
                                        {post.published_at && (
                                            <span className='flex items-center gap-1.5'>
                                                <Calendar className='w-3.5 h-3.5' />
                                                Published{" "}
                                                {new Date(
                                                    post.published_at
                                                ).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>

                                    <div className='flex items-center gap-2'>
                                        {post.status === "published" && (
                                            <Link
                                                href={`/blog/${post.slug}`}
                                                target='_blank'
                                                className='p-2 text-text/40 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors'
                                                title='View Live'
                                            >
                                                <Eye className='w-4 h-4' />
                                            </Link>
                                        )}
                                        <button
                                            onClick={() =>
                                                handleDelete(post.id)
                                            }
                                            disabled={processing === post.id}
                                            className='p-2 text-text/40 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-colors disabled:opacity-50'
                                            title='Delete'
                                        >
                                            {processing === post.id ? (
                                                <Loader2 className='w-4 h-4 animate-spin' />
                                            ) : (
                                                <Trash2 className='w-4 h-4' />
                                            )}
                                        </button>
                                        <Link
                                            href={`/writer/${post.id}/edit`}
                                            className='flex items-center gap-2 px-4 py-2 bg-text text-white rounded-lg hover:bg-text/90 transition-colors text-sm font-medium ml-2'
                                        >
                                            <Pencil className='w-3.5 h-3.5' />
                                            Edit
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
