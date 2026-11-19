import { redirect } from "next/navigation"
import { isAdmin, getUserRole } from "@/app/api/actions/admin"
import { LeaderboardBackfillClient } from "@/components/manage/LeaderboardBackfillClient"
import { currentMonthKey, getLastNMonths } from "@/utils/date/leaderboard-months"

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

    // The newest month that can be snapshotted: last month on the Manila
    // calendar. Computed here so the tool does not depend on the admin's clock.
    const latestMonth = getLastNMonths(2)[1] ?? currentMonthKey()

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

            <LeaderboardBackfillClient latestMonth={latestMonth} />
        </div>
    )
}
