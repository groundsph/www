import { Metadata } from "next"
import EventsPageClient from "@/components/events/EventsPageClient"
import { getEvents } from "@/app/api/actions/events"

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

export default async function EventsPage() {
    // Fetch initial events on server
    const now = new Date().toISOString()
    const { events: initialEvents } = await getEvents(
        { start_after: now },
        1,
        12
    )
    return <EventsPageClient initialEvents={initialEvents} />
}
