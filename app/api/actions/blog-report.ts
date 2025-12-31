"use server"

import { db } from "@/db"
import { blogReports, blogPosts, profiles } from "@/db/schema"
import { eq, desc, and, count as drizzleCount } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { BlogReport, BlogReportInput, BLOG_REPORT_REASONS } from "@/utils/types/blog-report"
import { notifyDiscordBlogReport } from "@/app/api/actions/notify"

// ============================================
// Helper Functions
// ============================================

async function isAdminOrModerator(): Promise<boolean> {
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

async function getCurrentUserId(): Promise<string | null> {
    const user = await getCurrentUser()
    return user?.id ?? null
}

// ============================================
// Report Actions
// ============================================

export interface BlogReportResult {
    success: boolean
    error?: string
}

/**
 * Report a blog post for inappropriate content
 */
export async function reportBlogPost(input: BlogReportInput): Promise<BlogReportResult> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: "You must be logged in to report content" }
    }

    // Verify the blog post exists and is published
    const postResult = await db
        .select({
            id: blogPosts.id,
            authorId: blogPosts.authorId,
            status: blogPosts.status,
            title: blogPosts.title,
            slug: blogPosts.slug,
        })
        .from(blogPosts)
        .where(eq(blogPosts.id, input.blog_post_id))
        .limit(1)

    const post = postResult[0]
    if (!post) {
        return { success: false, error: "Blog post not found" }
    }

    // Prevent self-reporting
    if (post.authorId === userId) {
        return { success: false, error: "You cannot report your own post" }
    }

    // Check if user already reported this post
    const existingResult = await db
        .select({ id: blogReports.id })
        .from(blogReports)
        .where(and(
            eq(blogReports.blogPostId, input.blog_post_id),
            eq(blogReports.reporterId, userId)
        ))
        .limit(1)

    if (existingResult[0]) {
        return { success: false, error: "You have already reported this post" }
    }

    // Insert the report
    try {
        await db.insert(blogReports).values({
            blogPostId: input.blog_post_id,
            reporterId: userId,
            reason: input.reason,
            details: input.details || null,
            status: "pending",
        })
    } catch (error) {
        console.error("Error creating blog report:", error)
        return { success: false, error: "Failed to submit report" }
    }

    // Notify Discord (fire and forget to not block response)
    const reporterResult = await db
        .select({ displayName: profiles.displayName, username: profiles.username })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)

    const reporter = reporterResult[0]
    const reporterName = reporter?.displayName
        ? `${reporter.displayName} (@${reporter.username})`
        : 'Anonymous User'

    const reasonLabel = BLOG_REPORT_REASONS.find(r => r.value === input.reason)?.label || input.reason

    // Don't await this to keep UI responsive
    notifyDiscordBlogReport(
        { title: post.title, slug: post.slug },
        reasonLabel,
        reporterName
    ).catch(err => console.error("Error sending Discord notification:", err))

    return { success: true }
}

// ============================================
// Admin/Moderator Actions
// ============================================

export interface PaginatedBlogReportsResult {
    reports: BlogReport[]
    total: number
    page: number
    pageSize: number
    hasMore: boolean
}

export interface BlogReportFilters {
    status?: "pending" | "reviewed" | "dismissed"
    page?: number
    pageSize?: number
}

/**
 * Get blog reports for admin/moderator review
 */
