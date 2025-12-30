"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import BlogEditor from "@/components/blog/BlogEditor"
import { BlogPost, BlogCategory } from "@/utils/types/blog"

interface EditStoryClientProps {
    post: BlogPost
}

const WRITER_ALLOWED_CATEGORIES = ["news", "guides", "community"] as const

export default function EditStoryClient({ post }: EditStoryClientProps) {
    const router = useRouter()

    return (
        <div className='max-w-5xl mx-auto py-8'>
            <div className='mb-6 flex items-center gap-4'>
                <Link
                    href='/writer'
                    className='p-2 hover:bg-text/5 rounded-lg text-text/60 hover:text-text transition-colors'
                >
                    <ArrowLeft className='w-5 h-5' />
                </Link>
                <div>
                    <h1 className='text-2xl font-bold font-serif text-text'>
                        Edit Story
                    </h1>
                    <p className='text-text/60 text-sm'>
                        Update your blog post
                    </p>
                </div>
            </div>

            <div className='bg-background rounded-2xl border border-text/10 shadow-sm overflow-hidden'>
                <BlogEditor
                    post={post}
                    allowedCategories={[...WRITER_ALLOWED_CATEGORIES]}
                    onSuccess={() => router.push("/writer")}
                    onCancel={() => router.push("/writer")}
                />
            </div>
        </div>
    )
}
