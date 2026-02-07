import { getWriterBlogPosts } from "@/app/api/actions/blog"
import WriterDashboard from "@/components/writer/WriterDashboard"

export const metadata = {
    title: "Dashboard | Writer",
    description: "Manage your stories",
}

export default async function WriterPage() {
    const { posts } = await getWriterBlogPosts({ pageSize: 50 })

    return <WriterDashboard initialPosts={posts} />
}
