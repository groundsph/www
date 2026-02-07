import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getOwnedCafes } from "@/app/api/actions/owner"
import OwnerDashboard from "@/components/owner/OwnerDashboard"

export const metadata: Metadata = {
    title: "Owner Dashboard | Grounds",
    description: "Manage your cafes, view analytics, and respond to reviews.",
}

export default async function OwnerPage() {
    const user = await getCurrentUser()

    if (!user) {
        redirect("/auth?redirect=/owner")
    }

    // Fetch owned cafes
    const ownedCafes = await getOwnedCafes()

    // If user has no cafes, show helpful message
    return (
        <main className='min-h-screen w-full bg-background pt-6 pb-12'>
            <div className='w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                <OwnerDashboard cafes={ownedCafes} />
            </div>
        </main>
    )
}
