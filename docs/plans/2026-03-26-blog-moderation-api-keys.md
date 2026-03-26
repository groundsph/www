# Blog Moderation Queue & API Keys Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dedicated blog moderation queue for reviewing community-submitted posts and add API key management for admins/moderators.

**Architecture:**
- Feature 1: New `/manage/moderation` page scoped to pending posts from regular users (role: `user`)
- Feature 2: New "API Keys" tab in Settings page using Better Auth's apiKey plugin

**Tech Stack:** Next.js App Router, Drizzle ORM, Better Auth, React, Tailwind CSS

---

## Feature 1: Blog Moderation Queue

### Task 1.1: Add Rejection Fields to Blog Posts Schema

**Files:**
- Modify: `db/schema/tables.ts:338-368`
- Modify: `db/schema/enums.ts:24-29`

**Step 1: Add rejection fields to blogPosts table**

```typescript
// In db/schema/tables.ts, add after llmReview field (line 353):
rejectionReason: text("rejection_reason"),
rejectedBy: uuid("rejected_by").references(() => profiles.id),
rejectedAt: timestamp("rejected_at", { withTimezone: true }),
```

**Step 2: Run database migration**

```bash
bun db-push
```

**Expected output:** Schema changes pushed to database successfully.

**Step 3: Commit schema changes**

```bash
git add db/schema/tables.ts
git commit -m "feat(db): add rejection fields to blog posts"
```

---

### Task 1.2: Create Server Actions for Moderation

**Files:**
- Create: `app/api/actions/moderation.ts`
- Modify: `app/api/actions/blog.ts:700-725`

**Step 1: Create moderation actions file**

```typescript
"use server"

import { db } from "@/db"
import { blogPosts, profiles } from "@/db/schema/tables"
import { eq, and } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export interface PendingBlogPost {
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

interface ModerationActionResult {
    success: boolean
    error?: string
}

async function isModerator(): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false
    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)
    const role = result[0]?.role
    return role === "admin" || role === "moderator"
}

export async function getPendingCommunityPosts(
    page: number = 1,
    pageSize: number = 20
): Promise<{ posts: PendingBlogPost[]; total: number; hasMore: boolean }> {
    if (!(await isModerator())) {
        throw new Error("Not authorized")
    }

    const offset = (page - 1) * pageSize

    const [postsResult, countResult] = await Promise.all([
        db
            .select({
                id: blogPosts.id,
                title: blogPosts.title,
                excerpt: blogPosts.excerpt,
                content: blogPosts.content,
                coverImage: blogPosts.coverImage,
                category: blogPosts.category,
                status: blogPosts.status,
                createdAt: blogPosts.createdAt,
                llmReview: blogPosts.llmReview,
                authorId: blogPosts.authorId,
            })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(
                and(
                    eq(blogPosts.status, "pending"),
                    eq(profiles.role, "user")
                )
            )
            .orderBy(blogPosts.createdAt)
            .limit(pageSize)
            .offset(offset),
        db
            .select({ count: sql<number>`count(*)` })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(
                and(
                    eq(blogPosts.status, "pending"),
                    eq(profiles.role, "user")
                )
            ),
    ])

    const authorIds = [...new Set(postsResult.map((p) => p.authorId))]
    const authors = await db
        .select({
            id: profiles.id,
            displayName: profiles.displayName,
            username: profiles.username,
            avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(sql`${profiles.id} IN ${authorIds}`)

    const authorMap = new Map(authors.map((a) => [a.id, a]))

    const posts: PendingBlogPost[] = postsResult.map((post) => ({
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        category: post.category,
        status: post.status,
        createdAt: post.createdAt,
        llmReview: post.llmReview as Record<string, unknown> | null,
        author: authorMap.get(post.authorId)!,
    }))

    const total = countResult[0]?.count ?? 0

    return {
        posts,
        total,
        hasMore: offset + pageSize < total,
    }
}

export async function rejectBlogPost(
    postId: string,
    reason: string
): Promise<ModerationActionResult> {
    const user = await getCurrentUser()
    if (!user || !(await isModerator())) {
        return { success: false, error: "Not authorized" }
    }

    if (!reason || reason.trim().length < 5) {
        return { success: false, error: "Rejection reason must be at least 5 characters" }
    }

    const existing = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(eq(blogPosts.id, postId))
        .limit(1)

    if (!existing[0]) {
        return { success: false, error: "Post not found" }
    }

    await db
        .update(blogPosts)
        .set({
            status: "archived",
            rejectionReason: reason.trim(),
            rejectedBy: user.id,
            rejectedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(blogPosts.id, postId))

    revalidatePath("/manage/moderation")
    revalidatePath("/blog")

    return { success: true }
}

export async function getModerationStats(): Promise<{
    pending: number
    approved: number
    rejected: number
}> {
    if (!(await isModerator())) {
        throw new Error("Not authorized")
    }

    const [pending, approved, rejected] = await Promise.all([
        db
            .select({ count: sql<number>`count(*)` })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(and(eq(blogPosts.status, "pending"), eq(profiles.role, "user"))),
        db
            .select({ count: sql<number>`count(*)` })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(and(eq(blogPosts.status, "published"), eq(profiles.role, "user"))),
        db
            .select({ count: sql<number>`count(*)` })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(
                and(eq(blogPosts.status, "archived"), sql`${blogPosts.rejectionReason} IS NOT NULL`)
            ),
    ])

    return {
        pending: pending[0]?.count ?? 0,
        approved: approved[0]?.count ?? 0,
        rejected: rejected[0]?.count ?? 0,
    }
}
```

