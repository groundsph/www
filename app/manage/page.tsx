import { redirect } from "next/navigation"
import {
    isAdmin,
    getUserRole,
    getPaginatedCafes,
    getCafeFilterOptions,
    getReportedReviews,
    getAllBadgeDefinitions,
    getFeaturedSchedules,
} from "@/app/api/actions/admin"
import { getPendingSuggestions } from "@/app/api/actions/suggestions"
import { getPendingClaims } from "@/app/api/actions/claim"
import { getAdminBlogPosts } from "@/app/api/actions/blog"
import { getAdminEvents } from "@/app/api/actions/events"
import ManageDashboard from "./ManageDashboard"

export const metadata = {
    title: "Manage Dashboard",
    description: "Manage cafe submissions and platform settings",
}

export default async function ManagePage() {
    // Check admin/moderator access - redirect if not authorized
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    // Get user's actual role for conditional rendering
    const userRole = await getUserRole()
    const isFullAdmin = userRole === "admin"

    // Fetch initial data - some data only for admins
    const [
        pendingResult,
        publishedResult,
        filterOptions,
        reportedReviews,
        suggestions,
        pendingClaims,
        // Admin-only data
        badges,
        featuredSchedules,
        blogPostsResult,
        eventsResult,
    ] = await Promise.all([
        // Moderator + Admin data
        getPaginatedCafes({
            isPublished: false,
            page: 1,
            pageSize: 25,
            sortBy: "date",
        }),
        getPaginatedCafes({
            isPublished: true,
            page: 1,
            pageSize: 25,
            sortBy: "name",
        }),
        getCafeFilterOptions(),
        getReportedReviews(),
        getPendingSuggestions(),
        getPendingClaims(),
        // Admin-only data (fetch empty arrays for moderators)
        isFullAdmin ? getAllBadgeDefinitions() : Promise.resolve([]),
        isFullAdmin ? getFeaturedSchedules() : Promise.resolve([]),
        isFullAdmin
            ? getAdminBlogPosts({ pageSize: 50 })
            : Promise.resolve({
                  posts: [],
                  total: 0,
                  page: 1,
                  pageSize: 50,
                  hasMore: false,
              }),
        isFullAdmin
            ? getAdminEvents(1, 50)
            : Promise.resolve({ events: [], total: 0 }),
    ])

    return (
        <main className='min-h-screen w-full bg-background pt-6 pb-12'>
            <div className='w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
                <ManageDashboard
                    userRole={userRole as "admin" | "moderator"}
                    initialPendingCafes={pendingResult.cafes}
                    initialPublishedCafes={publishedResult.cafes}
                    pendingTotal={pendingResult.total}
                    publishedTotal={publishedResult.total}
                    pendingHasMore={pendingResult.hasMore}
                    publishedHasMore={publishedResult.hasMore}
                    filterOptions={filterOptions}
                    reportedReviews={reportedReviews}
                    badges={badges}
                    suggestions={suggestions}
                    featuredSchedules={featuredSchedules}
                    pendingClaims={pendingClaims}
                    blogPosts={blogPostsResult.posts}
                    events={eventsResult.events}
                />
            </div>
        </main>
    )
}
