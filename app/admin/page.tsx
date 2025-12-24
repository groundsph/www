import { redirect } from "next/navigation"
import {
    isAdmin,
    getPendingCafes,
    getPublishedCafes,
    getFlaggedReviews,
    getAllBadgeDefinitions,
} from "@/app/api/actions/admin"
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

    // Fetch pending cafes, published cafes, flagged reviews, and badges
    const [pendingCafes, publishedCafes, flaggedReviews, badges] =
        await Promise.all([
            getPendingCafes(),
            getPublishedCafes(),
            getFlaggedReviews(),
            getAllBadgeDefinitions(),
        ])

    return (
        <main className='min-h-screen w-full bg-background pt-6 pb-12'>
            <div className='w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
                <AdminDashboard
                    pendingCafes={pendingCafes}
                    publishedCafes={publishedCafes}
                    flaggedReviews={flaggedReviews}
                    badges={badges}
                />
            </div>
        </main>
    )
}