**Step 2: Add sql import to moderation.ts**

Add at top of file:
```typescript
import { sql } from "drizzle-orm"
```

**Step 3: Run tests**

```bash
bun test app/api/actions/__tests__/moderation.test.ts
```

**Expected:** Tests pass (create basic tests for the actions).

**Step 4: Commit moderation actions**

```bash
git add app/api/actions/moderation.ts
git commit -m "feat(actions): add blog moderation server actions"
```

---

### Task 1.3: Create Moderation Page Route

**Files:**
- Create: `app/manage/moderation/page.tsx`

**Step 1: Create moderation page**

```typescript
import { redirect } from "next/navigation"
import { isAdmin } from "@/app/api/actions/admin"
import { getPendingCommunityPosts, getModerationStats } from "@/app/api/actions/moderation"
import ModerationQueue from "@/components/manage/ModerationQueue"

export const metadata = {
    title: "Moderation Queue | Manage",
    description: "Review and moderate community-submitted blog posts",
}

export default async function ModerationPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const [initialPosts, stats] = await Promise.all([
        getPendingCommunityPosts(1, 20),
        getModerationStats(),
    ])

    return (
        <ModerationQueue
            initialPosts={initialPosts.posts}
            initialTotal={initialPosts.total}
            initialStats={stats}
        />
    )
}
```

**Step 2: Commit moderation page**

```bash
git add app/manage/moderation/page.tsx
git commit -m "feat(mod): add moderation queue page route"
```

---

### Task 1.4: Create ModerationQueue Component

**Files:**
- Create: `components/manage/ModerationQueue.tsx`
- Create: `components/manage/RejectPostModal.tsx`
- Create: `components/manage/PostPreviewModal.tsx`

**Step 1: Create ModerationQueue component**

