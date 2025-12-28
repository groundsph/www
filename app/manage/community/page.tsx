import { redirect } from "next/navigation"
import {
    isAdmin,
    getUserRole,
    getReportedReviews,
} from "@/app/api/actions/admin"
import CommunityManagement from "./CommunityManagement"

export const metadata = {
    title: "Community | Manage",
    description: "Manage reviews and team members",
}

export default async function ManageCommunityPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const userRole = await getUserRole()
    const isFullAdmin = userRole === "admin"

    const reportedReviews = await getReportedReviews()

    return (
        <CommunityManagement
            userRole={userRole as "admin" | "moderator"}
            reportedReviews={reportedReviews}
            isFullAdmin={isFullAdmin}
        />
    )
}
