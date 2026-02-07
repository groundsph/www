import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import Settings from "@/components/profile/Settings"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
    const user = await getCurrentUser()

    if (!user) {
        redirect("/auth?redirect=/profile/settings")
    }

    return <Settings />
}
