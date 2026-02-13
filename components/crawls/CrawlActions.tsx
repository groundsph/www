"use client"

import { useState } from "react"
import { Bookmark, Share2 } from "lucide-react"
import { toggleSaveCafeCrawl } from "@/app/api/actions/cafe-crawls"
import { useAuth } from "@/components/layout/AuthProvider"
import CrawlReportButton from "./CrawlReportButton"

interface CrawlActionsProps {
    crawlId: string
    slug: string
    saved: boolean
    savesCount: number
    isOwner?: boolean
}

export default function CrawlActions({
    crawlId,
    slug,
    saved: initialSaved,
    savesCount: initialSavesCount,
    isOwner = false,
}: CrawlActionsProps) {
    const { user } = useAuth()
    const [saved, setSaved] = useState(initialSaved)
    const [savesCount, setSavesCount] = useState(initialSavesCount)
    const [isSaving, setIsSaving] = useState(false)
    const [copied, setCopied] = useState(false)

    const handleSave = async () => {
        if (!user) return
        if (isSaving) return

        setIsSaving(true)
        try {
            const result = await toggleSaveCafeCrawl(crawlId)
            if (result.success) {
                setSaved(result.saved)
                setSavesCount((prev) => (result.saved ? prev + 1 : prev - 1))
            }
        } catch (error) {
            console.error("Failed to toggle save:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleShare = async () => {
        const url = `${window.location.origin}/community/crawls/${slug}`
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Fallback
            const input = document.createElement("input")
            input.value = url
            document.body.appendChild(input)
            input.select()
            document.execCommand("copy")
            document.body.removeChild(input)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <div className='flex items-center gap-2'>
            <button
                onClick={handleShare}
                className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-text/70 hover:text-text border border-secondary/30 rounded-full hover:bg-secondary/10 transition-colors'
            >
                <Share2 className='w-4 h-4' />
                {copied ? "Copied!" : "Share"}
            </button>

            <button
                onClick={handleSave}
                disabled={!user || isSaving}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                    saved
                        ? "bg-primary text-white"
                        : "text-text/70 hover:text-primary border border-secondary/30 hover:border-primary/50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <Bookmark
                    className={`w-4 h-4 ${saved ? "fill-current" : ""}`}
                />
                <span>{savesCount}</span>
            </button>

            {!isOwner && <CrawlReportButton crawlId={crawlId} />}
        </div>
    )
}
