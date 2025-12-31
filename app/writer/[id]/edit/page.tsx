import { notFound } from "next/navigation"
import { getWriterBlogPostById } from "@/app/api/actions/blog"
import EditStoryClient from "./EditStoryClient"

export const metadata = {
    title: "Edit Story | Writer",
    description: "Edit your blog post",
}

export default async function EditStoryPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const post = await getWriterBlogPostById(id)

    if (!post) {
        notFound()
    }

    return <EditStoryClient post={post} />
}
