import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import {
    getCafeForOwnerManagement,
    getCafeIdBySlug,
    getCafeMenuItems,
} from "@/app/api/actions/owner"
import CafeEditClient from "./CafeEditClient"

export const metadata: Metadata = {
    title: "Edit Cafe | Grounds",
    description: "Edit your cafe details.",
}

interface Props {
    params: Promise<{ slug: string }>
}

export default async function CafeEditPage({ params }: Props) {
    const { slug } = await params
    const user = await getCurrentUser()

    if (!user) {
        redirect(`/auth?redirect=/owner/cafes/${slug}/edit`)
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

    // Fetch menu items
    const menuItems = await getCafeMenuItems(cafeId)

    return (
        <main className='min-h-screen w-full bg-background pt-6 pb-12'>
            <div className='w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                <CafeEditClient cafe={cafe} menuItems={menuItems} />
            </div>
        </main>
    )
}
