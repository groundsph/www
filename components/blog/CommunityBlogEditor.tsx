"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Send, Loader2, ImageIcon, Trash2, RefreshCw, Sparkles } from "lucide-react"
import { useNotification } from "@/components/layout/NotificationProvider"
import { createCommunityBlogPost } from "@/app/api/actions/blog"
import { generateExcerptAction, listModelsAction } from "@/app/api/actions/ai"
import { uploadBlogImageAction } from "@/utils/storage/actions"
import { compressBlogCover } from "@/utils/image-processing"
import { estimateReadingTime } from "@/utils/types/blog"

// ============================================================================
// Constants
// ============================================================================

const MAX_CONTENT_FOR_EXCERPT = 6000
const MIN_CONTENT_FOR_EXCERPT = 50
const AI_COOLDOWN_MS = 20000 // 20 seconds
const MODEL_RETRY_DELAYS = [500, 1000, 2000] // 0.5s, 1s, 2s
const MAX_MODEL_RETRIES = 3

// ============================================================================
// Component
// ============================================================================

export default function CommunityBlogEditor() {
    const router = useRouter()
    const { addNotification } = useNotification()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")
    const [excerpt, setExcerpt] = useState("")
    const [coverImage, setCoverImage] = useState<string | null>(null)

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isGeneratingExcerpt, setIsGeneratingExcerpt] = useState(false)

    // AI model state
    const [availableModels, setAvailableModels] = useState<string[]>([])
    const [selectedModel, setSelectedModel] = useState<string>("")
    const [isLoadingModels, setIsLoadingModels] = useState(true)
    const [modelLoadError, setModelLoadError] = useState<string | null>(null)

    // Cooldown state
    const [lastGenerateTime, setLastGenerateTime] = useState<number | null>(null)
    const [cooldownRemaining, setCooldownRemaining] = useState(0)

    // ============================================================================
    // Model Loading with Retry
    // ============================================================================

    const loadModels = useCallback(
        async (retryAttempt = 0) => {
            setIsLoadingModels(true)
            setModelLoadError(null)

            try {
                const result = await listModelsAction()

                if (result.success && result.models && result.models.length > 0) {
                    setAvailableModels(result.models)
                    setModelLoadError(null)

                    // Set default model
                    const defaultModel = result.defaultModel
                    if (defaultModel && result.models.includes(defaultModel)) {
                        setSelectedModel(defaultModel)
                    } else {
                        setSelectedModel(result.models[0])
                    }
                } else if (result.error) {
                    throw new Error(result.error)
                } else {
                    throw new Error("No models available")
                }
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : "Failed to load AI models"

                // Retry logic
                if (retryAttempt < MAX_MODEL_RETRIES) {
                    const delay = MODEL_RETRY_DELAYS[retryAttempt] || 2000

                    setTimeout(() => {
                        loadModels(retryAttempt + 1)
                    }, delay)
                } else {
                    // All retries exhausted
                    setModelLoadError(errorMessage)
                    setAvailableModels([])
                    setSelectedModel("")
                    addNotification(errorMessage, "error", {
                        title: "AI Models Unavailable",
                    })
                }
            } finally {
                setIsLoadingModels(false)
            }
        },
        [addNotification]
    )

    // Initial load
    useEffect(() => {
        loadModels()
    }, [loadModels])

    // ============================================================================
    // Cooldown Timer
    // ============================================================================

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

    // ============================================================================
    // Handlers
    // ============================================================================

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)

        try {
            // Compress blog cover (200KB JPEG for OG compatibility)
            const compressedFile = await compressBlogCover(file)

            const formData = new FormData()
            formData.append("image", compressedFile)

            const result = await uploadBlogImageAction(formData)

            if (result.success && result.url) {
                setCoverImage(result.url)
            } else {
                addNotification(result.error || "Failed to upload image", "error", {
                    title: "Upload Failed",
                })
            }
        } catch (err) {
            console.error(err)
            addNotification("Failed to upload image", "error", {
                title: "Upload Failed",
            })
        } finally {
            setIsUploading(false)
        }
    }

    const handleGenerateExcerpt = async () => {
        // Guard: content length check
        if (content.length < MIN_CONTENT_FOR_EXCERPT) {
            addNotification(
                `Please write at least ${MIN_CONTENT_FOR_EXCERPT} characters before generating an excerpt.`,
                "error",
                { title: "Content Too Short" }
            )
            return
        }

        // Guard: model selected check
        if (!selectedModel) {
            addNotification("Please select an AI model first.", "error", {
                title: "No Model Selected",
            })
            return
        }

        // Guard: cooldown check
        if (lastGenerateTime && Date.now() - lastGenerateTime < AI_COOLDOWN_MS) {
            const remainingSeconds = Math.ceil(
                (AI_COOLDOWN_MS - (Date.now() - lastGenerateTime)) / 1000
            )
            addNotification(
                `Please wait ${remainingSeconds} seconds before generating again.`,
                "warning",
                { title: "Cooldown Active" }
            )
            return
        }

        // Limit content length for excerpt generation
        let contentToUse = content
        if (content.length > MAX_CONTENT_FOR_EXCERPT) {
            contentToUse = content.slice(0, MAX_CONTENT_FOR_EXCERPT)
            addNotification(
                `Using first ${MAX_CONTENT_FOR_EXCERPT.toLocaleString()} characters for excerpt generation.`,
                "warning",
                { title: "Content Truncated" }
            )
        }

        setIsGeneratingExcerpt(true)

        try {
            const result = await generateExcerptAction(contentToUse, selectedModel)

            if (result.success && result.excerpt) {
                setExcerpt(result.excerpt)
                setLastGenerateTime(Date.now())
                addNotification("Excerpt generated successfully!", "success", {
                    title: "AI Generated",
                    duration: 3000,
                })
            } else {
                addNotification(result.error || "Failed to generate excerpt", "error", {
                    title: "Generation Failed",
                })
            }
        } catch (err) {
            console.error(err)
            addNotification("An unexpected error occurred while generating the excerpt.", "error", {
                title: "Generation Failed",
            })
        } finally {
            setIsGeneratingExcerpt(false)
        }
    }

    const handleSubmit = async () => {
        // Validation
        if (!title.trim()) {
            addNotification("Please enter a title for your post.", "error", {
                title: "Title Required",
            })
            return
        }

        if (!content.trim()) {
            addNotification("Please write some content for your post.", "error", {
                title: "Content Required",
            })
            return
        }

        setIsSubmitting(true)

        try {
            const result = await createCommunityBlogPost({
                title: title.trim(),
                content: content.trim(),
                excerpt: excerpt.trim() || undefined,
                cover_image: coverImage,
            })

            if (result.success) {
                addNotification(
                    "Your post has been submitted for review and will be published after approval.",
                    "success",
                    {
                        title: "Post Submitted",
                        duration: 5000,
                    }
                )
                router.push("/profile/blogs")
            } else {
                addNotification(result.error || "Failed to submit post", "error", {
                    title: "Submission Failed",
                })
            }
        } catch (err) {
            console.error(err)
            addNotification("An unexpected error occurred. Please try again.", "error", {
                title: "Submission Failed",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    // ============================================================================
    // Derived State
    // ============================================================================

    const canGenerateExcerpt =
        content.length >= MIN_CONTENT_FOR_EXCERPT &&
        !!selectedModel &&
        cooldownRemaining === 0 &&
        !isGeneratingExcerpt

    const readingTime = estimateReadingTime(content)

    // ============================================================================
    // Render
    // ============================================================================

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-text/10 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold font-serif text-text">
                                Create Community Post
                            </h1>
                            <p className="text-sm text-text/60 mt-1">
                                Share your coffee story with the community
                            </p>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-4 sm:px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">Submit Post</span>
                            <span className="sm:hidden">Submit</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                <div className="space-y-8">
                    {/* Cover Image */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-text">
                            Cover Image{" "}
                            <span className="text-text/40 font-normal">(optional)</span>
                        </label>
                        {coverImage ? (
                            <div className="relative aspect-video rounded-2xl overflow-hidden bg-text/5 ring-1 ring-black/5 group">
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
                                    aria-label="Remove cover image"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-full aspect-video rounded-2xl border-2 border-dashed border-text/10 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center gap-3 text-text/40 hover:text-primary group"
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

                    {/* Title */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-text">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter a compelling title..."
                            className="w-full px-4 py-3 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-lg font-medium transition-all placeholder:text-text/30"
                        />
                    </div>

                    {/* Excerpt */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="block text-sm font-medium text-text">
                                Excerpt{" "}
                                <span className="text-text/40 font-normal">(optional)</span>
                            </label>
                            <span
                                className={`text-xs ${
                                    excerpt.length > 280 ? "text-amber-500 font-medium" : "text-text/40"
                                }`}
                            >
                                {excerpt.length}/300
                            </span>
                        </div>
                        <textarea
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            placeholder="A brief summary of your post that will appear in cards and search results..."
                            rows={3}
                            maxLength={300}
                            className="w-full px-4 py-3 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all placeholder:text-text/30 leading-relaxed"
                        />

                        {/* AI Generation */}
                        <div className="flex items-center gap-3 mt-3">
                            {/* Model Selector */}
                            <div className="relative">
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    disabled={
                                        isLoadingModels ||
                                        availableModels.length === 0 ||
                                        isGeneratingExcerpt
                                    }
                                    className="pl-3 pr-8 py-2 rounded-lg border border-text/15 bg-background text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none cursor-pointer hover:bg-text/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                                >
                                    {isLoadingModels ? (
                                        <option value="">Loading models...</option>
                                    ) : modelLoadError ? (
                                        <option value="">Models unavailable</option>
                                    ) : availableModels.length === 0 ? (
                                        <option value="">No models available</option>
                                    ) : (
                                        availableModels.map((model) => (
                                            <option key={model} value={model}>
                                                {model}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text/40">
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M2.5 4.5L6 8L9.5 4.5"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </div>
                            </div>

                            {/* Retry Button (shown on error) */}
                            <AnimatePresence>
                                {modelLoadError && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        onClick={() => loadModels()}
                                        disabled={isLoadingModels}
                                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                                    >
                                        <RefreshCw
                                            className={`w-4 h-4 ${isLoadingModels ? "animate-spin" : ""}`}
                                        />
                                        Retry
                                    </motion.button>
                                )}
                            </AnimatePresence>

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerateExcerpt}
                                disabled={!canGenerateExcerpt}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary to-primary/80 rounded-lg hover:shadow-md hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all active:scale-95"
                                title={
                                    content.length < MIN_CONTENT_FOR_EXCERPT
                                        ? `Need at least ${MIN_CONTENT_FOR_EXCERPT} characters`
                                        : !selectedModel
                                            ? "Select a model first"
                                            : cooldownRemaining > 0
                                                ? `Wait ${cooldownRemaining}s`
                                                : "Generate excerpt with AI"
                                }
                            >
                                {isGeneratingExcerpt ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        {cooldownRemaining > 0
                                            ? `Wait ${cooldownRemaining}s`
                                            : "Generate with AI"}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Helper text */}
                        <p className="text-xs text-text/50">
                            {content.length < MIN_CONTENT_FOR_EXCERPT
                                ? `Write at least ${MIN_CONTENT_FOR_EXCERPT} characters to enable AI generation`
                                : "AI will analyze your content and create a compelling excerpt"}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-text">
                                Content <span className="text-red-500">*</span>
                            </label>
                            <span className="text-xs text-text/50">
                                Markdown supported
                            </span>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write your blog post content here...

Share your coffee experiences, brewing tips, cafe discoveries, or anything related to the coffee community."
                            rows={15}
                            className="w-full px-4 py-4 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none resize-none font-mono text-sm leading-relaxed transition-all placeholder:text-text/30"
                        />
                        <div className="flex items-center justify-between text-xs text-text/50">
                            <span>{content.length.toLocaleString()} characters</span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                Estimated read time:{" "}
                                <span className="font-medium text-text">{readingTime} min</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
