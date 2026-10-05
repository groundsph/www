"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import {
    X, Save, Send, Loader2, ImageIcon, Trash2, AlertCircle,
    Sparkles, Eye, Tag
} from "lucide-react"
import BlockEditor from "./editor/BlockEditor"
import { useAutoSave } from "./editor/useAutoSave"
import { RichBlogEditorProps } from "./editor/types"
import {
    BlogPostInput,
    BlogCategory,
    BlogStatus,
    BLOG_CATEGORIES,
    generateSlug,
    estimateReadingTime,
} from "@/utils/types/blog"
import {
    ADDABLE_BLOCK_TYPES,
    blocksToMarkdown,
    collectBlockCafeIds,
    createBlock,
    hasRenderableContent,
    legacyContentToBlocks,
    normalizeBlocks,
    type BlogBlock,
    type BlogBlockType,
} from "@/utils/types/blog-blocks"
import { createBlogPost, updateBlogPost, createCommunityBlogPost } from "@/app/api/actions/blog"
import { uploadBlogImageAction } from "@/utils/storage/actions"
import { compressBlogCover } from "@/utils/image-processing"
import { generateExcerptAction } from "@/app/api/actions/ai"
import { useNotification } from "@/components/layout/NotificationProvider"
import { cn } from "@/utils/cn"

const MAX_CONTENT_FOR_EXCERPT = 6000
const MIN_CONTENT_FOR_EXCERPT = 50
const AI_COOLDOWN_MS = 20000

/** Block types that are unavailable when cafe/crawl pickers are hidden. */
const CAFE_BLOCK_TYPES: BlogBlockType[] = ["cafe", "cafe-carousel", "map"]