```typescript
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    FileText,
    Clock,
    CheckCircle,
    XCircle,
    Eye,
    ChevronLeft,
    ChevronRight,
    Loader2,
} from "lucide-react"
import { useNotification } from "@/components/layout/NotificationProvider"
import type { PendingBlogPost } from "@/app/api/actions/moderation"
import RejectPostModal from "./RejectPostModal"
import PostPreviewModal from "./PostPreviewModal"

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
    const { addNotification } = useNotification()
    const [posts, setPosts] = useState(initialPosts)
    const [total] = useState(initialTotal)
    const [stats, setStats] = useState(initialStats)
    const [page, setPage] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [processingPost, setProcessingPost] = useState<string | null>(null)
    
    const [previewPost, setPreviewPost] = useState<PendingBlogPost | null>(null)
    const [rejectPost, setRejectPost] = useState<PendingBlogPost | null>(null)

    const refreshPosts = async () => {
        setIsLoading(true)
        try {
            const { getPendingCommunityPosts: fetchPosts } = await import(
                "@/app/api/actions/moderation"
            )
            const result = await fetchPosts(page, 20)
            setPosts(result.posts)
        } catch (error) {
            addNotification("Failed to refresh posts", "error")
        } finally {
            setIsLoading(false)
        }
    }

    const handleApprove = async (postId: string) => {
        setProcessingPost(postId)
        try {
            const { approveBlogPost } = await import("@/app/api/actions/blog")
            const result = await approveBlogPost(postId)
            if (result.success) {
                setPosts((prev) => prev.filter((p) => p.id !== postId))
                setStats((prev) => ({
                    ...prev,
                    pending: prev.pending - 1,
                    approved: prev.approved + 1,
                }))
                addNotification("Post approved successfully", "success")
            } else {
                addNotification(result.error || "Failed to approve", "error")
            }
        } catch (error) {
            addNotification("Failed to approve post", "error")
        } finally {
            setProcessingPost(null)
        }
    }

    const handleReject = async (postId: string, reason: string) => {
        setProcessingPost(postId)
        try {
            const { rejectBlogPost } = await import("@/app/api/actions/moderation")
            const result = await rejectBlogPost(postId, reason)
            if (result.success) {
                setPosts((prev) => prev.filter((p) => p.id !== postId))
                setStats((prev) => ({
                    ...prev,
                    pending: prev.pending - 1,
                    rejected: prev.rejected + 1,
                }))
                setRejectPost(null)
                addNotification("Post rejected", "success")
            } else {
                addNotification(result.error || "Failed to reject", "error")
            }
        } catch (error) {
            addNotification("Failed to reject post", "error")
        } finally {
            setProcessingPost(null)
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
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-text">
                    Moderation Queue
                </h1>
                <p className="text-text/60 mt-1">
                    Review and moderate community-submitted blog posts
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-background rounded-xl p-4 shadow-sm border border-tertiary/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                            <Clock className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.pending}</div>
                            <div className="text-text/60 text-sm">Pending</div>
                        </div>
                    </div>
                </div>
                <div className="bg-background rounded-xl p-4 shadow-sm border border-tertiary/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.approved}</div>
                            <div className="text-text/60 text-sm">Approved</div>
                        </div>
                    </div>
                </div>
                <div className="bg-background rounded-xl p-4 shadow-sm border border-tertiary/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.rejected}</div>
                            <div className="text-text/60 text-sm">Rejected</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {posts.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16"
                        >
                            <FileText className="w-12 h-12 mx-auto text-text opacity-30 mb-4" />
                            <p className="text-text/60 text-lg">No pending posts</p>
                            <p className="text-text/40 text-sm mt-1">
                                All community submissions have been reviewed
                            </p>
                        </motion.div>
                    ) : (
                        posts.map((post) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                layout
                                className="bg-background rounded-xl shadow-sm border border-tertiary/50 overflow-hidden"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate">
                                                {post.title}
                                            </h3>
                                            <p className="text-sm text-text/60 line-clamp-2 mt-1">
                                                {post.excerpt || post.content.slice(0, 150)}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <div className="flex items-center gap-2">
                                                    {post.author.avatarUrl ? (
                                                        <img
                                                            src={post.author.avatarUrl}
                                                            alt={post.author.displayName}
                                                            className="w-5 h-5 rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-tertiary" />
                                                    )}
                                                    <span className="text-sm text-text/60">
                                                        {post.author.displayName}
                                                    </span>
                                                </div>
                                                <span className="text-text/30">•</span>
                                                <span className="text-sm text-text/60">
                                                    {post.category}
                                                </span>
                                                <span className="text-text/30">•</span>
                                                <span className="text-sm text-text/60">
                                                    {formatDate(post.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => setPreviewPost(post)}
                                                className="p-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition"
                                                title="Preview"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleApprove(post.id)}
                                                disabled={processingPost === post.id}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50"
                                            >
                                                {processingPost === post.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="w-4 h-4" />
                                                )}
                                                <span className="text-sm font-medium hidden sm:inline">
                                                    Approve
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => setRejectPost(post)}
                                                disabled={processingPost === post.id}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50"
                                            >
                                                <XCircle className="w-4 h-4" />
                                                <span className="text-sm font-medium hidden sm:inline">
                                                    Reject
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {total > 20 && (
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1 || isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-tertiary/30 rounded-lg hover:bg-tertiary transition disabled:opacity-50"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                    </button>
                    <span className="text-text/60">
                        Page {page} of{Math.ceil(total / 20)}
                    </span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= Math.ceil(total / 20) || isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-tertiary/30 rounded-lg hover:bg-tertiary transition disabled:opacity-50"
                    >
                        Next
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {previewPost && (
                <PostPreviewModal
                    post={previewPost}
                    onClose={() => setPreviewPost(null)}
                    onApprove={() => handleApprove(previewPost.id)}
                    onReject={() => {
                        setPreviewPost(null)
                        setRejectPost(previewPost)
                    }}
                    isProcessing={processingPost === previewPost.id}
                />
            )}

            {rejectPost && (
                <RejectPostModal
                    postTitle={rejectPost.title}
                    postId={rejectPost.id}
                    onClose={() => setRejectPost(null)}
                    onConfirm={(reason) => handleReject(rejectPost.id, reason)}
                    isProcessing={processingPost === rejectPost.id}
                />
            )}
        </div>
    )
}
```

