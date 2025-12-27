import { redirect } from "next/navigation"
import {
    isAdmin,
    getPaginatedCafes,
    getCafeFilterOptions,
    getReportedReviews,
    getAllBadgeDefinitions,
    getFeaturedSchedules,
} from "@/app/api/actions/admin"
import { getPendingSuggestions } from "@/app/api/actions/suggestions"
import { getPendingClaims } from "@/app/api/actions/claim"
import AdminDashboard from "./AdminDashboard"

export const metadata = {
    title: "Admin Dashboard",
    description: "Manage cafe submissions",
}

export default async function AdminPage() {
    // Check admin access - redirect if not authorized
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    // Fetch initial admin data with pagination
    const [
        pendingResult,
        publishedResult,
        filterOptions,
        reportedReviews,
        badges,
        suggestions,
        featuredSchedules,
        pendingClaims,
    ] = await Promise.all([
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
        getAllBadgeDefinitions(),
        getPendingSuggestions(),
        getFeaturedSchedules(),
        getPendingClaims(),
    ])

    return (
        <main className='min-h-screen w-full bg-background pt-6 pb-12'>
            <div className='w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
                <AdminDashboard
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
                />
            </div>
        </main>
    )
}
