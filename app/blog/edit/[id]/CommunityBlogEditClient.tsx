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
        <div className="min-h-screen w-full bg-background">
            <RichBlogEditor
                post={post}
                mode="community"
                allowedCategories={["community", "events"]}
                showCafePicker={false}
                showCrawlPicker={false}
                showFeatured={false}
                showSlug={false}
                onSuccess={() => router.push("/profile/blogs")}
                onCancel={() => router.push("/profile/blogs")}
            />
        </div>
    )
}