**Step 2: Create RejectPostModal component**

```typescript
"use client"

import { useState } from "react"
import { X, XCircle, Loader2 } from "lucide-react"

interface RejectPostModalProps {
    postTitle: string
    postId: string
    onClose: () => void
    onConfirm: (reason: string) => Promise<void>
    isProcessing: boolean
}

export default function RejectPostModal({
    postTitle,
    onClose,
    onConfirm,
    isProcessing,
}: RejectPostModalProps) {
    const [reason, setReason] = useState("")
    const [error, setError] = useState("")

    const handleSubmit = async () => {
        if (reason.trim().length < 5) {
            setError("Please provide a reason (at least 5 characters)")
            return
        }
        await onConfirm(reason.trim())
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={isProcessing ? undefined : onClose}
            />
            <div className="relative w-full max-w-md bg-background rounded-2xl shadow-xl ring-1 ring-text/10 overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                                <XCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-text">
                                    Reject Blog Post
                                </h3>
                                <p className="text-xs text-text/60 truncate max-w-[200px]">
                                    {postTitle}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            className="p-2 text-text/40 hover:text-text hover:bg-text/5 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Rejection Reason <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value)
                                    setError("")
                                }}
                                placeholder="Explain why this post was rejected..."
                                rows={4}
                                className="w-full px-4 py-3 bg-text/5 border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                                disabled={isProcessing}
                            />
                            {error && (
                                <p className="text-red-500 text-sm mt-1">{error}</p>
                            )}
                        </div>
                        <p className="text-sm text-text/60">
                            The author will be notified with this reason.
                        </p>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            className="flex-1 px-4 py-2 text-sm font-medium text-text/60 hover:text-text hover:bg-text/5 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isProcessing}
                            className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Rejecting...
                                </>
                            ) : (
                                "Reject Post"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
```

**Step 3: Create PostPreviewModal component**

```typescript
"use client"

import { X, CheckCircle, XCircle, Loader2 } from "lucide-react"
import type { PendingBlogPost } from "@/app/api/actions/moderation"

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
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={isProcessing ? undefined : onClose}
            />
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-background rounded-2xl shadow-xl ring-1 ring-text/10 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-text/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-text">
                                {post.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-tertiary px-2 py-0.5 rounded-full">
                                    {post.category}
                                </span>
                                <span className="text-xs text-text/60">
                                    by {post.author.displayName}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            className="p-2 text-text/40 hover:text-text hover:bg-text/5 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {post.coverImage && (
                        <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-full h-48 object-cover rounded-lg mb-6"
                        />
                    )}
                    {post.excerpt && (
                        <p className="text-text/80 text-lg mb-4">{post.excerpt}</p>
                    )}
                    <div className="prose prose-sm max-w-none">
                        {post.content}
                    </div>
                </div>

                {post.llmReview && (
                    <div className="p-4 bg-tertiary/20 border-t border-text/10">
                        <h4 className="text-sm font-medium text-text/60 mb-2">
                            AI Content Check
                        </h4>
                        <div className="flex items-center gap-4">
                            <span
                                className={`text-sm ${
                                    (post.llmReview as { approved: boolean }).approved
                                        ? "text-green-600"
                                        : "text-orange-600"
                                }`}
                            >
                                {(post.llmReview as { approved: boolean }).approved
                                    ? "✓ Approved"
                                    : "⚠ Issues detected"}
                            </span>
                            {(post.llmReview as { issues?: string[] }).issues &&
                                (post.llmReview as { issues: string[] }).issues.length > 0 && (
                                    <span className="text-sm text-text/60">
                                        {(post.llmReview as { issues: string[] }).issues.join(", ")}
                                    </span>
                                )}
                        </div>
                    </div>
                )}

                <div className="p-6 border-t border-text/10 flex gap-3">
                    <button
                        onClick={onReject}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 text-sm font-medium bg-red-500/10 text-red-600 rounded-xl hover:bg-red-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <XCircle className="w-4 h-4" />
                        Reject
                    </button>
                    <button
                        onClick={onApprove}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Approving...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Approve Post
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
```

