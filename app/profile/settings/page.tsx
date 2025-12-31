import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import SettingsClient from "./SettingsClient"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
    const user = await getCurrentUser()

    if (!user) {
        redirect("/auth?redirect=/profile/settings")
    }

    return <SettingsClient />
}
