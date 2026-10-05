"use client"

import { X, MapPin, Images, Route, LayoutList } from "lucide-react"
import Image from "next/image"
import MarkdownRender from "@/components/ui/MarkdownRender"
import { UserAvatar } from "@/components/ui/UserAvatar"
import type { BlogPost } from "@/utils/types/blog"
import { getBlogStatusLabel, getBlogStatusStyle } from "@/utils/blog/status-styles"

interface BlogPostPreviewModalProps {
    post: BlogPost
    onClose: () => void
}

/**
 * Read-only preview used by moderation. Admins must not edit other people's
 * posts, so this intentionally exposes no editing affordances.
 */
export default function BlogPostPreviewModal({
    post,
    onClose,
}: BlogPostPreviewModalProps) {
    const blocks = post.blocks ?? []
    const cafeBlocks = blocks.filter(
        (b) => b.type === "cafe" || b.type === "cafe-carousel"
    )
    const imageBlocks = blocks.filter(
        (b) => b.type === "image" || b.type === "gallery"
    )
    const crawlBlocks = blocks.filter((b) => b.type === "crawl")

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-background shadow-xl ring-1 ring-text/10">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-tertiary/50 p-5">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-text">
                            Post Preview
                        </h2>
                        <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getBlogStatusStyle(post.status)}`}
                        >
                            {getBlogStatusLabel(post.status)}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-text/40 transition-colors hover:bg-text/5 hover:text-text"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {post.cover_image && (
                        <div className="relative mb-6 h-48 w-full overflow-hidden rounded-xl bg-text/5 md:h-64">
                            <Image
                                src={post.cover_image}
                                alt={post.title}
                                fill
                                className="object-cover"
                            />
                        </div>
                    )}

                    <h1 className="mb-4 text-2xl font-bold text-text md:text-3xl">
                        {post.title || "(untitled)"}
                    </h1>

                    <div className="mb-6 flex items-center gap-3 rounded-xl bg-tertiary/10 p-3">
                        {post.author && (
                            <>
                                <UserAvatar
                                    src={post.author.avatar_url}
                                    alt={post.author.display_name}
                                    size={40}
                                />
                                <div className="flex-1">
                                    <p className="font-medium text-text">
                                        {post.author.display_name}
                                    </p>
                                    <p className="text-sm text-text/60">
                                        @{post.author.username}
                                    </p>
                                </div>
                            </>
                        )}
                        <span className="text-xs text-text/50">
                            {post.created_at &&
                                new Date(post.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                        </span>
                    </div>

                    {post.status === "rejected" && post.rejection_reason && (
                        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                            <p className="text-sm font-medium text-red-600">
                                Rejection reason
                            </p>
                            <p className="mt-1 text-sm text-text/80">
                                {post.rejection_reason}
                            </p>
                        </div>
                    )}

                    {post.excerpt && (
                        <p className="mb-6 rounded-xl bg-tertiary/10 p-4 italic text-text/80">
                            {post.excerpt}
                        </p>
                    )}

                    <MarkdownRender content={post.content} />

                    {/* Non-text block summary */}
                    {(cafeBlocks.length > 0 ||
                        imageBlocks.length > 0 ||
                        crawlBlocks.length > 0) && (
                        <div className="mt-6 space-y-2 rounded-xl border border-text/10 bg-text/5 p-4 text-sm text-text/70">
                            <p className="flex items-center gap-2 font-medium text-text/80">
                                <LayoutList className="w-4 h-4 text-primary" />
                                Attached blocks
                            </p>
                            {cafeBlocks.length > 0 && (
                                <p className="flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-primary" />
                                    {cafeBlocks.length} cafe block
                                    {cafeBlocks.length === 1 ? "" : "s"}
                                </p>
                            )}
                            {imageBlocks.length > 0 && (
                                <p className="flex items-center gap-2">
                                    <Images className="w-3.5 h-3.5 text-primary" />
                                    {imageBlocks.length} image block
                                    {imageBlocks.length === 1 ? "" : "s"}
                                </p>
                            )}
                            {crawlBlocks.length > 0 && (
                                <p className="flex items-center gap-2">
                                    <Route className="w-3.5 h-3.5 text-primary" />
                                    {crawlBlocks.length} crawl block
                                    {crawlBlocks.length === 1 ? "" : "s"}
                                </p>
                            )}
                        </div>
                    )}

                    {post.tags && post.tags.length > 0 && (
                        <div className="mt-6 flex flex-wrap gap-2">
                            {post.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-full bg-text/5 px-3 py-1 text-xs text-text/70"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
