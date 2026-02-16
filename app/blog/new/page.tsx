import CommunityBlogEditor from "@/components/blog/CommunityBlogEditor"
import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export const metadata = {
    title: "Create Community Post | Grounds",
    description: "Share your coffee story with the Grounds community",
}

export default async function NewBlogPostPage() {
    const user = await getCurrentUser()

    if (!user) {
        redirect("/auth/login?redirect=/blog/new")
    }

    return <CommunityBlogEditor />
}
