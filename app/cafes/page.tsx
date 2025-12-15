import type { Metadata } from "next"
import CafesPageClient from "./cafePage"

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

export default function CafesPage() {
    return <CafesPageClient />
}
