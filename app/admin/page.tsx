import { redirect } from "next/navigation"
import {
    isAdmin,
    getPendingCafes,
    getPublishedCafes,
    getFlaggedReviews,
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

    // Fetch pending cafes, published cafes, and flagged reviews
    const [pendingCafes, publishedCafes, flaggedReviews] = await Promise.all([
        getPendingCafes(),
        getPublishedCafes(),
        getFlaggedReviews(),
    ])

    return (
        <main className='min-h-screen w-full bg-background pt-6 pb-12'>
            <div className='w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
                <AdminDashboard
                    pendingCafes={pendingCafes}
                    publishedCafes={publishedCafes}
                    flaggedReviews={flaggedReviews}
                />
            </div>
        </main>
    )
}