**Step 4: Commit moderation components**

```bash
git add components/manage/ModerationQueue.tsx components/manage/RejectPostModal.tsx components/manage/PostPreviewModal.tsx
git commit -m "feat(ui): add moderation queue components"
```

---

### Task 1.5: Add Moderation Link to Manage Dashboard

**Files:**
- Modify: `app/manage/page.tsx:36-60`

**Step 1: Add moderation category to manage dashboard**

```typescript
// In app/manage/page.tsx, add after the "Cafes" category (line 45):
{
    name: "Moderation",
    description: "Review and moderate community-submitted blog posts.",
    href: "/manage/moderation",
    icon: <ShieldCheck className="w-6 h-6" />,
    color: "bg-red-500/10 text-red-700",
    badge: pendingCommunityPosts > 0 ? pendingCommunityPosts : undefined,
},
```

**Step 2: Import ShieldCheck icon**

Add `ShieldCheck` to the icons import atthe top of the file.

**Step 3: Fetch pending community posts count**

Add to the page component to fetch and display pending count.

**Step 4: Commit manage dashboard update**

```bash
git add app/manage/page.tsx
git commit -m "feat(nav): add moderation link to manage dashboard"
```

---

### Task 1.6: Add User Notification for Blog Approval/Rejection

**Files:**
- Create: `app/api/actions/user-notifications.ts`
- Modify: `app/api/actions/moderation.ts`

**Step 1: Create notifications table in schema**

```typescript
// Add to db/schema/tables.ts:
export const notifications = pgTable("notifications", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "blog_approved", "blog_rejected", etc.
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: jsonb("data"), // Additional context (postId, reason, etc.)
    read: boolean("read").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
    userIdIdx: index("notifications_userId_idx").on(table.userId),
}))
```

**Step 2: Create notification actions file**

Create `app/api/actions/user-notifications.ts` with:
- `createNotification()` - Create a new notification
- `getUserNotifications()` - Get user's notifications
- `markNotificationRead()` - Mark as read
- `markAllNotificationsRead()` - Mark all as read

**Step 3: Hook notifications into moderation actions**

Update `rejectBlogPost()` to create a notification for the author.

**Step 4: Run database migration**

```bash
bun db-push
```

**Step 5: Commit notifications**

```bash
git add db/schema/tables.ts app/api/actions/user-notifications.ts app/api/actions/moderation.ts
git commit -m "feat(notifications): add user notifications for blog moderation"
```

---

## Feature 2: API Keys for Admins/Moderators

### Task 2.1: Install Better Auth API Key Plugin

**Files:**
- Modify: `lib/auth.ts`
- Modify: `lib/auth-client.ts`
- Modify: `db/schema/auth.ts`

**Step 1: Install the API key plugin**

```bash
bun add better-auth
```

**Step 2: Import and add apiKey plugin to auth.ts**

```typescript
// In lib/auth.ts, add import:
import { apiKey } from "better-auth/plugins"

// In plugins array, add:
plugins: [
    admin({
        adminUserIds: process.env.ADMIN_USER_IDS?.split(",") || [],
    }),
    passkey(),
    lastLoginMethod(),
    apiKey(), // Add this
],
```

**Step 3: Add apiKey client plugin in auth-client.ts**

```typescript
// In lib/auth-client.ts:
import { apiKeyClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000",
    plugins: [
        passkeyClient(),
        adminClient(),
        lastLoginMethodClient(),
        apiKeyClient(), // Add this
    ],
})
```

**Step 4: Run database migration**

The apiKey plugin will create its own tables via Drizzle adapter.

```bash
bun db-push
```

**Step 5: Commit auth changes**

```bash
git add lib/auth.ts lib/auth-client.ts
git commit -m "feat(auth): add better-auth API key plugin"
```

---

### Task 2.2: Create API Key Management Actions

**Files:**
- Create: `app/api/actions/api-keys.ts`

