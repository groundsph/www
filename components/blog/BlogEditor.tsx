"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import {
    X,
    Eye,
    Save,
    Send,
    Loader2,
    ImageIcon,
    Trash2,
    HelpCircle,
} from "lucide-react"
import {
    BlogPost,
    BlogPostInput,
    BlogCategory,
    BlogStatus,
    BLOG_CATEGORIES,
    generateSlug,
    estimateReadingTime,
} from "@/utils/types/blog"
import { createBlogPost, updateBlogPost } from "@/app/api/actions/blog"
import { uploadBlogImage } from "@/utils/supabase/storage"
import MarkdownRender from "@/components/MarkdownRender"

interface BlogEditorProps {
    post?: BlogPost
    cafeId?: string
    cafeName?: string
    onSuccess?: (slug: string) => void
    onCancel?: () => void
    allowedCategories?: BlogCategory[]
}

export default function BlogEditor({
    post,
    cafeId,
    cafeName,
    onSuccess,
    onCancel,
    allowedCategories,
}: BlogEditorProps) {
    const [title, setTitle] = useState(post?.title || "")
    const [slug, setSlug] = useState(post?.slug || "")
    const [excerpt, setExcerpt] = useState(post?.excerpt || "")
    const [content, setContent] = useState(post?.content || "")
    const [coverImage, setCoverImage] = useState<string | null>(
        post?.cover_image || null
    )
    const [category, setCategory] = useState<BlogCategory>(
        post?.category || allowedCategories?.[0] || "news"
    )
    const [tags, setTags] = useState<string[]>(post?.tags || [])
    const [tagInput, setTagInput] = useState("")
    const [featured, setFeatured] = useState(post?.featured || false)

    const [showPreview, setShowPreview] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [autoSlug, setAutoSlug] = useState(!post?.slug)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const categories = allowedCategories
        ? BLOG_CATEGORIES.filter((c) => allowedCategories.includes(c.value))
        : BLOG_CATEGORIES

    const handleTitleChange = (value: string) => {
        setTitle(value)
        if (autoSlug) {
            setSlug(generateSlug(value))
        }
    }

    const handleImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append("image", file)

            const result = await uploadBlogImage(formData)

            if (result.success && result.url) {
                setCoverImage(result.url)
            } else {
                setError(result.error || "Failed to upload image")
            }
        } catch (err) {
            setError("Failed to upload image")
            console.error(err)
        } finally {
            setIsUploading(false)
        }
    }

    const handleAddTag = () => {
        const trimmed = tagInput.trim().toLowerCase()
        if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
            setTags([...tags, trimmed])
            setTagInput("")
        }
    }

    const handleRemoveTag = (tag: string) => {
        setTags(tags.filter((t) => t !== tag))
    }

    const handleSubmit = async (status: BlogStatus) => {
        if (!title.trim()) {
            setError("Title is required")
            return
        }
        if (!content.trim()) {
            setError("Content is required")
            return
        }

        setIsSubmitting(true)
        setError(null)

        const input: BlogPostInput = {
            title: title.trim(),
            slug: slug.trim() || undefined,
            excerpt: excerpt.trim() || undefined,
            content: content.trim(),
            cover_image: coverImage,
            cafe_id: cafeId,
            category,
            status,
            tags,
            featured,
        }

        try {
            const result = post
                ? await updateBlogPost(post.id, input)
                : await createBlogPost(input)

            if (result.success) {
                onSuccess?.(result.slug || slug)
            } else {
                setError(result.error || "Failed to save post")
            }
        } catch (err) {
            setError("An unexpected error occurred")
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const readingTime = estimateReadingTime(content)

    return (
        <div className='bg-white rounded-2xl shadow-lg overflow-hidden'>
            {/* Header */}
            <div className='flex items-center justify-between px-6 py-4 border-b border-text/10'>
                <div>
                    <h2 className='text-xl font-bold font-serif text-text'>
                        {post ? "Edit Post" : "Create New Post"}
                    </h2>
                    {cafeName && (
                        <p className='text-sm text-text/60'>
                            Posting for {cafeName}
                        </p>
                    )}
                </div>
                <div className='flex items-center gap-2'>
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                            showPreview
                                ? "bg-primary text-white"
                                : "bg-text/5 text-text hover:bg-text/10"
                        }`}
                    >
                        <Eye className='w-4 h-4' />
                        Preview
                    </button>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className='p-2 rounded-xl bg-text/5 text-text/60 hover:bg-text/10 transition-colors'
                        >
                            <X className='w-5 h-5' />
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className='bg-red-50 border-b border-red-100 px-6 py-3'
                    >
                        <p className='text-red-600 text-sm'>{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className='grid lg:grid-cols-3 min-h-[600px]'>
                {/* Main Editor */}
                <div className='lg:col-span-2 p-6 space-y-6 border-r border-text/10'>
                    {/* Cover Image */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Cover Image
                        </label>
                        {coverImage ? (
                            <div className='relative aspect-video rounded-xl overflow-hidden bg-text/5'>
                                <Image
                                    src={coverImage}
                                    alt='Cover'
                                    fill
                                    className='object-cover'
                                />
                                <button
                                    onClick={() => setCoverImage(null)}
                                    className='absolute top-3 right-3 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors'
                                >
                                    <Trash2 className='w-4 h-4' />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className='w-full aspect-video rounded-xl border-2 border-dashed border-text/20 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-3 text-text/50 hover:text-primary'
                            >
                                {isUploading ? (
                                    <Loader2 className='w-8 h-8 animate-spin' />
                                ) : (
                                    <>
                                        <ImageIcon className='w-10 h-10' />
                                        <span className='text-sm font-medium'>
                                            Click to upload cover image
                                        </span>
                                        <span className='text-xs'>
                                            Recommended: 16:9 ratio, max 5MB
                                        </span>
                                    </>
                                )}
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type='file'
                            accept='image/*'
                            onChange={handleImageUpload}
                            className='hidden'
                        />
                    </div>

                    {/* Title */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Title *
                        </label>
                        <input
                            type='text'
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder='Enter a compelling title...'
                            className='w-full px-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-lg font-medium'
                        />
                    </div>

                    {/* Slug */}
                    <div>
                        <div className='flex items-center gap-2 mb-2'>
                            <label className='text-sm font-medium text-text'>
                                URL Slug
                            </label>
                            <button
                                onClick={() => setAutoSlug(!autoSlug)}
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                    autoSlug
                                        ? "bg-primary/10 text-primary"
                                        : "bg-text/10 text-text/60"
                                }`}
                            >
                                {autoSlug ? "Auto" : "Manual"}
                            </button>
                        </div>
                        <div className='flex items-center gap-2'>
                            <span className='text-text/50 text-sm'>/blog/</span>
                            <input
                                type='text'
                                value={slug}
                                onChange={(e) => {
                                    setSlug(e.target.value)
                                    setAutoSlug(false)
                                }}
                                placeholder='your-post-slug'
                                className='flex-1 px-3 py-2 rounded-lg border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm'
                            />
                        </div>
                    </div>

                    {/* Excerpt */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Excerpt (optional)
                        </label>
                        <textarea
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            placeholder='A brief summary of your post...'
                            rows={2}
                            maxLength={300}
                            className='w-full px-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none'
                        />
                        <p className='text-xs text-text/50 mt-1'>
                            {excerpt.length}/300 characters
                        </p>
                    </div>

                    {/* Content */}
                    <div className='flex-1'>
                        <div className='flex items-center justify-between mb-2'>
                            <label className='text-sm font-medium text-text'>
                                Content * (Markdown)
                            </label>
                            <div className='flex items-center gap-2 text-xs text-text/50'>
                                <HelpCircle className='w-3.5 h-3.5' />
                                <span>Supports Markdown formatting</span>
                            </div>
                        </div>
                        {showPreview ? (
                            <div className='prose prose-stone max-w-none p-4 rounded-xl border border-text/20 min-h-[300px] bg-text/5 overflow-auto'>
                                <MarkdownRender content={content} />
                            </div>
                        ) : (
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder='Write your blog post content here...

Use Markdown for formatting:
- **bold text**
- *italic text*
- [links](url)
- # Headings
- - Lists'
                                className='w-full px-4 py-3 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none font-mono text-sm min-h-[300px]'
                            />
                        )}
                        <p className='text-xs text-text/50 mt-1'>
                            ~{readingTime} min read
                        </p>
                    </div>
                </div>

                {/* Sidebar */}
                <div className='p-6 space-y-6 bg-background/50'>
                    {/* Category */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Category
                        </label>
                        <select
                            value={category}
                            onChange={(e) =>
                                setCategory(e.target.value as BlogCategory)
                            }
                            className='w-full px-4 py-2.5 rounded-xl border border-text/20 focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white'
                        >
                            {categories.map((cat) => (
                                <option
                                    key={cat.value}
                                    value={cat.value}
                                >
                                    {cat.label}
                                </option>
                            ))}
                        </select>
                        <p className='text-xs text-text/50 mt-1'>
                            {
                                categories.find((c) => c.value === category)
                                    ?.description
                            }
                        </p>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className='block text-sm font-medium text-text mb-2'>
                            Tags (max 10)
                        </label>
                        <div className='flex gap-2 mb-2'>
                            <input
                                type='text'
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === ",") {
                                        e.preventDefault()
                                        handleAddTag()
                                    }
                                }}
                                placeholder='Add tag...'
                                className='flex-1 px-3 py-2 rounded-lg border border-text/20 focus:border-primary outline-none text-sm'
                            />
                            <button
                                onClick={handleAddTag}
                                disabled={!tagInput.trim() || tags.length >= 10}
                                className='px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50'
                            >
                                Add
                            </button>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className='flex items-center gap-1 px-2 py-1 bg-text/10 text-text/70 text-sm rounded-full'
                                >
                                    #{tag}
                                    <button
                                        onClick={() => handleRemoveTag(tag)}
                                        className='hover:text-red-500'
                                    >
                                        <X className='w-3 h-3' />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Featured Toggle (Admin only) */}
                    {!cafeId && (
                        <div className='flex items-center justify-between py-3 border-y border-text/10'>
                            <label className='text-sm font-medium text-text'>
                                Featured Post
                            </label>
                            <button
                                onClick={() => setFeatured(!featured)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    featured ? "bg-primary" : "bg-text/20"
                                }`}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                        featured ? "translate-x-6" : ""
                                    }`}
                                />
                            </button>
                        </div>
                    )}

                    {/* Actions */}
                    <div className='space-y-3 pt-4'>
                        <button
                            onClick={() => handleSubmit("draft")}
                            disabled={isSubmitting}
                            className='w-full px-4 py-3 rounded-xl border-2 border-text/20 text-text font-medium hover:bg-text/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                        >
                            {isSubmitting ? (
                                <Loader2 className='w-5 h-5 animate-spin' />
                            ) : (
                                <Save className='w-5 h-5' />
                            )}
                            Save as Draft
                        </button>
                        <button
                            onClick={() => handleSubmit("published")}
                            disabled={isSubmitting}
                            className='w-full px-4 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                        >
                            {isSubmitting ? (
                                <Loader2 className='w-5 h-5 animate-spin' />
                            ) : (
                                <Send className='w-5 h-5' />
                            )}
                            Publish
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
