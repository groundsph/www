"use client"

import { X, CheckCircle, Loader2, User, Calendar } from "lucide-react"

interface PendingBlogPost {
    id: string
    title: string
    excerpt: string | null
    content: string
    coverImage: string | null
    category: string
    status: string
    createdAt: Date | null
    author: {
        id: string
        displayName: string
        username: string
        avatarUrl: string | null
    }
    llmReview: Record<string, unknown> | null
}

interface PostPreviewModalProps {
    post: PendingBlogPost
    onClose: () => void
    onApprove: () => Promise<void>
    onReject: () => void
    isProcessing: boolean
}

export default function PostPreviewModal({
    post,
    onClose,
    onApprove,
    onReject,
    isProcessing,
}: PostPreviewModalProps) {
    const formatDate = (date: Date | null) => {
        if (!date) return "Unknown"
        return new Date(date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        })
    }

    const handleApprove = async () => {
        try {
            await onApprove()
        } catch {
            // Error handling is done in parent
        }
    }

    const handleClose = () => {
        if (isProcessing) return
        onClose()
    }

    // Parse LLM review for display
    const llmReviewData = post.llmReview
    const hasLlmReview = llmReviewData && Object.keys(llmReviewData).length > 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-background rounded-2xl shadow-xl ring-1 ring-text/10 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-tertiary/50">
                    <h2 className="text-lg font-semibold text-text">
                        Post Preview
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-2 text-text/40 hover:text-text hover:bg-text/5 rounded-lg transition-colors cursor-pointer"
                        disabled={isProcessing}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="max-h-[60vh] overflow-y-auto p-6">
                    {/* Cover Image */}
                    {post.coverImage && (
                        <div className="mb-6">
                            <img
                                src={post.coverImage}
                                alt={post.title}
                                className="w-full h-48 md:h-64 object-cover rounded-xl"
                            />
                        </div>
                    )}

                    {/* Title */}
                    <h1 className="text-2xl md:text-3xl font-bold text-text mb-4">
                        {post.title}
                    </h1>

                    {/* Author Info */}
                    <div className="flex items-center gap-3 mb-6 p-3 bg-tertiary/10 rounded-xl">
                        {post.author.avatarUrl ? (
                            <img
                                src={post.author.avatarUrl}
                                alt={post.author.displayName}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-tertiary/50 flex items-center justify-center text-text/60">
                                <User className="w-5 h-5" />
                            </div>
                        )}
                        <div className="flex-1">
                            <p className="font-medium text-text">
                                {post.author.displayName}
                            </p>
                            <p className="text-sm text-text/60">
                                @{post.author.username}
                            </p>
                        </div>
                        <div className="text-sm text-text/50 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(post.createdAt)}
                        </div>
                    </div>

                    {/* Excerpt */}
                    {post.excerpt && (
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-text/60 mb-2">
                                Excerpt
                            </h3>
                            <p className="text-text/80 italic bg-tertiary/10 p-4 rounded-xl">
                                {post.excerpt}
                            </p>
                        </div>
                    )}

                    {/* Content */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-text/60 mb-2">
                            Content
                        </h3>
                        <div className="prose prose-sm max-w-none text-text/90">
                            {post.content.split("\n").map((paragraph, idx) => (
                                <p key={idx} className="mb-4">
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    </div>

                    {/* LLM Review */}
                    {hasLlmReview && (
                        <div className="border border-primary/30 rounded-xl p-4 bg-primary/5">
                            <h3 className="text-sm font-medium text-primary mb-3 flex items-center gap-2">
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                    />
                                </svg>
                                AI Review
                            </h3>
                            <div className="space-y-2 text-sm">
                                {Object.entries(llmReviewData).map(
                                    ([key, value]) => (
                                        <div
                                            key={key}
                                            className="flex items-start gap-2"
                                        >
                                            <span className="font-medium text-text/70 capitalize">
                                                {key.replace(/_/g, " ")}:
                                            </span>
                                            <span className="text-text/90">
                                                {typeof value === "boolean"
                                                    ? value
                                                        ? "Yes"
                                                        : "No"
                                                    : String(value)}
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-tertiary/50 bg-tertiary/5">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-text/60 hover:text-text hover:bg-text/5 rounded-xl transition-colors cursor-pointer"
                        disabled={isProcessing}
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={onReject}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-medium bg-red-500/20 text-red-600 hover:bg-red-500/30 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        Reject
                    </button>
                    <button
                        type="button"
                        onClick={handleApprove}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Approving...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Approve
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