**Step 1: Create API key actions file**

```typescript
"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { profiles } from "@/db/schema/tables"
import { eq } from "drizzle-orm"

const MAX_API_KEYS_PER_USER = 3

export interface ApiKeyInfo {
    id: string
    name: string | null
    prefix: string
    createdAt: Date
    expiresAt: Date | null
}

interface ApiKeyActionResult {
    success: boolean
    error?: string
    data?: {
        key?: string
        keys?: ApiKeyInfo[]
    }
}

async function isAdminOrModerator(): Promise<boolean> {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    if (!session?.user) return false

    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, session.user.id))
        .limit(1)

    const role = result[0]?.role
    return role === "admin" || role === "moderator"
}

export async function listApiKeys(): Promise<ApiKeyActionResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    try {
        const keys = await auth.api.listApiKeys({
            headers: await headers(),
        })

        return {
            success: true,
            data: {
                keys: keys.map((k) => ({
                    id: k.id,
                    name: k.name,
                    prefix: k.prefix,
                    createdAt: k.createdAt,
                    expiresAt: k.expiresAt,
                })),
            },
        }
    } catch (error) {
        console.error("Error listing API keys:", error)
        return { success: false, error: "Failed to list API keys" }
    }
}

export async function createApiKey(
    name?: string,
   expiresAt?: Date
): Promise<ApiKeyActionResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    try {
        const existingKeys = await auth.api.listApiKeys({
            headers: await headers(),
        })

        if (existingKeys.length >= MAX_API_KEYS_PER_USER) {
            return {
                success: false,
                error: `Maximum of ${MAX_API_KEYS_PER_USER} API keys allowed`,
            }
        }

        const result = await auth.api.createApiKey({
            headers: await headers(),
            body: {
                name: name || undefined,
                expiresIn: expiresAt
                    ? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
                    : undefined,
            },
        })

        return {
            success: true,
            data: {
                key: result.key,
            },
        }
    } catch (error) {
        console.error("Error creating API key:", error)
        return { success: false, error: "Failed to create API key" }
    }
}

export async function deleteApiKey(keyId: string): Promise<ApiKeyActionResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    try {
        await auth.api.deleteApiKey({
            headers: await headers(),
            body: {
                keyId,
            },
        })

        return { success: true }
    } catch (error) {
        console.error("Error deleting API key:", error)
        return { success: false, error: "Failed to delete API key" }
    }
}
```

**Step 2: Commit API key actions**

```bash
git add app/api/actions/api-keys.ts
git commit -m "feat(actions): add API key management server actions"
```

---

### Task 2.3: Create API Keys Settings Tab

**Files:**
- Modify: `components/profile/Settings.tsx`

**Step 1: Add API Keys tab type**

```typescript
// In Settings.tsx, update TabType:
type TabType = "password" | "sessions" | "passkeys" | "connected-accounts" | "privacy" | "api-keys"
```

**Step 2: Add API Keys tab to tabs array**

```typescript
{
    id: "api-keys" as TabType,
    label: "API Keys",
    icon: Key,
    description: "Manage API access keys",
},
```

**Step 3: Add API keys state and fetch logic**

```typescript
// Add state for API keys:
const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
const [loadingApiKeys, setLoadingApiKeys] = useState(true)
const [creatingKey, setCreatingKey] = useState(false)
const [deletingKey, setDeletingKey] = useState<string | null>(null)
const [newKeyName, setNewKeyName] = useState("")
const [newKeyExpiration, setNewKeyExpiration] = useState<string>("")
const [createdKey, setCreatedKey] = useState<string | null>(null)

// Add fetch effect:
useEffect(() => {
    const fetchApiKeys = async () => {
        try {
            const result = await listApiKeys()
            if (result.success && result.data?.keys) {
                setApiKeys(result.data.keys)
            }
        } catch (error) {
            console.error("Error fetching API keys:", error)
        } finally {
            setLoadingApiKeys(false)
        }
    }
    fetchApiKeys()
}, [activeTab])
```

**Step 4: Add API Keys tab content**

Add the JSX for the API Keys tab with:
- List of existing keys (masked)
- Create new key form (name optional, expiration optional)
- Delete key button
- Display created key once (show once, then mask)

**Step 5: Import ApiKeyInfo type and actions**