export async function getBlogReports(
    filters: BlogReportFilters = {}
): Promise<PaginatedBlogReportsResult> {
    if (!(await isAdminOrModerator())) {
        return { reports: [], total: 0, page: 1, pageSize: 20, hasMore: false }
    }

    const { status, page = 1, pageSize = 20 } = filters
    const offset = (page - 1) * pageSize

    // Build query
    const conditions = status ? [eq(blogReports.status, status)] : []

    // Get total count
    const countResult = await db
        .select({ count: drizzleCount() })
        .from(blogReports)
        .where(conditions.length > 0 ? and(...conditions) : undefined)

    const total = countResult[0]?.count ?? 0

    // Get reports with joins
    const result = await db
        .select({
            id: blogReports.id,
            blogPostId: blogReports.blogPostId,
            reporterId: blogReports.reporterId,
            reason: blogReports.reason,
            details: blogReports.details,
            status: blogReports.status,
            reviewedBy: blogReports.reviewedBy,
            reviewedAt: blogReports.reviewedAt,
            adminNotes: blogReports.adminNotes,
            createdAt: blogReports.createdAt,
            postId: blogPosts.id,
            postTitle: blogPosts.title,
            postSlug: blogPosts.slug,
            postAuthorId: blogPosts.authorId,
            postStatus: blogPosts.status,
            reporterDisplayName: profiles.displayName,
            reporterUsername: profiles.username,
        })
        .from(blogReports)
        .leftJoin(blogPosts, eq(blogReports.blogPostId, blogPosts.id))
        .leftJoin(profiles, eq(blogReports.reporterId, profiles.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(blogReports.createdAt))
        .limit(pageSize)
        .offset(offset)

    // Transform the data to match BlogReport type
    const reports: BlogReport[] = result.map(report => ({
        id: report.id,
        blog_post_id: report.blogPostId,
        reporter_id: report.reporterId,
        reason: report.reason,
        details: report.details,
        status: report.status as "pending" | "reviewed" | "dismissed",
        reviewed_by: report.reviewedBy,
        reviewed_at: report.reviewedAt?.toISOString() ?? null,
        admin_notes: report.adminNotes,
        created_at: report.createdAt?.toISOString() ?? null,
        blog_post: report.postId ? {
            id: report.postId,
            title: report.postTitle!,
            slug: report.postSlug!,
            author_id: report.postAuthorId!,
            status: report.postStatus ?? "draft",
        } : undefined,
        reporter: report.reporterDisplayName ? {
            id: report.reporterId,
            display_name: report.reporterDisplayName,
            username: report.reporterUsername!,
        } : undefined,
    }))

    return {
        reports,
        total,
        page,
        pageSize,
        hasMore: offset + pageSize < total,
    }
}

/**
 * Get count of pending blog reports
 */
export async function getPendingBlogReportsCount(): Promise<number> {
    if (!(await isAdminOrModerator())) {
        return 0
    }

    const result = await db
        .select({ count: drizzleCount() })
        .from(blogReports)
        .where(eq(blogReports.status, "pending"))

    return result[0]?.count ?? 0
}

export type ReportResolution = "review" | "dismiss"

/**
 * Resolve a blog report (mark as reviewed or dismissed)
 */
export async function resolveBlogReport(
    reportId: string,
    resolution: ReportResolution,
    adminNotes?: string
): Promise<BlogReportResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: "Not authenticated" }
    }

    // Get the report
    const reportResult = await db
        .select({ id: blogReports.id, blogPostId: blogReports.blogPostId, status: blogReports.status })
        .from(blogReports)
        .where(eq(blogReports.id, reportId))
        .limit(1)

    const report = reportResult[0]
    if (!report) {
        return { success: false, error: "Report not found" }
    }

    if (report.status !== "pending") {
        return { success: false, error: "Report has already been processed" }
    }

    const newStatus = resolution === "review" ? "reviewed" : "dismissed"

    // Update the report
    try {
        await db.update(blogReports)
            .set({
                status: newStatus,
                reviewedBy: userId,
                reviewedAt: new Date(),
                adminNotes: adminNotes || null,
            })
            .where(eq(blogReports.id, reportId))
    } catch (error) {
        console.error("Error resolving blog report:", error)
        return { success: false, error: "Failed to resolve report" }
    }

    // If marking as reviewed, also archive the blog post
    if (resolution === "review") {
        try {
            await db.update(blogPosts)
                .set({
                    status: "archived",
                    updatedAt: new Date(),
                })
                .where(eq(blogPosts.id, report.blogPostId))
        } catch (error) {
            console.error("Error archiving blog post:", error)
            // Don't fail the whole operation, report was still resolved
        }
    }

    return { success: true }
}

/**
 * Archive a blog post (for moderation)
 */
export async function archiveBlogPostForModeration(postId: string): Promise<BlogReportResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    try {
        await db.update(blogPosts)
            .set({
                status: "archived",
                updatedAt: new Date(),
            })
            .where(eq(blogPosts.id, postId))
    } catch (error) {
        console.error("Error archiving blog post:", error)
        return { success: false, error: "Failed to archive post" }
    }

    return { success: true }
}
