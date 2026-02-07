import { redirect } from "next/navigation"
import { isAdmin, getUserRole } from "@/app/api/actions/admin"
import ManageLayout from "@/components/manage/ManageLayout"

export const metadata = {
    title: "Manage Dashboard",
    description: "Manage cafe submissions and platform settings",
}

export default async function ManageDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Check admin/moderator access - redirect if not authorized
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    // Get user's actual role for conditional rendering
    const userRole = await getUserRole()

    return (
        <ManageLayout userRole={userRole as "admin" | "moderator"}>
            {children}
        </ManageLayout>
    )
}