```typescript
import {
    listApiKeys,
    createApiKey,
    deleteApiKey,
    type ApiKeyInfo,
} from "@/app/api/actions/api-keys"
```

**Step 6: Commit Settings tab update**

```bash
git add components/profile/Settings.tsx
git commit -m "feat(settings): add API Keys management tab"
```

---

### Task 2.4: Add Role-Based Visibility for API Keys Tab

**Files:**
- Modify: `components/profile/Settings.tsx`

**Step 1: Fetch user role and conditionally show tab**

```typescript
// Add role state:
const [userRole, setUserRole] = useState<string | null>(null)

// Fetch role on mount:
useEffect(() => {
    const fetchRole = async () => {
        const result = await getUserRole()
        setUserRole(result)
    }
    fetchRole()
}, [])

// Conditionally include API Keys tab:
const tabs = [
    // ...existing tabs
    ...(userRole === "admin" || userRole === "moderator"
        ? [{
            id: "api-keys" as TabType,
            label: "API Keys",
            icon: Key,
            description: "Manage API access keys",
        }]
        : []),
]
```

**Step 2: Import getUserRole action**

```typescript
import { getUserRole } from "@/app/api/actions/admin"
```

**Step 3: Commit role-based visibility**

```bash
git add components/profile/Settings.tsx
git commit -m "feat(settings): restrict API Keys tab to admins and moderators"
```

---

### Task 2.5: Write Tests for API Key Actions

**Files:**
- Create: `app/api/actions/__tests__/api-keys.test.ts`

**Step 1: Create test file**

```typescript
import { describe, it, expect, beforeEach, mock } from "bun:test"
import { listApiKeys, createApiKey, deleteApiKey } from "../api-keys"

// Mock auth and db
mock.module("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: mock.fn(),
            listApiKeys: mock.fn(),
            createApiKey: mock.fn(),
            deleteApiKey: mock.fn(),
        },
    },
}))

describe("API Key Actions", () => {
    describe("listApiKeys", () => {
        it("returns error if user is not authorized", async () => {
            // Test unauthorized user
        })

        it("returns list of API keys for authorized user", async () => {
            // Test authorized user
        })
    })

    describe("createApiKey", () => {
        it("returns error if user has max keys", async () => {
            // Test max keys limit
        })

        it("creates key successfully", async () => {
            // Test successful creation
        })
    })

    describe("deleteApiKey", () => {
        it("deletes key successfully", async () => {
            // Test deletion
        })
    })
})
```

**Step 2: Run tests**

```bash
bun test app/api/actions/__tests__/api-keys.test.ts
```

**Step 3: Commit tests**

```bash
git add app/api/actions/__tests__/api-keys.test.ts
git commit -m "test(api-keys): add tests for API key actions"
```

---

## Final Integration

### Task 3.1: Run All Tests

**Step 1: Run full test suite**

```bash
bun test
```

**Expected:** All tests pass.

**Step 2: Run type check**

```bash
bun lint
```

**Expected:** No errors.

---

### Task 3.2: Manual Testing Checklist

**Blog Moderation Queue:**
- [ ] Admin can access `/manage/moderation`
- [ ] Moderator can access `/manage/moderation`
- [ ] Regular user cannot access `/manage/moderation`
- [ ] Pending posts from regular users appear in queue
- [ ] Posts from writers/admins do NOT appear in queue
- [ ] Approve button publishes post
- [ ] Reject button opens modal with reason input
- [ ] Rejected posts are archived with reason
- [ ] Pagination works for many posts
- [ ] Stats show correct counts

**API Keys:**
- [ ] Admin sees API Keys tab in settings
- [ ] Moderator sees API Keys tab in settings
- [ ] Regular user does NOT see API Keys tab
- [ ] Can create up to 3 keys
- [ ] Cannot create more than 3 keys
- [ ] Key displays masked after creation
- [ ] Can delete keys
- [ ] Expiration date is optional
- [ ] Key name is optional

---

### Task 3.3: Final Commit

**Step 1: Stage all changes**

```bash
git add .
```

**Step 2: Create feature commit**

```bash
git commit -m "feat: add blog moderation queue and API key management

- Add dedicated /manage/moderation page for reviewing community posts
- Add reject functionality with reason for blog posts
- Add user notifications for approval/rejection
- Add API key management in settings (admin/moderator only)
- Max 3 API keys per user with optional expiration"
```