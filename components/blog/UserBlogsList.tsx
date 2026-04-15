"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, FileText, Edit2, Trash2, Eye } from "lucide-react"
import type { BlogPost } from "@/utils/types/blog"
import { useNotification } from "@/components/layout/NotificationProvider"
import { deleteBlogPost } from "@/app/api/actions/blog"
import { getBlogStatusStyle, getBlogStatusLabel } from "@/utils/blog/status-styles"
import { useState } from "react"

interface UserBlogsListProps {
    initialPosts: BlogPost[]
}

export default function UserBlogsList({ initialPosts }: UserBlogsListProps) {
    const [posts, setPosts] = useState(initialPosts)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const { addNotification } = useNotification()
    const router = useRouter()

    const handleDelete = async (postId: string) => {
        if (!confirm("Are you sure you want to delete this blog post?")) {
            return
        }

        setDeletingId(postId)
        try {
            const result = await deleteBlogPost(postId)
            if (result.success) {
                setPosts(posts.filter(p => p.id !== postId))
                router.refresh()
                addNotification("Blog post deleted successfully", "success")
            } else {
                addNotification(result.error || "Failed to delete blog post", "error")
            }
        } catch (error) {
            console.error("Error deleting blog post:", error)
            addNotification("An error occurred while deleting", "error")
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="min-h-screen w-full bg-background">
            {/* Header */}
            <div className="border-b w-full border-secondary/20 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/profile"
                            className="p-2 -ml-2 text-text/60 hover:text-text transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="font-serif text-2xl font-bold text-text">
                                My Blogs
                            </h1>
                            <p className="text-sm text-text/60">
                                {posts.length} {posts.length === 1 ? "post" : "posts"}
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/blog/new"
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
                    >
                        <Edit2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Write Blog</span>
                    </Link>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                {posts.length === 0 ? (
                    <div className="text-center py-16">
                        <FileText className="w-16 h-16 text-secondary opacity-40 mx-auto mb-4" />
                        <h3 className="text-xl font-serif font-semibold text-text mb-2">
                            No blog posts yet
                        </h3>
                        <p className="text-text/60 mb-6">
                            Share your coffee experiences and stories with the community.
                        </p>
                        <Link
                            href="/blog/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors"
                        >
                            <Edit2 className="w-5 h-5" />
                            Write Your First Blog
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {posts.map((post) => (
                            <div
                                key={post.id}
                                className="flex items-center gap-4 p-4 bg-background border border-secondary/20 hover:border-primary/30 rounded-xl transition-all group"
                            >
                                {/* Thumbnail */}
                                <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-lg overflow-hidden bg-secondary/10">
                                    {post.cover_image ? (
                                        <Image
                                            src={post.cover_image}
                                            alt={post.title}
                                            fill
                                            className="object-cover"
                                            sizes="80px"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-primary/20 to-accent/20">
                                            <FileText className="w-6 h-6 text-primary opacity-40" />
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-serif font-semibold text-lg text-text group-hover:text-primary transition-colors line-clamp-1">
                                        {post.title}
                                    </h3>
                                    {post.excerpt && (
                                        <p className="text-sm text-text/60 line-clamp-1 mt-0.5">
                                            {post.excerpt}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${getBlogStatusStyle(post.status)}`}>
                                            {getBlogStatusLabel(post.status)}
                                        </span>
                                        {post.updated_at && (
                                            <span className="text-sm text-text/50">
                                                Updated {new Date(post.updated_at).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {(post.status === "published" || post.status === "draft" || post.status === "pending") && (
                                        <a
                                            href={`/blog/${post.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-text/60 hover:text-primary transition-colors"
                                            title="Preview"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </a>
                                    )}
                                    <Link
                                        href={`/blog/edit/${post.id}`}
                                        className="p-2 text-text/60 hover:text-primary transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(post.id)}
                                        disabled={deletingId === post.id}
                                        className="p-2 text-text/60 hover:text-red-500 transition-colors disabled:opacity-50"
                                        title="Delete"
                                    >
                                        {deletingId === post.id ? (
                                            <span className="w-4 h-4 border-2 border-text/30 border-t-primary rounded-full animate-spin block" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
