import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import CommunityBlogCreateClient from "./CommunityBlogCreateClient"

export const metadata = {
    title: "Create Community Post | Grounds",
    description: "Share your coffee story with the Grounds community",
}

export const dynamic = "force-dynamic"

export default async function NewBlogPostPage() {
    const user = await getCurrentUser()
    if (!user) redirect("/auth/login?redirect=/blog/new")
    return <CommunityBlogCreateClient />
}
