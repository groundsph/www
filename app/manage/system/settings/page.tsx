import { redirect } from "next/navigation"
import { isAdmin, getUserRole, getAllBadgeDefinitions } from "@/app/api/actions/admin"
import SystemManagement from "@/components/manage/SystemManagement"

export const metadata = {
    title: "System Settings | Manage",
    description: "Manage badges, platform settings, and maintenance tools",
}

export default async function ManageSystemSettingsPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const userRole = await getUserRole()
    if (userRole !== "admin") {
        redirect("/manage")
    }

    const badges = await getAllBadgeDefinitions()

    return <SystemManagement badges={badges} />
}
