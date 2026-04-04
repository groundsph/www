"use client"

import { useRouter } from "next/navigation"
import RichBlogEditor from "@/components/blog/RichBlogEditor"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

const WRITER_ALLOWED_CATEGORIES = ["news", "guides", "community"] as const

export default function NewStoryPage() {
    const router = useRouter()

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-center gap-4">
                <Link href="/writer" className="p-2 hover:bg-text/5 rounded-lg text-text/60 hover:text-text transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold font-serif text-text">New Story</h1>
                    <p className="text-text/60 text-sm">Create a new blog post</p>
                </div>
            </div>
            <div className="bg-background rounded-2xl border border-text/10 shadow-sm overflow-hidden">
                <RichBlogEditor
                    mode="full"
                    allowedCategories={[...WRITER_ALLOWED_CATEGORIES]}
                    onSuccess={() => router.push("/writer")}
                    onCancel={() => router.push("/writer")}
                />
            </div>
        </div>
    )
}
