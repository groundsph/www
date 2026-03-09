import { redirect } from "next/navigation"
import { isAdmin, getUserRole } from "@/app/api/actions/admin"
import LeaderboardBackfillClient from "@/components/manage/LeaderboardBackfillClient"

export const metadata = {
    title: "Leaderboard Backfill | Manage",
    description: "Manually backfill leaderboard snapshots for historical months",
}

export default async function LeaderboardBackfillPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const userRole = await getUserRole()
    if (userRole !== "admin") {
        redirect("/manage")
    }

    return (
        <div className='space-y-8'>
            <div>
                <h1 className='text-2xl md:text-3xl font-bold text-text'>
                    Leaderboard Backfill
                </h1>
                <p className='text-text/60 mt-1'>
                    Manually backfill leaderboard snapshots for historical months.
                </p>
            </div>

            <LeaderboardBackfillClient />
        </div>
    )
}
