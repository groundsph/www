"use client"

import { useHaptics } from "@/hooks/useHaptics"
import Link from "next/link"
import Image from "next/image"
import { Coffee, Eye, Bookmark, Heart, MapIcon } from "lucide-react"

export interface CrawlCardProps {
    crawl: {
        id: string
        title: string
        slug: string
        coverImage?: string | null
        itemCount?: number
        viewsCount?: number
        savesCount?: number
        likesCount?: number
    }
}

export default function CrawlCard({ crawl }: CrawlCardProps) {
    const { trigger } = useHaptics()
    return (
        <Link
            href={`/community/crawls/${crawl.slug}`}
            onClick={() => trigger("light")}
            className="group block bg-background border border-secondary/20 rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
        >
            <div className="relative aspect-16/10 bg-secondary/10">
                {crawl.coverImage ? (
                    <Image
                        src={crawl.coverImage}
                        alt={crawl.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-primary/20 to-accent/20">
                        <MapIcon className="w-12 h-12 text-primary opacity-40" />
                    </div>
                )}
            </div>
            <div className="p-4">
                <h3 className="font-serif font-semibold text-lg text-text group-hover:text-primary transition-colors line-clamp-1">
                    {crawl.title}
                </h3>
                <div className="flex items-center gap-4 mt-3 text-sm text-text/50">
                    <span className="flex items-center gap-1">
                        <Coffee className="w-3.5 h-3.5" />
                        {crawl.itemCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {crawl.viewsCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5" />
                        {crawl.likesCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                        <Bookmark className="w-3.5 h-3.5" />
                        {crawl.savesCount ?? 0}
                    </span>
                </div>
            </div>
        </Link>
    )
}
