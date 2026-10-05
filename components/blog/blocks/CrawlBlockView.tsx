"use client"

import BlogCrawlEmbed, { type CrawlEmbedData } from "@/components/blog/BlogCrawlEmbed"
import { Route } from "lucide-react"

interface CrawlBlockViewProps {
    crawl: CrawlEmbedData | undefined
}

/** Embedded cafe crawl itinerary. */
export default function CrawlBlockView({ crawl }: CrawlBlockViewProps) {
    if (!crawl) {
        return (
            <div className="my-6 rounded-2xl border border-dashed border-text/20 bg-text/5 p-6 text-center text-sm text-text/50">
                <Route className="mx-auto mb-2 w-5 h-5 opacity-50" />
                This crawl is no longer available.
            </div>
        )
    }

    return <BlogCrawlEmbed crawl={crawl} />
}
