import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import {
    getCafeForOwnerManagement,
    getCafeSubscription,
    getCafeReviewsForOwner,
    getCafeMenuItems,
    getCafeIdBySlug,
} from "@/app/api/actions/owner"
import CafeManagementClient from "./CafeManagementClient"

export const metadata: Metadata = {
    title: "Manage Cafe | Grounds",
    description: "Manage your cafe details, reviews, and settings.",
}

interface Props {
    params: Promise<{ slug: string }>
}

export default async function CafeManagementPage({ params }: Props) {
    const { slug } = await params
    const user = await getCurrentUser()

    if (!user) {
        redirect(`/auth?redirect=/owner/cafes/${slug}`)
    }

    // Get cafe ID from slug
    const cafeId = await getCafeIdBySlug(slug)
    if (!cafeId) {
        notFound()
    }

    // Fetch cafe data with ownership check
    const cafe = await getCafeForOwnerManagement(cafeId)

    if (!cafe) {
        notFound()
    }

    // Fetch additional data
    const [subscription, reviews, menuItems] = await Promise.all([
        getCafeSubscription(cafeId),
        getCafeReviewsForOwner(cafeId),
        getCafeMenuItems(cafeId),
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
