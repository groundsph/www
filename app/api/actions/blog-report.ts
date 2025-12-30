"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BlogReport, BlogReportInput, BlogReportReason } from "@/utils/types/blog-report"

// ============================================
// Helper Functions
// ============================================

async function isAdminOrModerator(): Promise<boolean> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

    return profile?.role === "admin" || profile?.role === "moderator"
}

async function getCurrentUserId(): Promise<string | null> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
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

    const supabase = await createClient()
    const adminClient = await createAdminClient()

    // Verify the blog post exists and is published
    const { data: post } = await supabase
        .from("blog_posts")
        .select("id, author_id, status")
        .eq("id", input.blog_post_id)
        .single()

    if (!post) {
        return { success: false, error: "Blog post not found" }
    }

    // Prevent self-reporting
    if (post.author_id === userId) {
        return { success: false, error: "You cannot report your own post" }
    }

    // Check if user already reported this post
    const { data: existingReport } = await adminClient
        .from("blog_reports")
        .select("id")
        .eq("blog_post_id", input.blog_post_id)
        .eq("reporter_id", userId)
        .single()

    if (existingReport) {
        return { success: false, error: "You have already reported this post" }
    }

    // Insert the report using admin client (to bypass RLS for insert)
    const { error } = await adminClient
        .from("blog_reports")
        .insert({
            blog_post_id: input.blog_post_id,
            reporter_id: userId,
            reason: input.reason,
            details: input.details || null,
            status: "pending",
        })

    if (error) {
        console.error("Error creating blog report:", error)
        return { success: false, error: "Failed to submit report" }
    }

    // TODO: Add Discord notification for blog reports

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

    const adminClient = await createAdminClient()

    let query = adminClient
        .from("blog_reports")
        .select(
            `
            id, blog_post_id, reporter_id, reason, details, status, 
            reviewed_by, reviewed_at, admin_notes, created_at,
            blog_post:blog_posts(id, title, slug, author_id, status),
            reporter:profiles!blog_reports_reporter_id_fkey(id, display_name, username)
        `,
            { count: "exact" }
        )
        .order("created_at", { ascending: false })

    if (status) {
        query = query.eq("status", status)
    }

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)

    if (error) {
        console.error("Error fetching blog reports:", error)
        return { reports: [], total: 0, page, pageSize, hasMore: false }
    }

    // Transform the data to match BlogReport type
    const reports: BlogReport[] = (data || []).map((report) => ({
        id: report.id,
        blog_post_id: report.blog_post_id,
        reporter_id: report.reporter_id,
        reason: report.reason,
        details: report.details,
        status: report.status as "pending" | "reviewed" | "dismissed",
        reviewed_by: report.reviewed_by,
        reviewed_at: report.reviewed_at,
        admin_notes: report.admin_notes,
        created_at: report.created_at,
        blog_post: Array.isArray(report.blog_post) ? report.blog_post[0] : report.blog_post,
        reporter: Array.isArray(report.reporter) ? report.reporter[0] : report.reporter,
    }))

    return {
        reports,
        total: count || 0,
        page,
        pageSize,
        hasMore: offset + pageSize < (count || 0),
    }
}

/**
 * Get count of pending blog reports
 */
export async function getPendingBlogReportsCount(): Promise<number> {
    if (!(await isAdminOrModerator())) {
        return 0
    }

    const adminClient = await createAdminClient()

    const { count, error } = await adminClient
        .from("blog_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")

    if (error) {
        console.error("Error counting pending blog reports:", error)
        return 0
    }

    return count || 0
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

    const adminClient = await createAdminClient()

    // Get the report
    const { data: report } = await adminClient
        .from("blog_reports")
        .select("id, blog_post_id, status")
        .eq("id", reportId)
        .single()

    if (!report) {
        return { success: false, error: "Report not found" }
    }

    if (report.status !== "pending") {
        return { success: false, error: "Report has already been processed" }
    }

    const newStatus = resolution === "review" ? "reviewed" : "dismissed"

    // Update the report
    const { error: updateError } = await adminClient
        .from("blog_reports")
        .update({
            status: newStatus,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            admin_notes: adminNotes || null,
        })
        .eq("id", reportId)

    if (updateError) {
        console.error("Error resolving blog report:", updateError)
        return { success: false, error: "Failed to resolve report" }
    }

    // If marking as reviewed, also archive the blog post
    if (resolution === "review") {
        const { error: archiveError } = await adminClient
            .from("blog_posts")
            .update({
                status: "archived",
                updated_at: new Date().toISOString()
            })
            .eq("id", report.blog_post_id)

        if (archiveError) {
            console.error("Error archiving blog post:", archiveError)
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

    const adminClient = await createAdminClient()

    const { error } = await adminClient
        .from("blog_posts")
        .update({
            status: "archived",
            updated_at: new Date().toISOString()
        })
        .eq("id", postId)

    if (error) {
        console.error("Error archiving blog post:", error)
        return { success: false, error: "Failed to archive post" }
    }

    return { success: true }
}
