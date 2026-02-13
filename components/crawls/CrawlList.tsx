import CrawlCard from "./CrawlCard"
import { Crawl } from "@/utils/types/cafe-crawls"

export interface CrawlListProps {
    crawls: Crawl[]
}

export default function CrawlList({ crawls }: CrawlListProps) {
    if (crawls.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-text/60">No crawls found</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {crawls.map((crawl) => (
                <CrawlCard key={crawl.id} crawl={crawl} />
            ))}
        </div>
    )
}
