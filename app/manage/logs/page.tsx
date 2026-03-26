import { redirect } from "next/navigation"
import { isAdmin } from "@/app/api/actions/admin"
import SystemLogs from "@/components/manage/SystemLogs"

export const metadata = {
    title: "System Logs | Manage",
    description: "View and export system action logs",
}

export default async function SystemLogsPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    return <SystemLogs />
}
