import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import {
    getCafeForOwnerManagement,
    getCafeSubscription,
    getCafeReviewsForOwner,
    getCafeMenuItems,
} from "@/app/api/actions/owner"
import CafeManagementClient from "./CafeManagementClient"

export const metadata: Metadata = {
    title: "Manage Cafe | Grounds",
    description: "Manage your cafe details, reviews, and settings.",
}

interface Props {
    params: Promise<{ id: string }>
}

export default async function CafeManagementPage({ params }: Props) {
    const { id } = await params
    const db = await createClient()
    const {
        data: { user },
    } = await db.auth.getUser()

    if (!user) {
        redirect(`/auth?redirect=/owner/cafes/${id}`)
    }

    // Fetch cafe data with ownership check
    const cafe = await getCafeForOwnerManagement(id)

    if (!cafe) {
        notFound()
    }

    // Fetch additional data
    const [subscription, reviews, menuItems] = await Promise.all([
        getCafeSubscription(id),
        getCafeReviewsForOwner(id),
        getCafeMenuItems(id),
    ])

    return (
        <main className='min-h-screen w-full bg-background pt-6 pb-12 [&_button]:cursor-pointer'>
            <div className='w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                <CafeManagementClient
                    cafe={cafe}
                    subscription={subscription}
                    reviews={reviews}
                    menuItems={menuItems}
                />
            </div>
        </main>
    )
}
