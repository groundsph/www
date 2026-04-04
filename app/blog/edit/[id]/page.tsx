import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getBlogPostById } from "@/app/api/actions/blog"
import CommunityBlogEditClient from "./CommunityBlogEditClient"

export const dynamic = "force-dynamic"

export default async function CommunityBlogEditPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const user = await getCurrentUser()
    if (!user) redirect("/login")

    const { id } = await params
    const post = await getBlogPostById(id)

    if (!post) redirect("/profile/blogs")
    if (post.author_id !== user.id) redirect("/profile/blogs")

    const editableStatuses = ["draft", "pending", "rejected"]
    if (!editableStatuses.includes(post.status)) redirect("/profile/blogs")

    return <CommunityBlogEditClient post={post} />
}
