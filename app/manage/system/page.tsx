import { redirect } from "next/navigation"
import {
    isAdmin,
    getUserRole,
    getAllBadgeDefinitions,
} from "@/app/api/actions/admin"
import SystemManagement from "@/components/manage/SystemManagement"

export const metadata = {
    title: "System | Manage",
    description: "Manage badges, settings, and maintenance tools",
}

export default async function ManageSystemPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const userRole = await getUserRole()

    // Only admins can access this page
    if (userRole !== "admin") {
        redirect("/manage")
    }

    const badges = await getAllBadgeDefinitions()

    return <SystemManagement badges={badges} />
}
