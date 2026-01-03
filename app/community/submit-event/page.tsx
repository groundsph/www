import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import EventSubmissionForm from "@/components/events/EventSubmissionForm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
    title: "Submit an Event | Grounds",
    description:
        "Submit a coffee-related event to share with the Grounds community",
}

export default async function SubmitEventPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session?.user) {
        redirect("/auth/login?redirect=/community/submit-event")
    }

    return (
        <main className='min-h-screen bg-tertiary py-8'>
            <div className='container mx-auto px-4 max-w-4xl'>
                {/* Back Link */}
                <Link
                    href='/community'
                    className='inline-flex items-center gap-2 text-text/60 hover:text-text mb-6 transition-colors'
                >
                    <ArrowLeft className='w-4 h-4' />
                    Back to Community
                </Link>

                {/* Form */}
                <EventSubmissionForm />
            </div>
        </main>
    )
}
