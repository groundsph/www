import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getCafeBySlug } from "@/app/api/actions/cafe"
import { getCafeIdBySlug, isOwnerOfCafe } from "@/app/api/actions/owner"
import InventoryDashboard from "@/components/owner/InventoryDashboard"

export const metadata: Metadata = {
    title: "Inventory Management | Grounds",
    description: "Manage your cafe inventory, stock levels, and restock history.",
}

interface Props {
    params: Promise<{ slug: string }>
}

export default async function InventoryPage({ params }: Props) {
    const { slug } = await params
    const user = await getCurrentUser()

    // Auth guard
    if (!user) {
        redirect(`/auth?redirect=/owner/cafes/${slug}/inventory`)
    }

    // Get cafe ID from slug
    const cafeId = await getCafeIdBySlug(slug)
    if (!cafeId) {
        notFound()
    }

    // Verify user is owner
    const isOwner = await isOwnerOfCafe(cafeId)
    if (!isOwner) {
        redirect("/owner")
    }

    // Get cafe details
    const cafe = await getCafeBySlug(slug)
    if (!cafe) {
        notFound()
    }

    // Dynamically import inventory actions (they will be created in Phase 4.2)
    const { getInventoryItems, getInventoryStats } = await import("@/app/api/actions/inventory")

    // Fetch inventory items and stats in parallel
    const [items, stats] = await Promise.all([
        getInventoryItems(cafeId, {}),
        getInventoryStats(cafeId),
    ])

    return (
        <main className='min-h-screen w-full bg-background pt-6 pb-12'>
            <div className='w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                <InventoryDashboard
                    cafe={cafe}
                    items={items}
                    stats={stats}
                />
            </div>
        </main>
    )
}
