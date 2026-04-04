"use client"

import { useRouter } from "next/navigation"
import RichBlogEditor from "@/components/blog/RichBlogEditor"
import type { BlogPost } from "@/utils/types/blog"

interface CommunityBlogEditClientProps {
    post: BlogPost
}

export default function CommunityBlogEditClient({ post }: CommunityBlogEditClientProps) {
    const router = useRouter()

    return (
        <div className="min-h-screen bg-background">
            <RichBlogEditor
                post={post}
                mode="community"
                onSuccess={() => router.push("/profile/blogs")}
                onCancel={() => router.push("/profile/blogs")}
            />
        </div>
    )
}
