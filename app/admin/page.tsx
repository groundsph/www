import { redirect } from "next/navigation"
import {
    isAdmin,
    getPendingCafes,
    getPublishedCafes,
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

    // Fetch all admin data
    const [
        pendingCafes,
        publishedCafes,
        reportedReviews,
        badges,
        suggestions,
        featuredSchedules,
        pendingClaims,
    ] = await Promise.all([
        getPendingCafes(),
        getPublishedCafes(),
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
                    pendingCafes={pendingCafes}
                    publishedCafes={publishedCafes}
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
