import { redirect } from "next/navigation"
import {
    isAdmin,
    getUserRole,
    getPaginatedCafes,
    getCafeFilterOptions,
    getManualSubscriptions,
    getFeaturedSchedules,
} from "@/app/api/actions/admin"
import { getPendingSuggestions } from "@/app/api/actions/suggestions"
import { getPendingClaims } from "@/app/api/actions/claim"
import CafesManagement from "@/components/manage/CafesManagement"

export const metadata = {
    title: "Cafes | Manage",
    description: "Manage cafe submissions, suggestions, and ownership claims",
}

export default async function ManageCafesPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const userRole = await getUserRole()

    const [
        pendingResult,
        publishedResult,
        filterOptions,
        suggestions,
        pendingClaims,
        manualSubscriptions,
        featuredSchedules,
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
        getPendingSuggestions(),
        getPendingClaims(),
        getManualSubscriptions(),
        getFeaturedSchedules(),
    ])

    return (
        <CafesManagement
            userRole={userRole as "admin" | "moderator"}
            initialPendingCafes={pendingResult.cafes}
            initialPublishedCafes={publishedResult.cafes}
            pendingTotal={pendingResult.total}
            publishedTotal={publishedResult.total}
            pendingHasMore={pendingResult.hasMore}
            publishedHasMore={publishedResult.hasMore}
            filterOptions={filterOptions}
            suggestions={suggestions}
            pendingClaims={pendingClaims}
            manualSubscriptions={manualSubscriptions}
            featuredSchedules={featuredSchedules}
        />
    )
}
