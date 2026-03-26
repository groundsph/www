import { redirect } from "next/navigation"
import { isAdmin } from "@/app/api/actions/admin"
import { getPendingCommunityPosts, getModerationStats } from "@/app/api/actions/moderation"
import ModerationQueue from "@/components/manage/ModerationQueue"

export const metadata = {
    title: "Moderation Queue | Manage",
    description: "Review and moderate community-submitted blog posts",
}

export default async function ModerationPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const [initialPosts, stats] = await Promise.all([
        getPendingCommunityPosts(1, 20),
        getModerationStats(),
    ])

    return (
        <ModerationQueue
            initialPosts={initialPosts.posts}
            initialTotal={initialPosts.total}
            initialStats={stats}
        />
    )
}
