import { redirect } from "next/navigation"
import { isAdmin, getPendingVerifications } from "@/app/api/actions/admin"
import VerificationsQueue from "@/components/manage/VerificationsQueue"

export const metadata = {
    title: "Ownership Verifications | Manage",
    description:
        "Review owner-submitted proof before granting access to a cafe listing",
}

export default async function VerificationsPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const initialRequests = await getPendingVerifications()

    return <VerificationsQueue initialRequests={initialRequests} />
}
