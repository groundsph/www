"use client"

import { useState } from "react"
import {
    FileText,
    Calendar,
    Plus,
    Trash2,
    Pencil,
    Eye,
    Loader2,
    Flag,
    CheckCircle,
    XCircle,
    Archive,
    ShieldAlert,
} from "lucide-react"
import { BlogPost, BlogStatus } from "@/utils/types/blog"
import { EventWithCafe } from "@/utils/types/extra"
import RichBlogEditor from "@/components/blog/RichBlogEditor"
import EventsManagement from "@/components/events/EventsManagement"
import BlogReportsPanel from "./BlogReportsPanel"
import ApprovePostModal from "@/components/admin/ApprovePostModal"
import RejectPostModal from "./RejectPostModal"
import BlogPostPreviewModal from "./BlogPostPreviewModal"
import { useNotification } from "@/components/layout/NotificationProvider"

interface ContentManagementProps {
    blogPosts: BlogPost[]
    events: EventWithCafe[]
    /** Current admin/moderator id — used to separate "own" from "review" posts. */
    currentUserId: string | null
}

type TabType = "blog" | "events" | "reports"

const STATUS_FILTERS: (BlogStatus | "all")[] = [
    "all",
    "published",
    "pending",
    "draft",
    "rejected",
    "archived",
]

