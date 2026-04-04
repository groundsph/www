"use client"

import { useState, useRef, useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import {
    X, Eye, Save, Send, Loader2, ImageIcon, Trash2,
    Images, MapPin, Route, Sparkles,
} from "lucide-react"
import { getEditorExtensions } from "./editor/extensions"
import EditorToolbar from "./editor/EditorToolbar"
import { useAutoSave } from "./editor/useAutoSave"
import { useEditorContent } from "./editor/useEditorContent"
import { RichBlogEditorProps } from "./editor/types"
import BlogCafePicker from "./BlogCafePicker"
import BlogCrawlPicker from "./BlogCrawlPicker"
import {
    BlogPostInput,
    BlogCategory,
    BlogStatus,
    BLOG_CATEGORIES,
    generateSlug,
    estimateReadingTime,
} from "@/utils/types/blog"
import { createBlogPost, updateBlogPost, createCommunityBlogPost } from "@/app/api/actions/blog"
import { uploadBlogImageAction } from "@/utils/storage/actions"
import { compressBlogCover } from "@/utils/image-processing"
import { generateExcerptAction } from "@/app/api/actions/ai"
import MarkdownRender from "@/components/ui/MarkdownRender"
import { useNotification } from "@/components/layout/NotificationProvider"

const MAX_CONTENT_FOR_EXCERPT = 6000
const MIN_CONTENT_FOR_EXCERPT = 50
const AI_COOLDOWN_MS = 20000

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
    const isFullMode = mode === "full"
    const showTags = showTagsProp ?? isFullMode
    const showCafePicker = showCafePickerProp ?? isFullMode
    const showCrawlPicker = showCrawlPickerProp ?? isFullMode
    const showFeatured = showFeaturedProp ?? isFullMode
    const showSlug = showSlugProp ?? isFullMode

    const [title, setTitle] = useState(post?.title || "")
    const [slug, setSlug] = useState(post?.slug || "")
    const [excerpt, setExcerpt] = useState(post?.excerpt || "")
    const [coverImage, setCoverImage] = useState<string | null>(post?.cover_image || null)
    const [category, setCategory] = useState<BlogCategory>(post?.category || allowedCategories?.[0] || "news")
    const [tags, setTags] = useState<string[]>(post?.tags || [])
    const [tagInput, setTagInput] = useState("")
    const [featured, setFeatured] = useState(post?.featured || false)
    const [galleryImages, setGalleryImages] = useState<string[]>(post?.images || [])
    const [taggedCafeIds, setTaggedCafeIds] = useState<string[]>(post?.tagged_cafe_ids || [])
    const [linkedCrawlId, setLinkedCrawlId] = useState<string | null>(post?.crawl_id || null)

    const [showPreview, setShowPreview] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isUploadingGallery, setIsUploadingGallery] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [autoSlug, setAutoSlug] = useState(!post?.slug)
    const [isGeneratingExcerpt, setIsGeneratingExcerpt] = useState(false)
    const [lastGenerateTime, setLastGenerateTime] = useState<number | null>(null)
    const [cooldownRemaining, setCooldownRemaining] = useState(0)
    const [showRestorePrompt, setShowRestorePrompt] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const galleryInputRef = useRef<HTMLInputElement>(null)

    const editor = useEditor({
        extensions: getEditorExtensions("Start writing... Type / for commands"),
        content: post?.content || "",
        editorProps: {
            attributes: { class: "prose prose-stone max-w-none min-h-[400px] p-6 outline-none" },
            handleDrop: (view, event, _slice, moved) => {
                if (!moved && event.dataTransfer?.files?.length) {
                    const file = event.dataTransfer.files[0]
                    if (file.type.startsWith("image/")) {
                        event.preventDefault()
                        handleInlineImageUpload(file)
                        return true
                    }
                }
                return false
            },
            handlePaste: (_view, event) => {
                const items = event.clipboardData?.items
                if (!items) return false
                for (const item of Array.from(items)) {
                    if (item.type.startsWith("image/")) {
                        event.preventDefault()
                        const file = item.getAsFile()
                        if (file) handleInlineImageUpload(file)
                        return true
                    }
                }
                return false
            },
        },
    })

    const { getMarkdown } = useEditorContent(editor)

    const currentContent = editor ? getMarkdown() : ""
    const { state: autoSaveState, clearDraft, loadDraft } = useAutoSave({
        postId: post?.id,
        title,
        content: currentContent,
        excerpt,
        coverImage,
        category,
        tags,
        enabled: !showPreview,
    })

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

    useEffect(() => {
        if (post?.id) return
        const draft = loadDraft()
        if (draft && draft.content.trim()) setShowRestorePrompt(true)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<{ file: File | null }>
            const file = customEvent.detail?.file
            if (file) handleInlineImageUpload(file)
        }
        window.addEventListener("editor:image-upload", handler)
        return () => window.removeEventListener("editor:image-upload", handler)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleRestoreDraft = () => {
        const draft = loadDraft()
        if (!draft) return
        setTitle(draft.title)
        setExcerpt(draft.excerpt || "")
        setCoverImage(draft.coverImage || null)
        setCategory(draft.category)
        setTags(draft.tags || [])
        if (editor && draft.content) editor.commands.setContent(draft.content)
        setShowRestorePrompt(false)
        addNotification("Draft restored", "success", { duration: 2000 })
    }

    const handleTitleChange = (value: string) => {
        setTitle(value)
        if (autoSlug) setSlug(generateSlug(value, true))
    }

    const handleInlineImageUpload = async (file: File) => {
        try {
            const compressedFile = await compressBlogCover(file)
            const formData = new FormData()
            formData.append("image", compressedFile)
            const result = await uploadBlogImageAction(formData)
            if (result.success && result.url && editor) {
                editor.chain().focus().setImage({ src: result.url }).run()
            } else {
                addNotification(result.error || "Failed to upload image", "error")
            }
        } catch (err) {
            console.error(err)
            addNotification("Failed to upload image", "error")
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
        }
        finally {
            setIsUploading(false)
        }
    }

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return
        setIsUploadingGallery(true)
        const newImages: string[] = []
        try {
            for (const file of Array.from(files)) {
                const compressedFile = await compressBlogCover(file)
                const formData = new FormData()
                formData.append("image", compressedFile)
                const result = await uploadBlogImageAction(formData)
                if (result.success && result.url) newImages.push(result.url)
            }
            if (newImages.length > 0) setGalleryImages([...galleryImages, ...newImages])
        } catch (err) {
            console.error(err)
        }
        finally {
            setIsUploadingGallery(false)
            if (galleryInputRef.current) galleryInputRef.current.value = ""
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

    const handleRemoveGalleryImage = (index: number) => {
        setGalleryImages(galleryImages.filter((_, i) => i !== index))
    }

    const handleSubmit = async (status: BlogStatus) => {
        if (!title.trim()) {
            setError("Title is required")
            return
        }
        const content = getMarkdown()
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
            images: galleryImages,
            tagged_cafe_ids: taggedCafeIds,
            crawl_id: linkedCrawlId,
        }

        try {
            let result
            if (mode === "community" && !post) {
                result = await createCommunityBlogPost({
                    title: input.title,
                    content: input.content,
                    excerpt: input.excerpt,
                    cover_image: input.cover_image,
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
        }
        finally {
            setIsSubmitting(false)
        }
    }

    const readingTime = estimateReadingTime(currentContent)
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

    return (
        <div className="h-full flex flex-col [&_button]:cursor-pointer">
            <AnimatePresence>
                {showRestorePrompt && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-primary/5 border-b border-primary/20 px-6 py-3 flex items-center justify-between"
                    >
                        <p className="text-sm text-text">
                            You have an unsaved draft. Would you like to restore it?
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRestoreDraft}
                                className="px-3 py-1 bg-primary text-white rounded-lg text-sm"
                            >
                                Restore
                            </button>
                            <button
                                onClick={() => setShowRestorePrompt(false)}
                                className="px-3 py-1 bg-text/5 text-text/60 rounded-lg text-sm"
                            >
                                Discard
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex items-center justify-between px-6 py-4 border-b border-text/10 bg-background backdrop-blur-sm sticky top-0 z-10">
                <div>
                    <h2 className="text-xl font-bold font-serif text-text">
                        {post ? "Edit Post" : "Create New Post"}
                    </h2>
                    {cafeName && (
                        <p className="text-sm text-text/60">Posting for {cafeName}</p>
                    )}
                    {saveStatusText && (
                        <p className="text-xs text-text/40 mt-0.5">{saveStatusText}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                            showPreview
                                ? "bg-primary text-white shadow-md shadow-primary/20"
                                : "bg-text/5 text-text hover:bg-text/10"
                        }`}
                    >
                        <Eye className="w-4 h-4" /> Preview
                    </button>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="p-2 rounded-xl bg-text/5 text-text/60 hover:bg-text/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-50 border-b border-red-100 px-6 py-3"
                    >
                        <p className="text-red-600 text-sm flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            {error}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`${isFullMode ? "grid lg:grid-cols-3" : ""} flex-1 overflow-visible`}>
                <div
                    className={`${isFullMode ? "lg:col-span-2" : ""} p-6 space-y-6 ${
                        isFullMode ? "lg:border-r border-text/10" : ""
                    } overflow-y-auto custom-scrollbar`}
                >
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-text">
                            Cover Image
                        </label>
                        {coverImage ? (
                            <div className="relative aspect-video rounded-xl overflow-hidden bg-text/5 ring-1 ring-black/5 group">
                                <Image
                                    src={coverImage}
                                    alt="Cover"
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                <button
                                    onClick={() => setCoverImage(null)}
                                    className="absolute top-3 right-3 p-2 bg-white/90 text-red-500 rounded-lg hover:bg-white hover:scale-110 shadow-sm transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-full aspect-video rounded-xl border-2 border-dashed border-text/10 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center gap-3 text-text/40 hover:text-primary group"
                            >
                                {isUploading ? (
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                ) : (
                                    <>
                                        <div className="p-3 bg-text/5 rounded-full group-hover:bg-primary/10 transition-colors">
                                            <ImageIcon className="w-6 h-6" />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-sm font-medium block">
                                                Click to upload cover image
                                            </span>
                                            <span className="text-xs opacity-70">
                                                Recommended: 16:9 ratio, max 5MB
                                            </span>
                                        </div>
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

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-text">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder="Enter a compelling title..."
                            className="w-full px-4 py-3 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-lg font-medium transition-all placeholder:text-text/30"
                        />
                    </div>

                    {showSlug && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-text">
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
                            <div className="flex items-center">
                                <div className="bg-text/5 border border-r-0 border-text/15 rounded-l-xl px-3 py-2.5 text-text/50 text-sm font-mono">
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
                                    className="flex-1 px-4 py-2.5 rounded-r-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm font-mono transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="block text-sm font-medium text-text">
                                Excerpt{" "}
                                <span className="text-text/40 font-normal">(optional)</span>
                            </label>
                            <span
                                className={`text-xs ${
                                    excerpt.length > 280
                                        ? "text-amber-500 font-medium"
                                        : "text-text/40"
                                }`}
                            >
                                {excerpt.length}/300
                            </span>
                        </div>
                        <textarea
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            rows={3}
                            maxLength={300}
                            placeholder="A brief summary..."
                            className="w-full px-4 py-3 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all placeholder:text-text/30 leading-relaxed"
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <button
                                onClick={async () => {
                                    if (
                                        currentContent.length < MIN_CONTENT_FOR_EXCERPT
                                    ) {
                                        addNotification(
                                            `Write at least ${MIN_CONTENT_FOR_EXCERPT} characters.`,
                                            "error",
                                            { title: "Content Too Short" }
                                        )
                                        return
                                    }
                                    if (
                                        lastGenerateTime &&
                                        Date.now() - lastGenerateTime < AI_COOLDOWN_MS
                                    ) {
                                        addNotification(
                                            `Wait ${Math.ceil(
                                                (AI_COOLDOWN_MS -
                                                    (Date.now() - lastGenerateTime)) /
                                                    1000
                                            )}s.`,
                                            "warning",
                                            { title: "Cooldown Active" }
                                        )
                                        return
                                    }
                                    const contentToUse =
                                        currentContent.length > MAX_CONTENT_FOR_EXCERPT
                                            ? currentContent.slice(0, MAX_CONTENT_FOR_EXCERPT)
                                            : currentContent
                                    setIsGeneratingExcerpt(true)
                                    try {
                                        const res = await generateExcerptAction(contentToUse)
                                        if (res.success && res.excerpt) {
                                            setExcerpt(res.excerpt)
                                            setLastGenerateTime(Date.now())
                                            addNotification("Excerpt generated!", "success", {
                                                duration: 3000,
                                            })
                                        } else addNotification(res.error || "Failed", "error")
                                    } catch {
                                        addNotification(
                                            "Failed to generate excerpt",
                                            "error"
                                        )
                                    }
                                    finally {
                                        setIsGeneratingExcerpt(false)
                                    }
                                }}
                                disabled={
                                    isGeneratingExcerpt ||
                                    currentContent.length < MIN_CONTENT_FOR_EXCERPT ||
                                    cooldownRemaining > 0
                                }
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-primary to-primary/80 rounded-lg hover:shadow-md hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                {isGeneratingExcerpt ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3 h-3" />
                                        {cooldownRemaining > 0
                                            ? `Wait ${cooldownRemaining}s`
                                            : "Generate with AI"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium text-text">
                            Content <span className="text-red-500">*</span>
                        </label>
                        <div className="rounded-xl border border-text/15 bg-background overflow-hidden focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
                            <EditorToolbar
                                editor={editor}
                                onImageUpload={() => {
                                    const input = document.createElement("input")
                                    input.type = "file"
                                    input.accept = "image/*"
                                    input.onchange = (e) => {
                                        const file = (
                                            e.target as HTMLInputElement
                                        ).files?.[0]
                                        if (file) handleInlineImageUpload(file)
                                    }
                                    input.click()
                                }}
                            />
                            {showPreview ? (
                                <div className="prose prose-stone max-w-none p-6 min-h-[400px] overflow-auto">
                                    <MarkdownRender content={currentContent} />
                                </div>
                            ) : (
                                <EditorContent
                                    editor={editor}
                                    className="min-h-[400px]"
                                />
                            )}
                        </div>
                        <p className="text-xs text-text/50 flex items-center gap-1.5 justify-end mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                            Estimated read time:{" "}
                            <span className="font-medium text-text">
                                {readingTime} min
                            </span>
                        </p>
                    </div>
                </div>

                {isFullMode && (
                    <div className="p-6 space-y-8 bg-tertiary/20 overflow-y-auto custom-scrollbar h-full border-t lg:border-t-0 border-text/10">
                        <div className="bg-background p-4 rounded-xl shadow-sm border border-text/5 space-y-3">
                            <label className="text-xs font-bold text-text/40 uppercase tracking-wider block mb-1">
                                Publishing
                            </label>
                            <button
                                onClick={() => handleSubmit("published")}
                                disabled={isSubmitting}
                                className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}{" "}
                                Publish Post
                            </button>
                            <button
                                onClick={() => handleSubmit("draft")}
                                disabled={isSubmitting}
                                className="w-full px-4 py-2.5 rounded-lg border border-text/10 bg-white text-text/70 font-medium hover:bg-text/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}{" "}
                                Save to Drafts
                            </button>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-text/40 uppercase tracking-wider block">
                                Classification
                            </label>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-text">
                                    Category
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) =>
                                        setCategory(e.target.value as BlogCategory)
                                    }
                                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none appearance-none cursor-pointer transition-all"
                                >
                                    {categories.map((cat) => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-text/50 px-1">
                                    {categories.find((c) => c.value === category)?.description}
                                </p>
                            </div>
                        </div>

                        {showTags && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-text">
                                    Tags
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" ||
                                                e.key === ","
                                            ) {
                                                e.preventDefault()
                                                handleAddTag()
                                            }
                                        }}
                                        placeholder="Add a tag..."
                                        className="flex-1 px-3 py-2 rounded-lg border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all"
                                    />
                                    <button
                                        onClick={handleAddTag}
                                        disabled={
                                            !tagInput.trim() || tags.length >= 10
                                        }
                                        className="px-3 bg-text/5 text-text border border-text/10 rounded-lg hover:bg-text/10 transition-colors disabled:opacity-50 font-medium text-sm"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-white border border-text/10 text-text/70 text-xs font-medium rounded-full shadow-sm"
                                        >
                                            #{tag}
                                            <button
                                                onClick={() => handleRemoveTag(tag)}
                                                className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <p className="text-xs text-text/40 text-right">
                                    {tags.length}/10 tags
                                </p>
                            </div>
                        )}

                        {showTags && (
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-medium text-text">
                                    <Images className="w-4 h-4 text-text opacity-50" />
                                    Gallery Images
                                </label>
                                {galleryImages.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {galleryImages.map((image, index) => (
                                            <div
                                                key={image}
                                                className="relative aspect-square rounded-lg overflow-hidden bg-text/5 group"
                                            >
                                                <Image
                                                    src={image}
                                                    alt={`Gallery ${index + 1}`}
                                                    fill
                                                    className="object-cover"
                                                />
                                                <button
                                                    onClick={() =>
                                                        handleRemoveGalleryImage(index)
                                                    }
                                                    className="absolute top-1 right-1 p-1.5 bg-white/90 text-red-500 rounded-md hover:bg-white shadow-sm transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => galleryInputRef.current?.click()}
                                    disabled={
                                        isUploadingGallery || galleryImages.length >= 10
                                    }
                                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-text/10 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-text/50 hover:text-primary disabled:opacity-50"
                                >
                                    {isUploadingGallery ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-sm">Uploading...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon className="w-4 h-4" />
                                            <span className="text-sm">
                                                Add Images ({galleryImages.length}/10)
                                            </span>
                                        </>
                                    )}
                                </button>
                                <input
                                    ref={galleryInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleGalleryUpload}
                                    className="hidden"
                                />
                            </div>
                        )}

                        {showCafePicker && (
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-text">
                                    <MapPin className="w-4 h-4 text-text opacity-50" />
                                    Tagged Cafes
                                </label>
                                <BlogCafePicker
                                    selectedCafeIds={taggedCafeIds}
                                    onChange={setTaggedCafeIds}
                                    maxCafes={5}
                                />
                            </div>
                        )}

                        {showCrawlPicker && (
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-text">
                                    <Route className="w-4 h-4 text-text opacity-50" />
                                    Linked Crawl
                                </label>
                                <BlogCrawlPicker
                                    selectedCrawlId={linkedCrawlId}
                                    onChange={setLinkedCrawlId}
                                />
                            </div>
                        )}

                        {showFeatured && !cafeId && (
                            <div className="bg-background p-4 rounded-xl border border-text/5 flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-medium text-text block">
                                        Featured Post
                                    </label>
                                    <span className="text-xs text-text/50">
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
                )}
            </div>
        </div>
    )
}
