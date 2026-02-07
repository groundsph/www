import { redirect } from "next/navigation"
import {
    isAdmin,
    getUserRole,
    getFeaturedSchedules,
} from "@/app/api/actions/admin"
import { getAdminBlogPosts } from "@/app/api/actions/blog"
import { getAdminEvents } from "@/app/api/actions/events"
import ContentManagement from "@/components/manage/ContentManagement"

export const metadata = {
    title: "Content | Manage",
    description: "Manage blog posts, events, and featured schedules",
}

export default async function ManageContentPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const userRole = await getUserRole()

    // Only admins can access this page
    if (userRole !== "admin") {
        redirect("/manage")
    }

    const [blogPostsResult, eventsResult, featuredSchedules] =
        await Promise.all([
            getAdminBlogPosts({ pageSize: 50 }),
            getAdminEvents(1, 50),
            getFeaturedSchedules(),
        ])

    return (
        <ContentManagement
            blogPosts={blogPostsResult.posts}
            events={eventsResult.events}
            featuredSchedules={featuredSchedules}
        />
    )
}