export default function ContentManagement({
    blogPosts: initialBlogPosts,
    events: initialEvents,
    currentUserId,
}: ContentManagementProps) {
    const [activeTab, setActiveTab] = useState<TabType>("blog")
    const [blogPosts, setBlogPosts] = useState(initialBlogPosts)
    const [events] = useState(initialEvents)
    const [statusFilter, setStatusFilter] = useState<BlogStatus | "all">("all")

    const [showBlogEditor, setShowBlogEditor] = useState(false)
    const [editingBlogPost, setEditingBlogPost] = useState<BlogPost | null>(null)
    const [processing, setProcessing] = useState<string | null>(null)
    const [previewPost, setPreviewPost] = useState<BlogPost | null>(null)
    const [rejectPost, setRejectPost] = useState<BlogPost | null>(null)
    const { addNotification } = useNotification()

    // Approval confirmation modal state
    const [approvalPost, setApprovalPost] = useState<BlogPost | null>(null)

    /** Only the author may edit a post; admins get moderation actions instead. */
    const isOwnPost = (post: BlogPost) =>
        Boolean(currentUserId && post.author_id === currentUserId)

    // Blog handlers
    const refreshBlogPosts = async () => {
        const { getAdminBlogPosts } = await import("@/app/api/actions/blog")
        const result = await getAdminBlogPosts({ pageSize: 50 })
        setBlogPosts(result.posts)
    }

    const filteredPosts = statusFilter === "all"
        ? blogPosts
        : blogPosts.filter(p => p.status === statusFilter)

    const openBlogEditor = (post?: BlogPost) => {
        setEditingBlogPost(post || null)
        setShowBlogEditor(true)
    }

    const closeBlogEditor = () => {
        setEditingBlogPost(null)
        setShowBlogEditor(false)
    }

    const handleBlogSuccess = async () => {
        await refreshBlogPosts()
        closeBlogEditor()
    }

    const handleDeleteBlogPost = async (postId: string) => {
        if (!confirm("Are you sure you want to delete this blog post?")) return
        setProcessing(postId)
        const { deleteBlogPost } = await import("@/app/api/actions/blog")
        const result = await deleteBlogPost(postId)
        if (result.success) {
            setBlogPosts((prev) => prev.filter((p) => p.id !== postId))
        } else {
            addNotification(result.error || "Failed to delete post", "error")
        }
        setProcessing(null)
    }

    const setPostStatus = (postId: string, status: BlogStatus) => {
        setBlogPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, status } : p))
        )
    }

    const handleApproveBlogPost = async (postId: string) => {
        // Prevent concurrent calls
        if (processing) return

        setProcessing(postId)

        // Store current post state for potential rollback (captured at update moment)
        let previousStatus: BlogPost["status"] = "pending"
        let postFound = false

        // Optimistically update to published and capture previous status
        setBlogPosts((prev) => {
            const post = prev.find((p) => p.id === postId)
            if (post) {
                previousStatus = post.status
                postFound = true
            }
            return prev.map((p) =>
                p.id === postId ? { ...p, status: "published" as const } : p
            )
        })

        if (!postFound) {
            setProcessing(null)
            return
        }

        try {
            const { approveBlogPost } = await import("@/app/api/actions/blog")
            const result = await approveBlogPost(postId)

            if (!result.success) {
                throw new Error(result.error || "Failed to approve post")
            }

            addNotification("Post approved successfully", "success")
        } catch (error) {
            // Rollback on failure
            setBlogPosts((prev) =>
                prev.map((p) =>
                    p.id === postId ? { ...p, status: previousStatus } : p
                )
            )
            addNotification(
                error instanceof Error ? error.message : "Failed to approve post",
                "error"
            )
        } finally {
            setProcessing(null)
        }
    }

    const handleRejectBlogPost = async (postId: string, reason: string) => {
        if (processing) return
        setProcessing(postId)
        try {
            const { rejectBlogPost } = await import("@/app/api/actions/moderation")
            const result = await rejectBlogPost(postId, reason)
            if (!result.success) {
                throw new Error(result.error || "Failed to reject post")
            }
            setPostStatus(postId, "rejected")
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

    const handleArchiveBlogPost = async (postId: string) => {
        if (processing) return
        setProcessing(postId)
        try {
            const { archiveBlogPostForModeration } = await import(
                "@/app/api/actions/blog-report"
            )
            const result = await archiveBlogPostForModeration(postId)
            if (!result.success) {
                throw new Error(result.error || "Failed to archive post")
            }
            setPostStatus(postId, "archived")
            addNotification("Post archived", "success")
        } catch (error) {
            addNotification(
                error instanceof Error ? error.message : "Failed to archive post",
                "error"
            )
        } finally {
            setProcessing(null)
        }
    }

    return (
        <div className='space-y-6'>
            {/* Header */}
            <div>
                <h1 className='text-2xl md:text-3xl font-bold text-text'>
                    Content Management
                </h1>
                <p className='text-text/60 mt-1'>
                    Create and manage blog posts and events.
                </p>
            </div>

            {/* Stats */}
            <div className='grid grid-cols-2 gap-4'>
                <div className='bg-background rounded-xl p-4 shadow-sm border border-tertiary/50'>
                    <div className='text-2xl font-bold'>{blogPosts.length}</div>
                    <div className='text-text/60 text-sm'>Blog Posts</div>
                </div>
                <div className='bg-background rounded-xl p-4 shadow-sm border border-tertiary/50'>
                    <div className='text-2xl font-bold'>{events.length}</div>
                    <div className='text-text/60 text-sm'>Events</div>
                </div>
            </div>

            {/* Tabs */}
            <div className='flex gap-2 overflow-x-auto py-1'>
                <button
                    onClick={() => setActiveTab("blog")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "blog"
                            ? "bg-primary text-white"
                            : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <FileText className='w-4 h-4' />
                    Blog ({blogPosts.length})
                </button>
                <button
                    onClick={() => setActiveTab("events")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "events"
                            ? "bg-primary text-white"
                            : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Calendar className='w-4 h-4' />
                    Events ({events.length})
                </button>
                <button
                    onClick={() => setActiveTab("reports")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "reports"
                            ? "bg-primary text-white"
                            : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Flag className='w-4 h-4' />
                    Reports
                </button>
            </div>

            {/* Blog Tab */}
            {activeTab === "blog" && (
                <div className='space-y-4'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <button
                            onClick={() => openBlogEditor()}
                            className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition'
                        >
                            <Plus className='w-4 h-4' />
                            New Blog Post
                        </button>
                        <p className='flex items-center gap-1.5 text-xs text-text/50'>
                            <ShieldAlert className='w-3.5 h-3.5' />
                            Review only — you can approve, reject or archive posts
                            you don&apos;t own, but not edit them.
                        </p>
                    </div>

                    {/* Status Filter Tabs */}
                    <div className='flex gap-2 overflow-x-auto py-1'>
                        {STATUS_FILTERS.map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-1.5 rounded-lg transition text-sm font-medium whitespace-nowrap ${
                                    statusFilter === status
                                        ? "bg-primary text-white"
                                        : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                                }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                {status !== "all" && ` (${blogPosts.filter(p => p.status === status).length})`}
                            </button>
                        ))}
                    </div>

                    {/* Blog Posts List */}
                    {filteredPosts.length === 0 ? (
                        <div className='text-center py-16'>
                            <FileText className='w-12 h-12 mx-auto text-text opacity-30 mb-4' />
                            <p className='text-text/60 text-lg'>
                                {statusFilter === "all"
                                    ? "No blog posts yet"
                                    : `No ${statusFilter} posts`}
                            </p>
                            <p className='text-text/40 text-sm mt-1'>
                                {statusFilter === "all"
                                    ? "Create your first blog post to get started."
                                    : "Try selecting a different filter."}
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {filteredPosts.map((post) => {
                                const own = isOwnPost(post)
                                return (
                                <div
                                    key={post.id}
                                    className='flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-background rounded-xl shadow-sm border border-tertiary/50'
                                >
                                    <div className='flex-1 min-w-0'>
                                        <h3 className='font-semibold truncate'>
                                            {post.title || "(untitled)"}
                                        </h3>
                                        <p className='text-sm text-text/60 truncate'>
                                            {post.excerpt}
                                        </p>
                                        <div className='flex items-center gap-2 mt-1 flex-wrap'>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs ${
                                                    post.status === "published"
                                                        ? "bg-green-500/20 text-green-600"
                                                        : post.status === "pending"
                                                          ? "bg-orange-500/20 text-orange-600"
                                                          : post.status === "rejected"
                                                            ? "bg-red-500/20 text-red-600"
                                                            : "bg-amber-500/20 text-amber-600"
                                                }`}
                                            >
                                                {post.status}
                                            </span>
                                            <span className='rounded-full bg-text/5 px-2 py-0.5 text-xs text-text/60'>
                                                {own ? "Your post" : "Community"}
                                            </span>
                                            <span className='text-xs text-text/40'>
                                                {post.created_at &&
                                                    new Date(
                                                        post.created_at
                                                    ).toLocaleDateString()}
                                            </span>
                                            {post.status === "rejected" && post.rejection_reason && (
                                                <span
                                                    className='text-xs text-red-500/80 truncate max-w-[240px]'
                                                    title={post.rejection_reason}
                                                >
                                                    Reason: {post.rejection_reason}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className='flex items-center gap-2 self-end sm:self-center'>
                                        <button
                                            onClick={() => setPreviewPost(post)}
                                            className='p-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition'
                                            title='Preview'
                                        >
                                            <Eye className='w-4 h-4' />
                                        </button>

                                        {/* Moderation actions (available to admins on any post) */}
                                        {(post.status === "pending" ||
                                            post.status === "rejected") && (
                                            <button
                                                onClick={() => setApprovalPost(post)}
                                                disabled={processing === post.id}
                                                className='flex items-center gap-1.5 px-3 py-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
                                                title='Approve & publish'
                                            >
                                                {processing === post.id ? (
                                                    <Loader2 className='w-4 h-4 animate-spin' />
                                                ) : (
                                                    <>
                                                        <CheckCircle className='w-4 h-4' />
                                                        <span className='text-sm font-medium'>Approve</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        {(post.status === "pending" ||
                                            post.status === "published") && (
                                            <button
                                                onClick={() => setRejectPost(post)}
                                                disabled={processing === post.id}
                                                className='p-2 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/20 transition disabled:opacity-50'
                                                title='Reject with reason'
                                            >
                                                <XCircle className='w-4 h-4' />
                                            </button>
                                        )}
                                        {post.status === "published" && (
                                            <button
                                                onClick={() => handleArchiveBlogPost(post.id)}
                                                disabled={processing === post.id}
                                                className='p-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition disabled:opacity-50'
                                                title='Archive'
                                            >
                                                {processing === post.id ? (
                                                    <Loader2 className='w-4 h-4 animate-spin' />
                                                ) : (
                                                    <Archive className='w-4 h-4' />
                                                )}
                                            </button>
                                        )}

                                        {/* Editing is restricted to the author */}
                                        {own && (
                                            <button
                                                onClick={() => openBlogEditor(post)}
                                                className='p-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition'
                                                title='Edit'
                                            >
                                                <Pencil className='w-4 h-4' />
                                            </button>
                                        )}
                                        {own && (
                                            <button
                                                onClick={() =>
                                                    handleDeleteBlogPost(post.id)
                                                }
                                                disabled={processing === post.id}
                                                className='p-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                                                title='Delete'
                                            >
                                                {processing === post.id ? (
                                                    <Loader2 className='w-4 h-4 animate-spin' />
                                                ) : (
                                                    <Trash2 className='w-4 h-4' />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            )}

            {/* Events Tab */}
            {activeTab === "events" && (
                <EventsManagement initialEvents={events} />
            )}

            {/* Reports Tab */}
            {activeTab === "reports" && <BlogReportsPanel />}

            {/* Blog Editor Full-Screen Overlay */}
            {showBlogEditor && (
                <div className='fixed inset-0 z-50'>
                    {/* Backdrop */}
                    <div
                        className='absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'
                        onClick={closeBlogEditor}
                    />

                    {/* Full-Screen Container */}
                    <div className='absolute inset-0 bg-background'>
                        <RichBlogEditor
                            post={editingBlogPost ?? undefined}
                            mode="full"
                            onSuccess={handleBlogSuccess}
                            onCancel={closeBlogEditor}
                        />
                    </div>
                </div>
            )}

            {/* Approve Confirmation Modal */}
            {approvalPost && (
                <ApprovePostModal
                    isOpen={!!approvalPost}
                    onClose={() => setApprovalPost(null)}
                    postTitle={approvalPost.title}
                    onConfirm={async () => {
                        await handleApproveBlogPost(approvalPost.id)
                        setApprovalPost(null)
                    }}
                />
            )}

            {/* Reject Modal */}
            {rejectPost && (
                <RejectPostModal
                    postTitle={rejectPost.title}
                    postId={rejectPost.id}
                    onClose={() => setRejectPost(null)}
                    onConfirm={(reason) => handleRejectBlogPost(rejectPost.id, reason)}
                    isProcessing={processing === rejectPost.id}
                />
            )}

            {/* Read-only preview modal */}
            {previewPost && (
                <BlogPostPreviewModal
                    post={previewPost}
                    onClose={() => setPreviewPost(null)}
                />
            )}
        </div>
    )
}
