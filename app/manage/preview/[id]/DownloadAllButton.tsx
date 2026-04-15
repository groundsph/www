"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { downloadAllImages } from "@/utils/image-download"
import { getOptimizedImageUrl } from "@/utils/cloudflare-image"

interface DownloadButtonProps {
    cafeName: string
    thumbnail: string | null
    gallery: string[] | null
}

export default function DownloadAllButton({
    cafeName,
    thumbnail,
    gallery,
}: DownloadButtonProps) {
    const [downloading, setDownloading] = useState(false)

    const handleDownloadAll = async () => {
        setDownloading(true)
        const images: { url: string; filename: string }[] = []

        if (thumbnail) {
            images.push({
                url: getOptimizedImageUrl(thumbnail, { width: 1920 }) || thumbnail,
                filename: `${cafeName}-thumbnail.webp`,
            })
        }

        gallery?.forEach((url, index) => {
            images.push({
                url: getOptimizedImageUrl(url, { width: 1920 }) || url,
                filename: `${cafeName}-gallery-${index + 1}.webp`,
            })
        })

        await downloadAllImages(images)
        setDownloading(false)
    }

    return (
        <button
            onClick={handleDownloadAll}
            disabled={downloading || ((gallery?.length ?? 0) === 0 && !thumbnail)}
            className='flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed'
        >
            {downloading ? (
                <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
                <Download className='w-4 h-4' />
            )}
            Download All Images
        </button>
    )
}