export default function RichBlogEditor({
    post,
    cafeId,
    cafeName,
    onSuccess,
    onCancel,
    allowedCategories,
    showTags: showTagsProp,
    showCafePicker: showCafePickerProp,
    showCrawlPicker: showCrawlPickerProp,
    showFeatured: showFeaturedProp,
    showSlug: showSlugProp,
    mode = "full",
}: RichBlogEditorProps) {
    const { addNotification } = useNotification()

    const showTags = showTagsProp ?? true
    const showCafePicker = showCafePickerProp ?? true
    const showCrawlPicker = showCrawlPickerProp ?? true
    const showFeatured = showFeaturedProp ?? true
    const showSlug = showSlugProp ?? true

    // Form state
    const [title, setTitle] = useState(post?.title || "")
    const [slug, setSlug] = useState(post?.slug || "")
    const [excerpt, setExcerpt] = useState(post?.excerpt || "")
    const [coverImage, setCoverImage] = useState<string | null>(post?.cover_image || null)
    const [category, setCategory] = useState<BlogCategory>(post?.category || allowedCategories?.[0] || "news")
    const [tags, setTags] = useState<string[]>(post?.tags || [])
    const [tagInput, setTagInput] = useState("")
    const [featured, setFeatured] = useState(post?.featured || false)

    // Block body
    const initialBlocks = useMemo<BlogBlock[]>(() => {
        const fromPost = normalizeBlocks(post?.blocks)
        if (fromPost.length > 0) return fromPost
        if (post) {
            return legacyContentToBlocks({
                content: post.content,
                images: post.images,
                cafeIds: post.tagged_cafe_ids,
                crawlId: post.crawl_id,
            })
        }
        return [createBlock("text")]
    }, [post])
    const [blocks, setBlocks] = useState<BlogBlock[]>(initialBlocks)
    const [blockEditorKey, setBlockEditorKey] = useState(0)

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [autoSlug, setAutoSlug] = useState(!post?.slug)
    const [isGeneratingExcerpt, setIsGeneratingExcerpt] = useState(false)
    const [lastGenerateTime, setLastGenerateTime] = useState<number | null>(null)
    const [cooldownRemaining, setCooldownRemaining] = useState(0)
    const [showRestorePrompt, setShowRestorePrompt] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const content = useMemo(() => blocksToMarkdown(blocks), [blocks])

    const allowedBlockTypes = useMemo(() => {
        const excluded = new Set<BlogBlockType>()
        if (!showCafePicker) CAFE_BLOCK_TYPES.forEach((t) => excluded.add(t))
        if (!showCrawlPicker) excluded.add("crawl")
        if (excluded.size === 0) return undefined
        return ADDABLE_BLOCK_TYPES.filter((type) => !excluded.has(type))
    }, [showCafePicker, showCrawlPicker])

    const { state: autoSaveState, clearDraft, loadDraft } = useAutoSave({
        postId: post?.id,
        title,
        content,
        blocks,
        excerpt,
        coverImage,
        category,
        tags,
        enabled: true,
    })

    // Cooldown timer effect
    useEffect(() => {
        if (!lastGenerateTime) {
            setCooldownRemaining(0)
            return
        }
        const updateCooldown = () => {
            const elapsed = Date.now() - lastGenerateTime
            const remaining = Math.max(0, Math.ceil((AI_COOLDOWN_MS - elapsed) / 1000))
            setCooldownRemaining(remaining)
        }
        updateCooldown()
        const interval = setInterval(updateCooldown, 1000)
        return () => clearInterval(interval)
    }, [lastGenerateTime])

    // Check for draft on mount
    useEffect(() => {
        if (post?.id) return
        const draft = loadDraft()
        if (draft && (draft.blocks?.length || draft.content?.trim())) {
            setShowRestorePrompt(true)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleRestoreDraft = () => {
        const draft = loadDraft()
        if (!draft) return
        setTitle(draft.title)
        setExcerpt(draft.excerpt || "")
        setCoverImage(draft.coverImage || null)
        setCategory(draft.category)
        setTags(draft.tags || [])
        const restored = draft.blocks?.length
            ? normalizeBlocks(draft.blocks)
            : legacyContentToBlocks({ content: draft.content })
        if (restored.length > 0) {
            setBlocks(restored)
            setBlockEditorKey((key) => key + 1)
        }
        setShowRestorePrompt(false)
        addNotification("Draft restored", "success", { duration: 2000 })
    }

    const handleTitleChange = (value: string) => {
        setTitle(value)
        if (autoSlug) setSlug(generateSlug(value, true))
    }

    /** Shared image uploader used by image / gallery blocks. */
    const handleBlockImageUpload = async (file: File): Promise<string | null> => {
        try {
            const compressedFile = await compressBlogCover(file)
            const formData = new FormData()
            formData.append("image", compressedFile)
            const result = await uploadBlogImageAction(formData)
            if (result.success && result.url) return result.url
            addNotification(result.error || "Failed to upload image", "error")
            return null
        } catch (err) {
            console.error(err)
            addNotification("Failed to upload image", "error")
            return null
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsUploading(true)
        setError(null)
        try {
            const compressedFile = await compressBlogCover(file)
            const formData = new FormData()
            formData.append("image", compressedFile)
            const result = await uploadBlogImageAction(formData)
            if (result.success && result.url) setCoverImage(result.url)
            else setError(result.error || "Failed to upload image")
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
        if (!hasRenderableContent(blocks)) {
            setError("Add some content to your post")
            return
        }
        setIsSubmitting(true)
        setError(null)

        // Keep the legacy columns in sync so non-block consumers (feeds, cards,
        // search, the pre-conversion fallback) keep working.
        const legacyImages = blocks.flatMap((block) => {
            if (block.type === "image") return [block.url]
            if (block.type === "gallery") return block.images.map((image) => image.url)
            return []
        })
        const taggedCafeIds = collectBlockCafeIds(blocks)
        const crawlId = blocks.find((block) => block.type === "crawl")?.crawlId ?? null

        const input: BlogPostInput = {
            title: title.trim(),
            slug: slug.trim() || undefined,
            excerpt: excerpt.trim() || undefined,
            content,
            blocks,
            cover_image: coverImage,
            cafe_id: cafeId,
            category,
            status,
            tags,
            featured,
            images: legacyImages,
            tagged_cafe_ids: taggedCafeIds,
            crawl_id: crawlId,
        }

        try {
            let result
            if (mode === "community" && !post) {
                result = await createCommunityBlogPost({
                    title: input.title,
                    content: input.content,
                    excerpt: input.excerpt,
                    cover_image: input.cover_image,
                    blocks: input.blocks,
                    images: input.images,
                })
            } else {
                result = post
                    ? await updateBlogPost(post.id, input)
                    : await createBlogPost(input)
            }
            if (result.success) {
                clearDraft()
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
    const categories = allowedCategories
        ? BLOG_CATEGORIES.filter((c) => allowedCategories.includes(c.value))
        : BLOG_CATEGORIES

    const saveStatusText =
        autoSaveState.status === "saving"
            ? "Saving..."
            : autoSaveState.status === "saved"
                ? "Saved"
                : autoSaveState.status === "error"
                    ? "Save failed"
                    : ""

    const wordCount = content.trim().split(/\s+/).filter(Boolean).length

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Restore Prompt */}
            <AnimatePresence>
                {showRestorePrompt && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between"
                    >
                        <p className="text-sm text-text flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            You have an unsaved draft. Would you like to restore it?
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRestoreDraft}
                                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                            >
                                Restore
                            </button>
                            <button
                                onClick={() => setShowRestorePrompt(false)}
                                className="px-3 py-1.5 text-text/60 hover:text-text rounded-lg text-sm transition-colors"
                            >
                                Discard
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-text/10 bg-background sticky top-0 z-20 shrink-0">
                <div className="flex items-center gap-4">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="p-2 -ml-2 text-text/60 hover:text-text rounded-lg hover:bg-text/5 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-lg font-semibold text-text">
                            {post ? "Edit Post" : "New Post"}
                        </h1>
                        {cafeName && (
                            <p className="text-xs text-text/50">for {cafeName}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {saveStatusText && (
                        <span className="text-xs text-text/40 hidden sm:inline">
                            {saveStatusText}
                        </span>
                    )}

                    {post?.id && (
                        <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text/60 hover:text-text hover:bg-text/5 rounded-lg transition-colors"
                        >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Preview</span>
                        </a>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleSubmit("draft")}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text/70 bg-text/5 border border-text/10 rounded-lg hover:bg-text/10 hover:border-text/20 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span className="hidden sm:inline">Draft</span>
                        </button>
                        <button
                            onClick={() => handleSubmit("published")}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 shadow-sm hover:shadow-md hover:shadow-primary/20 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            <span className="hidden sm:inline">
                                {mode === "community" ? "Submit for review" : "Publish"}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-50 border-b border-red-100 px-6 py-3 shrink-0"
                    >
                        <p className="text-red-600 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-6xl mx-auto p-6 space-y-8">

                    {/* TOP SECTION: 2 Columns - Cover + Title/Details */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {/* Left: Cover Image */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-text/70">
                                Cover Image
                            </label>
                            {coverImage ? (
                                <div className="relative aspect-video rounded-xl overflow-hidden bg-text/5 ring-1 ring-black/5 group">
                                    <Image
                                        src={coverImage}
                                        alt="Cover"
                                        fill
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                    <button
                                        onClick={() => setCoverImage(null)}
                                        className="absolute top-2 right-2 md:top-3 md:right-3 p-1.5 md:p-2 bg-white text-red-500 rounded-lg shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="w-full aspect-video rounded-xl border-2 border-dashed border-text/20 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-text/40 hover:text-primary"
                                >
                                    {isUploading ? (
                                        <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin" />
                                    ) : (
                                        <>
                                            <ImageIcon className="w-6 h-6 md:w-8 md:h-8" />
                                            <span className="text-xs md:text-sm">Upload cover image</span>
                                        </>
                                    )}
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>

                        {/* Right: Title & Basic Details */}
                        <div className="space-y-3 md:space-y-4">
                            {/* Title */}
                            <div className="space-y-1">
                                <label className="block text-xs md:text-sm font-medium text-text/70">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    placeholder="Enter a compelling title..."
                                    className="w-full px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base md:text-lg font-semibold transition-all placeholder:text-text/30"
                                />
                            </div>

                            {/* Category & Tags Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Category */}
                                <div className="space-y-1">
                                    <label className="block text-xs md:text-sm font-medium text-text/70">
                                        Category
                                    </label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as BlogCategory)}
                                        className="w-full px-3 py-2 rounded-lg md:rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-xs md:text-sm"
                                    >
                                        {categories.map((cat) => (
                                            <option key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Tags Input */}
                                {showTags && (
                                    <div className="space-y-1">
                                        <label className="block text-xs md:text-sm font-medium text-text/70">
                                            Tags ({tags.length}/10)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === ",") {
                                                        e.preventDefault()
                                                        handleAddTag()
                                                    }
                                                }}
                                                placeholder="Add tag..."
                                                className="flex-1 px-3 py-2 rounded-lg md:rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-xs md:text-sm"
                                            />
                                            <button
                                                onClick={handleAddTag}
                                                disabled={!tagInput.trim() || tags.length >= 10}
                                                className="px-2.5 md:px-3 py-2 bg-text/5 text-text border border-text/10 rounded-lg md:rounded-xl hover:bg-text/10 transition-colors disabled:opacity-50 font-medium"
                                            >
                                                <Tag className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tags Display */}
                            {tags.length > 0 && (
                                <div className="flex flex-nowrap overflow-x-auto pb-2 gap-1.5">
                                    {tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="flex items-center gap-1 pl-2 pr-1 py-0.5 md:py-1 bg-primary/10 text-primary text-[10px] md:text-xs font-medium rounded-full"
                                        >
                                            #{tag}
                                            <button
                                                onClick={() => handleRemoveTag(tag)}
                                                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors"
                                            >
                                                <X className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Slug */}
                            {showSlug && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-[10px] md:text-xs font-medium text-text/60">
                                            URL Slug
                                        </label>
                                        <button
                                            onClick={() => setAutoSlug(!autoSlug)}
                                            className={cn(
                                                "text-[9px] md:text-[10px] px-1.5 md:px-2 py-0.5 rounded-full font-medium transition-colors",
                                                autoSlug
                                                    ? "bg-primary/10 text-primary"
                                                    : "bg-text/5 text-text/60"
                                            )}
                                        >
                                            {autoSlug ? "Auto" : "Manual"}
                                        </button>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="bg-text/5 border border-r-0 border-text/15 rounded-l-md md:rounded-l-lg px-2 py-1.5 text-text/40 text-[10px] md:text-xs font-mono">
                                            /blog/
                                        </div>
                                        <input
                                            type="text"
                                            value={slug}
                                            onChange={(e) => {
                                                setSlug(e.target.value)
                                                setAutoSlug(false)
                                            }}
                                            placeholder="your-post-slug"
                                            className="flex-1 px-2.5 md:px-3 py-1.5 rounded-r-md md:rounded-r-lg border border-text/15 bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[10px] md:text-xs font-mono transition-all"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* EXCERPT - Above Content */}
                    <section className="space-y-1.5 md:space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs md:text-sm font-medium text-text/70">
                                Excerpt
                            </label>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] md:text-xs text-text/40">
                                    {excerpt.length}/300
                                </span>
                                <button
                                    onClick={async () => {
                                        if (content.length < MIN_CONTENT_FOR_EXCERPT) {
                                            addNotification(`Write at least ${MIN_CONTENT_FOR_EXCERPT} characters.`, "error")
                                            return
                                        }
                                        if (lastGenerateTime && Date.now() - lastGenerateTime < AI_COOLDOWN_MS) {
                                            addNotification(`Wait ${Math.ceil((AI_COOLDOWN_MS - (Date.now() - lastGenerateTime)) / 1000)}s.`, "warning")
                                            return
                                        }
                                        setIsGeneratingExcerpt(true)
                                        try {
                                            const contentToUse = content.slice(0, MAX_CONTENT_FOR_EXCERPT)
                                            const res = await generateExcerptAction(contentToUse)
                                            if (res.success && res.excerpt) {
                                                setExcerpt(res.excerpt)
                                                setLastGenerateTime(Date.now())
                                                addNotification("Excerpt generated!", "success")
                                            } else addNotification(res.error || "Failed", "error")
                                        } catch {
                                            addNotification("Failed to generate excerpt", "error")
                                        } finally {
                                            setIsGeneratingExcerpt(false)
                                        }
                                    }}
                                    disabled={isGeneratingExcerpt || content.length < MIN_CONTENT_FOR_EXCERPT || cooldownRemaining > 0}
                                    className="flex items-center gap-1 text-[10px] md:text-xs text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isGeneratingExcerpt ? (
                                        <><Loader2 className="w-2.5 h-2.5 md:w-3 md:h-3 animate-spin" /> Generating...</>
                                    ) : (
                                        <><Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3" /> {cooldownRemaining > 0 ? `${cooldownRemaining}s` : "AI"}</>
                                    )}
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            rows={2}
                            maxLength={300}
                            placeholder="A brief summary of your post..."
                            className="w-full px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all placeholder:text-text/30 text-xs md:text-sm"
                        />
                    </section>

                    {/* CONTENT BLOCKS */}
                    <section className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs md:text-sm font-medium text-text/70">
                                Content <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[10px] md:text-xs text-text/40">
                                {blocks.length} block{blocks.length === 1 ? "" : "s"} · {wordCount} words · {readingTime} min read
                            </span>
                        </div>
                        <BlockEditor
                            key={blockEditorKey}
                            blocks={blocks}
                            onChange={setBlocks}
                            uploadImage={handleBlockImageUpload}
                            allowedTypes={allowedBlockTypes}
                        />
                    </section>

                    {/* Featured Toggle (Admin Only) */}
                    {showFeatured && !cafeId && (
                        <section className="flex items-center justify-between p-3 md:p-4 rounded-lg md:rounded-xl border border-text/10 bg-tertiary/10">
                            <div>
                                <h3 className="font-medium text-text flex items-center gap-2 text-xs md:text-sm">
                                    <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                                    Featured
                                </h3>
                                <p className="text-[10px] md:text-xs text-text/50">
                                    Pin to top of blog
                                </p>
                            </div>
                            <button
                                onClick={() => setFeatured(!featured)}
                                className={cn(
                                    "relative w-9 h-5 md:w-11 md:h-6 rounded-full transition-colors",
                                    featured ? "bg-primary" : "bg-text/20"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 left-0.5 md:top-1 md:left-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-full shadow-sm transition-transform",
                                        featured ? "translate-x-4 md:translate-x-5" : ""
                                    )}
                                />
                            </button>
                        </section>
                    )}
                </div>
            </div>
        </div>
    )
}
