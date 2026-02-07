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
import { uploadBlogImageAction } from "@/utils/storage/actions"
import { compressBlogCover } from "@/utils/image-processing"
import { generateExcerptAction, AIProvider } from "@/app/api/actions/ai"
import MarkdownRender from "@/components/ui/MarkdownRender"

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
    const [isGeneratingExcerpt, setIsGeneratingExcerpt] = useState(false)
    const [aiProvider, setAiProvider] = useState<AIProvider>("google")

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
            // Compress blog cover (200KB JPEG for OG compatibility)
            const compressedFile = await compressBlogCover(file)

            const formData = new FormData()
            formData.append("image", compressedFile)

            const result = await uploadBlogImageAction(formData)

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
        <div className='h-full flex flex-col [&_button]:cursor-pointer'>
            {/* Header */}
            <div className='flex items-center justify-between px-6 py-4 border-b border-text/10 bg-background backdrop-blur-sm sticky top-0 z-10'>
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
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                            showPreview
                                ? "bg-primary text-white shadow-md shadow-primary/20"
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
                        <p className='text-red-600 text-sm flex items-center gap-2'>
                            <span className='w-1.5 h-1.5 rounded-full bg-red-500' />
                            {error}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className='grid lg:grid-cols-3 flex-1 overflow-visible'>
                {/* Main Editor */}
                <div className='lg:col-span-2 p-6 space-y-6 lg:border-r border-text/10 overflow-y-auto custom-scrollbar'>
                    {/* Cover Image */}
                    <div className='space-y-2'>
                        <label className='block text-sm font-medium text-text'>
                            Cover Image
                        </label>
                        {coverImage ? (
                            <div className='relative aspect-video rounded-xl overflow-hidden bg-text/5 ring-1 ring-black/5 group'>
                                <Image
                                    src={coverImage}
                                    alt='Cover'
                                    fill
                                    className='object-cover transition-transform duration-700 group-hover:scale-105'
                                />
                                <div className='absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors' />
                                <button
                                    onClick={() => setCoverImage(null)}
                                    className='absolute top-3 right-3 p-2 bg-white/90 text-red-500 rounded-lg hover:bg-white hover:scale-110 shadow-sm transition-all opacity-0 group-hover:opacity-100'
                                >
                                    <Trash2 className='w-4 h-4' />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className='w-full aspect-video rounded-xl border-2 border-dashed border-text/10 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center gap-3 text-text/40 hover:text-primary group'
                            >
                                {isUploading ? (
                                    <Loader2 className='w-8 h-8 animate-spin text-primary' />
                                ) : (
                                    <>
                                        <div className='p-3 bg-text/5 rounded-full group-hover:bg-primary/10 transition-colors'>
                                            <ImageIcon className='w-6 h-6' />
                                        </div>
                                        <div className='text-center'>
                                            <span className='text-sm font-medium block'>
                                                Click to upload cover image
                                            </span>
                                            <span className='text-xs opacity-70'>
                                                Recommended: 16:9 ratio, max 5MB
                                            </span>
                                        </div>
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
                    <div className='space-y-2'>
                        <label className='block text-sm font-medium text-text'>
                            Title <span className='text-red-500'>*</span>
                        </label>
                        <input
                            type='text'
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder='Enter a compelling title...'
                            className='w-full px-4 py-3 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-lg font-medium transition-all placeholder:text-text/30'
                        />
                    </div>

                    {/* Slug */}
                    <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                            <label className='text-sm font-medium text-text'>
                                URL Slug
                            </label>
                            <button
                                onClick={() => setAutoSlug(!autoSlug)}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                                    autoSlug
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "bg-text/5 text-text/60 border border-text/10"
                                }`}
                            >
                                {autoSlug ? "Auto-generate" : "Manual Edit"}
                            </button>
                        </div>
                        <div className='flex items-center'>
                            <div className='bg-text/5 border border-r-0 border-text/15 rounded-l-xl px-3 py-2.5 text-text/50 text-sm font-mono'>
                                /blog/
                            </div>
                            <input
                                type='text'
                                value={slug}
                                onChange={(e) => {
                                    setSlug(e.target.value)
                                    setAutoSlug(false)
                                }}
                                placeholder='your-post-slug'
                                className='flex-1 px-4 py-2.5 rounded-r-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm font-mono transition-all'
                            />
                        </div>
                    </div>

                    {/* Excerpt */}
                    <div className='space-y-2'>
                        <div className='flex justify-between'>
                            <label className='block text-sm font-medium text-text'>
                                Excerpt{" "}
                                <span className='text-text/40 font-normal'>
                                    (optional)
                                </span>
                            </label>
                            <span
                                className={`text-xs ${excerpt.length > 280 ? "text-amber-500 font-medium" : "text-text/40"}`}
                            >
                                {excerpt.length}/300
                            </span>
                        </div>
                        <textarea
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            placeholder='A brief summary of your post that will appear in cards and search results...'
                            rows={3}
                            maxLength={300}
                            className='w-full px-4 py-3 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all placeholder:text-text/30 leading-relaxed'
                        />
                        <div className='flex items-center justify-end gap-2 mt-2'>
                            <select
                                value={aiProvider}
                                onChange={(e) =>
                                    setAiProvider(e.target.value as AIProvider)
                                }
                                className='px-2 py-1 rounded-lg border border-text/15 bg-background text-xs font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none cursor-pointer hover:bg-text/5 transition-all'
                                disabled={isGeneratingExcerpt}
                            >
                                <option value='google'>
                                    Google (Gemini 2.5)
                                </option>
                                <option value='groq'>Groq (Llama 3.3)</option>
                            </select>
                            <button
                                onClick={async () => {
                                    if (!content.trim()) {
                                        setError(
                                            "Please write some content first to generate an excerpt."
                                        )
                                        return
                                    }
                                    setIsGeneratingExcerpt(true)
                                    setError(null)
                                    try {
                                        const res = await generateExcerptAction(
                                            content,
                                            aiProvider
                                        )
                                        if (res.success && res.excerpt) {
                                            setExcerpt(res.excerpt)
                                        } else {
                                            setError(
                                                res.error ||
                                                    "Failed to generate excerpt"
                                            )
                                        }
                                    } catch (err) {
                                        console.error(err)
                                        setError("Failed to generate excerpt")
                                    } finally {
                                        setIsGeneratingExcerpt(false)
                                    }
                                }}
                                disabled={
                                    isGeneratingExcerpt || !content.trim()
                                }
                                className='text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors px-2 py-1 rounded-lg hover:bg-primary/5'
                            >
                                {isGeneratingExcerpt ? (
                                    <>
                                        <Loader2 className='w-3 h-3 animate-spin' />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <span className='text-[10px]'>✨</span>
                                        Generate with AI
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className='flex-1 space-y-2'>
                        <div className='flex items-center justify-between'>
                            <label className='text-sm font-medium text-text'>
                                Content <span className='text-red-500'>*</span>
                            </label>
                            <div className='flex items-center gap-2 text-xs text-text/50 bg-text/5 px-2 py-1 rounded-md'>
                                <HelpCircle className='w-3.5 h-3.5' />
                                <span>Markdown supported</span>
                            </div>
                        </div>
                        {showPreview ? (
                            <div className='prose prose-stone max-w-none p-6 rounded-xl border border-text/15 min-h-[400px] bg-background shadow-inner overflow-auto'>
                                <MarkdownRender content={content} />
                            </div>
                        ) : (
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder='Write your blog post content here...

# Tips for a great post:
- Use clear headings
- Break up text with bullet points
- Add links to relevant resources'
                                className='w-full px-4 py-4 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none font-mono text-sm min-h-[400px] leading-relaxed transition-all placeholder:text-text/30'
                            />
                        )}
                        <p className='text-xs text-text/50 flex items-center gap-1.5 justify-end mt-2'>
                            <span className='w-1.5 h-1.5 rounded-full bg-primary/40'></span>
                            Estimated read time:{" "}
                            <span className='font-medium text-text'>
                                {readingTime} min
                            </span>
                        </p>
                    </div>
                </div>

                {/* Sidebar */}
                <div className='p-6 space-y-8 bg-tertiary/20 overflow-y-auto custom-scrollbar h-full border-t lg:border-t-0 border-text/10'>
                    {/* Publishing Actions */}
                    <div className='bg-background p-4 rounded-xl shadow-sm border border-text/5 space-y-3'>
                        <label className='text-xs font-bold text-text/40 uppercase tracking-wider block mb-1'>
                            Publishing
                        </label>
                        <button
                            onClick={() => handleSubmit("published")}
                            disabled={isSubmitting}
                            className='w-full px-4 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95'
                        >
                            {isSubmitting ? (
                                <Loader2 className='w-4 h-4 animate-spin' />
                            ) : (
                                <Send className='w-4 h-4' />
                            )}
                            Publish Post
                        </button>
                        <button
                            onClick={() => handleSubmit("draft")}
                            disabled={isSubmitting}
                            className='w-full px-4 py-2.5 rounded-lg border border-text/10 bg-white text-text/70 font-medium hover:bg-text/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95'
                        >
                            {isSubmitting ? (
                                <Loader2 className='w-4 h-4 animate-spin' />
                            ) : (
                                <Save className='w-4 h-4' />
                            )}
                            Save to Drafts
                        </button>
                    </div>

                    {/* Category */}
                    <div className='space-y-3'>
                        <label className='text-xs font-bold text-text/40 uppercase tracking-wider block'>
                            Classification
                        </label>
                        <div className='space-y-2'>
                            <label className='block text-sm font-medium text-text'>
                                Category
                            </label>
                            <div className='relative'>
                                <select
                                    value={category}
                                    onChange={(e) =>
                                        setCategory(
                                            e.target.value as BlogCategory
                                        )
                                    }
                                    className='w-full pl-4 pr-10 py-2.5 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none appearance-none cursor-pointer transition-all'
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
                                <div className='absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text/40'>
                                    <svg
                                        width='12'
                                        height='12'
                                        viewBox='0 0 12 12'
                                        fill='none'
                                        xmlns='http://www.w3.org/2000/svg'
                                    >
                                        <path
                                            d='M2.5 4.5L6 8L9.5 4.5'
                                            stroke='currentColor'
                                            strokeWidth='1.5'
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                        />
                                    </svg>
                                </div>
                            </div>
                            <p className='text-xs text-text/50 px-1'>
                                {
                                    categories.find((c) => c.value === category)
                                        ?.description
                                }
                            </p>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className='space-y-2'>
                        <label className='block text-sm font-medium text-text'>
                            Tags
                        </label>
                        <div className='flex gap-2'>
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
                                placeholder='Add a tag...'
                                className='flex-1 px-3 py-2 rounded-lg border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all'
                            />
                            <button
                                onClick={handleAddTag}
                                disabled={!tagInput.trim() || tags.length >= 10}
                                className='px-3 bg-text/5 text-text border border-text/10 rounded-lg hover:bg-text/10 transition-colors disabled:opacity-50 font-medium text-sm'
                            >
                                Add
                            </button>
                        </div>
                        <div className='flex flex-wrap gap-2 pt-1'>
                            {tags.length === 0 && (
                                <span className='text-xs text-text/40 italic px-1'>
                                    No tags added yet
                                </span>
                            )}
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className='flex items-center gap-1.5 pl-2 pr-1 py-1 bg-white border border-text/10 text-text/70 text-xs font-medium rounded-full shadow-sm'
                                >
                                    #{tag}
                                    <button
                                        onClick={() => handleRemoveTag(tag)}
                                        className='p-0.5 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors'
                                    >
                                        <X className='w-3 h-3' />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <p className='text-xs text-text/40 text-right'>
                            {tags.length}/10 tags
                        </p>
                    </div>

                    {/* Featured Toggle (Admin only) */}
                    {!cafeId && (
                        <div className='bg-background p-4 rounded-xl border border-text/5 flex items-center justify-between'>
                            <div>
                                <label className='text-sm font-medium text-text block'>
                                    Featured Post
                                </label>
                                <span className='text-xs text-text/50'>
                                    Pin to top of blog
                                </span>
                            </div>
                            <button
                                onClick={() => setFeatured(!featured)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${
                                    featured ? "bg-primary" : "bg-text/20"
                                }`}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                                        featured ? "translate-x-5" : ""
                                    }`}
                                />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
