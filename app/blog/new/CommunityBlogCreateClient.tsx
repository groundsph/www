"use client"

import { useRouter } from "next/navigation"
import RichBlogEditor from "@/components/blog/RichBlogEditor"
import { useNotification } from "@/components/layout/NotificationProvider"

export default function CommunityBlogCreateClient() {
    const router = useRouter()
    const { addNotification } = useNotification()

    return (
        <div className="min-h-screen bg-background">
            <RichBlogEditor
                mode="community"
                onSuccess={() => {
                    addNotification("Your post has been submitted for review.", "success", { title: "Post Submitted", duration: 5000 })
                    router.push("/profile/blogs")
                }}
                onCancel={() => router.push("/profile/blogs")}
            />
        </div>
    )
}
