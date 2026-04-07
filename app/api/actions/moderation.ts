"use server"

import { db } from "@/db"
import { blogPosts, profiles } from "@/db/schema"
import { eq, and, desc, count, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { createNotification } from "./user-notifications"
import { logSystemAction } from "./system-logs"

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
        return { posts: [], total: 0, hasMore: false }
    }

    const offset = (page - 1) * pageSize

    try {
        // Get total count of pending posts by regular users
        const countResult = await db
            .select({ count: count() })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(
                and(
                    eq(blogPosts.status, "pending"),
                    eq(profiles.role, "user")
                )
            )

        const total = countResult[0]?.count ?? 0

        // Get pending posts with author info
        const posts = await db
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
                authorId: profiles.id,
                authorDisplayName: profiles.displayName,
                authorUsername: profiles.username,
                authorAvatarUrl: profiles.avatarUrl,
            })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(
                and(
                    eq(blogPosts.status, "pending"),
                    eq(profiles.role, "user")
                )
            )
            .orderBy(desc(blogPosts.createdAt))
            .limit(pageSize)
            .offset(offset)

        const formattedPosts: PendingBlogPost[] = posts.map((post) => ({
            id: post.id,
            title: post.title,
            excerpt: post.excerpt,
            content: post.content,
            coverImage: post.coverImage,
            category: post.category ?? "community",
            status: post.status ?? "pending",
            createdAt: post.createdAt,
            author: {
                id: post.authorId,
                displayName: post.authorDisplayName,
                username: post.authorUsername,
                avatarUrl: post.authorAvatarUrl,
            },
            llmReview: post.llmReview as Record<string, unknown> | null,
        }))

        return {
            posts: formattedPosts,
            total,
            hasMore: offset + posts.length < total,
        }
    } catch (error) {
        console.error("Error fetching pending community posts:", error)
        return { posts: [], total: 0, hasMore: false }
    }
}

export async function rejectBlogPost(
    postId: string,
    reason: string
): Promise<ModerationActionResult> {
    if (!(await isModerator())) {
        return { success: false, error: "Not authorized" }
    }

    if (!reason || reason.trim().length < 5) {
        return { success: false, error: "Rejection reason must be at least 5 characters" }
    }

    const user = await getCurrentUser()
    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    try {
        const existing = await db
            .select({ id: blogPosts.id, slug: blogPosts.slug, authorId: blogPosts.authorId, title: blogPosts.title })
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
                rejectionReason: reason,
                rejectedBy: user.id,
                rejectedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(blogPosts.id, postId))

        // Create notification for the author
        await createNotification({
            userId: existing[0].authorId,
            type: "blog_rejected",
            title: "Blog Post Rejected",
            message: `Your blog post "${existing[0].title}" has been rejected. Reason: ${reason}`,
            data: {
                postId: existing[0].id,
                slug: existing[0].slug,
                reason: reason,
            },
        })

        revalidatePath("/admin/moderation")
        revalidatePath("/blog")

        // Log the blog post rejection
        await logSystemAction(
            "reject",
            "blog",
            postId,
            { status: "pending" },
            { status: "archived", rejectionReason: reason },
            { reason: `Blog post rejected: ${reason}`, postTitle: existing[0].title }
        )

        return { success: true }
    } catch (error) {
        console.error("Error rejecting blog post:", error)
        return { success: false, error: "Failed to reject post" }
    }
}

export async function getModerationStats(): Promise<{
    pending: number
    approved: number
    rejected: number
}> {
    if (!(await isModerator())) {
        return { pending: 0, approved: 0, rejected: 0 }
    }

    try {
        // Pending: posts by regular users with pending status
        const pendingResult = await db
            .select({ count: count() })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(
                and(
                    eq(blogPosts.status, "pending"),
                    eq(profiles.role, "user")
                )
            )

        // Approved: posts by regular users that are published
        const approvedResult = await db
            .select({ count: count() })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(
                and(
                    eq(blogPosts.status, "published"),
                    eq(profiles.role, "user")
                )
            )

        // Rejected: posts by regular users that are archived and have rejection info
        const rejectedResult = await db
            .select({ count: count() })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(
                and(
                    eq(blogPosts.status, "archived"),
                    eq(profiles.role, "user"),
                    sql`${blogPosts.rejectedBy} IS NOT NULL`
                )
            )

        return {
            pending: pendingResult[0]?.count ?? 0,
            approved: approvedResult[0]?.count ?? 0,
            rejected: rejectedResult[0]?.count ?? 0,
        }
    } catch (error) {
        console.error("Error fetching moderation stats:", error)
        return { pending: 0, approved: 0, rejected: 0 }
    }
}
