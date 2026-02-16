import { Metadata } from "next"
import { getUserBlogPosts } from "@/app/api/actions/blog"
import UserBlogsList from "@/components/blog/UserBlogsList"

export const metadata: Metadata = {
    title: "My Blogs",
    description: "View and manage your blog posts",
}

export default async function MyBlogsPage() {
    const result = await getUserBlogPosts()
    return <UserBlogsList initialPosts={result.posts} />
}
