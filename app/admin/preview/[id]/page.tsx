import { redirect } from "next/navigation"
import { isAdmin, getCafeById } from "@/app/api/actions/admin"
import { getCafeMenuItems } from "@/app/api/actions/owner"
import CafeEditor from "./CafeEditor"

interface Props {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
    const { id } = await params
    const cafe = await getCafeById(id)
    return {
        title: cafe ? `Review: ${cafe.name}` : "Cafe Not Found",
    }
}

export default async function AdminPreviewPage({ params }: Props) {
    // Check admin access
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const { id } = await params
    const cafe = await getCafeById(id)

    if (!cafe) {
        redirect("/admin")
    }

    // Fetch menu items
    const menuItems = await getCafeMenuItems(id)

    return (
        <main className='min-h-screen w-full bg-background pt-6 pb-12'>
            <div className='w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
                <CafeEditor
                    cafe={cafe}
                    menuItems={menuItems}
                />
            </div>
        </main>
    )
}
