import { Metadata } from "next"
import EventsPageClient from "@/components/events/EventsPageClient"

export const metadata: Metadata = {
    title: "Events",
    description:
        "Discover coffee events, meetups, workshops, and community gatherings happening across the Philippines.",
    openGraph: {
        title: "Events",
        description:
            "Find coffee workshops, cupping sessions, and community gatherings near you.",
    },
}

export default function EventsPage() {
    return <EventsPageClient />
}
