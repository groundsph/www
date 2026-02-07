import type { Metadata } from "next"
import CafesPageClient from "@/components/cafe/CafesPageClient"
import { getAllCafes } from "@/app/api/actions/cafe"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    title: "Cafes",
    description:
        "Discover the best cafes for coffee lovers and remote workers. Browse our curated list of cafes with WiFi, power outlets, and great coffee.",
    openGraph: {
        title: "Cafes",
        description:
            "Discover the best cafes for coffee lovers and remote workers. Browse our curated list of cafes with WiFi, power outlets, and great coffee.",
        type: "website",
    },
}

export default async function CafesPage() {
    const initialCafes = await getAllCafes(1, 40, {})
    return <CafesPageClient initialCafes={initialCafes} />
}
