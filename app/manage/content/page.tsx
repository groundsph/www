import { redirect } from "next/navigation"
import { isAdmin } from "@/app/api/actions/admin"
import { getAdminBlogPosts } from "@/app/api/actions/blog"
import { getAdminEvents } from "@/app/api/actions/events"
import ContentManagement from "@/components/manage/ContentManagement"

export const metadata = {
    title: "Content | Manage",
    description: "Manage blog posts and events",
}

export default async function ManageContentPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const [blogPostsResult, eventsResult] = await Promise.all([
        getAdminBlogPosts({ pageSize: 50 }),
        getAdminEvents(1, 50),
    ])

    return (
        <ContentManagement
            blogPosts={blogPostsResult.posts}
            events={eventsResult.events}
        />
    )
}
