"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    Clock,
    CheckCircle,
    XCircle,
    Eye,
    Loader2,
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    FileText,
} from "lucide-react"
import { useNotification } from "@/components/layout/NotificationProvider"
import type { PendingBlogPost } from "@/app/api/actions/moderation"
import PostPreviewModal from "./PostPreviewModal"
import RejectPostModal from "./RejectPostModal"

interface ModerationStats {
    pending: number
    approved: number
    rejected: number
}

interface ModerationQueueProps {
    initialPosts: PendingBlogPost[]
    initialTotal: number
    initialStats: ModerationStats
}

export default function ModerationQueue({
    initialPosts,
    initialTotal,
    initialStats,
}: ModerationQueueProps) {
    const [posts, setPosts] = useState(initialPosts)
    const [stats, setStats] = useState(initialStats)
    const [currentPage, setCurrentPage] = useState(1)
    const [total] = useState(initialTotal)
    const [processing, setProcessing] = useState<string | null>(null)
    const [previewPost, setPreviewPost] = useState<PendingBlogPost | null>(null)
    const [rejectPost, setRejectPost] = useState<PendingBlogPost | null>(null)
    const { addNotification } = useNotification()

    const pageSize = 20
    const totalPages = Math.ceil(total / pageSize)

    const handleApprove = async (postId: string) => {
        if (processing) return

        setProcessing(postId)

        try {
            const { approveBlogPost } = await import("@/app/api/actions/blog")
            const result = await approveBlogPost(postId)

            if (!result.success) {
                throw new Error(result.error || "Failed to approve post")
            }

            // Remove from list and update stats
            setPosts((prev) => prev.filter((p) => p.id !== postId))
            setStats((prev) => ({
                ...prev,
                pending: Math.max(0, prev.pending - 1),
                approved: prev.approved + 1,
            }))

            addNotification("Post approved successfully", "success")
        } catch (error) {
            addNotification(
                error instanceof Error ? error.message : "Failed to approve post",
                "error"
            )
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async (postId: string, reason: string): Promise<void> => {
        if (processing) return

        setProcessing(postId)

        try {
            const { rejectBlogPost } = await import("@/app/api/actions/moderation")
            const result = await rejectBlogPost(postId, reason)

            if (!result.success) {
                throw new Error(result.error || "Failed to reject post")
            }

            // Remove from list and update stats
            setPosts((prev) => prev.filter((p) => p.id !== postId))
            setStats((prev) => ({
                ...prev,
                pending: Math.max(0, prev.pending - 1),
                rejected: prev.rejected + 1,
            }))

            addNotification("Post rejected", "success")
            setRejectPost(null)
        } catch (error) {
            addNotification(
                error instanceof Error ? error.message : "Failed to reject post",
                "error"
            )
        } finally {
            setProcessing(null)
        }
    }

    const loadMorePosts = async (page: number) => {
        setProcessing("loading")
        try {
            const { getPendingCommunityPosts } = await import(
                "@/app/api/actions/moderation"
            )
            const result = await getPendingCommunityPosts(page, pageSize)
            setPosts(result.posts)
            setCurrentPage(page)
        } catch {
            addNotification("Failed to load posts", "error")
        } finally {
            setProcessing(null)
        }
    }

    const formatDate = (date: Date | null) => {
        if (!date) return "Unknown"
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-text">
                    Moderation Queue
                </h1>
                <p className="text-text/60 mt-1">
                    Review and approve community blog posts.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                    className="bg-background rounded-xl p-4 shadow-sm border border-tertiary/50"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-secondary" />
                        <span className="text-text/60 text-sm">Pending</span>
                    </div>
                    <div className="text-2xl font-bold text-text">
                        {stats.pending}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-background rounded-xl p-4 shadow-sm border border-tertiary/50"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-text/60 text-sm">Approved</span>
                    </div>
                    <div className="text-2xl font-bold text-text">
                        {stats.approved}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-background rounded-xl p-4 shadow-sm border border-tertiary/50"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-text/60 text-sm">Rejected</span>
                    </div>
                    <div className="text-2xl font-bold text-text">
                        {stats.rejected}
                    </div>
                </motion.div>
            </div>

            {/* Posts List */}
            <div className="space-y-4">
                {posts.length === 0 ? (
                    <div className="text-center py-16 bg-background rounded-xl border border-tertiary/50">
                        <FileText className="w-12 h-12 mx-auto text-text opacity-30 mb-4" />
                        <p className="text-text/60 text-lg">
                            No pending posts
                        </p>
                        <p className="text-text/40 text-sm mt-1">
                            All community posts have been reviewed.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {posts.map((post, index) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-background rounded-xl shadow-sm border border-tertiary/50"
                            >
                                {/* Author Avatar */}
                                <div className="shrink-0">
                                    {post.author.avatarUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element -- External avatar URL */
                                        <img
                                            src={post.author.avatarUrl}
                                            alt={post.author.displayName}
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-tertiary/50 flex items-center justify-center text-text/60 text-sm font-medium">
                                            {post.author.displayName
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                {/* Post Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold truncate text-text">
                                        {post.title}
                                    </h3>
                                    <p className="text-sm text-text/60 truncate">
                                        {post.excerpt ||
                                            "No excerpt available"}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-text/50">
                                        <span>{post.author.displayName}</span>
                                        <span>@</span>
                                        <span>{post.author.username}</span>
                                        <span>•</span>
                                        <span>{formatDate(post.createdAt)}</span>
                                        {post.llmReview && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1 text-primary">
                                                    <AlertCircle className="w-3 h-3" />
                                                    AI Reviewed
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 self-end sm:self-center">
                                    <button
                                        onClick={() => setPreviewPost(post)}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition"
                                        title="Preview"
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span className="text-sm font-medium sm:hidden">
                                            Preview
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => handleApprove(post.id)}
                                        disabled={processing === post.id}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50"
                                        title="Approve"
                                    >
                                        {processing === post.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <CheckCircle className="w-4 h-4" />
                                                <span className="text-sm font-medium sm:hidden">
                                                    Approve
                                                </span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setRejectPost(post)}
                                        disabled={processing === post.id}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50"
                                        title="Reject"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        <span className="text-sm font-medium sm:hidden">
                                            Reject
                                        </span>
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                        <button
                            onClick={() =>
                                loadMorePosts(Math.max(1, currentPage - 1))
                            }
                            disabled={currentPage === 1 || processing === "loading"}
                            className="flex items-center gap-1 px-3 py-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition disabled:opacity-50"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span className="text-sm">Previous</span>
                        </button>
                        <span className="text-sm text-text/60 px-4">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() =>
                                loadMorePosts(
                                    Math.min(totalPages, currentPage + 1)
                                )
                            }
                            disabled={
                                currentPage === totalPages ||
                                processing === "loading"
                            }
                            className="flex items-center gap-1 px-3 py-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition disabled:opacity-50"
                        >
                            <span className="text-sm">Next</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Post Preview Modal */}
            {previewPost && (
                <PostPreviewModal
                    post={previewPost}
                    onClose={() => setPreviewPost(null)}
                    onApprove={async () => {
                        await handleApprove(previewPost.id)
                        setPreviewPost(null)
                    }}
                    onReject={() => {
                        setPreviewPost(null)
                        setRejectPost(previewPost)
                    }}
                    isProcessing={processing === previewPost.id}
                />
            )}

            {/* Reject Modal */}
            {rejectPost && (
                <RejectPostModal
                    postTitle={rejectPost.title}
                    postId={rejectPost.id}
                    onClose={() => setRejectPost(null)}
                    onConfirm={(reason) => handleReject(rejectPost.id, reason)}
                    isProcessing={processing === rejectPost.id}
                />
            )}
        </div>
    )
}
