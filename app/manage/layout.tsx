import { redirect } from "next/navigation"
import { isAdmin, getUserRole } from "@/app/api/actions/admin"
import ManageLayoutClient from "./ManageLayoutClient"

export const metadata = {
    title: "Manage Dashboard",
    description: "Manage cafe submissions and platform settings",
}

export default async function ManageLayout({
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
        <ManageLayoutClient userRole={userRole as "admin" | "moderator"}>
            {children}
        </ManageLayoutClient>
    )
}
