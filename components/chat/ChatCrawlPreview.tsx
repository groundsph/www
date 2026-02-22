"use client"

import { useRouter } from "next/navigation"
import { MapPin, Route } from "lucide-react"
import type { ChatCrawlDraft } from "@/utils/types/chat"
import { saveChatCrawlDraft } from "@/utils/chat-crawl-draft"

interface ChatCrawlPreviewProps {
    draft: ChatCrawlDraft
}

export default function ChatCrawlPreview({ draft }: ChatCrawlPreviewProps) {
    const router = useRouter()

    const handleSave = () => {
        saveChatCrawlDraft({ ...draft, isPublic: false })
        router.push("/community/crawls/create?draft=chat")
    }

    return (
        <div className="mt-3 border border-primary/10 rounded-xl p-3 bg-secondary/5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-text">{draft.title}</p>
                    {draft.description && (
                        <p className="text-xs text-text/60 mt-1">{draft.description}</p>
                    )}
                    <p className="text-xs text-text/60 mt-2 flex items-center gap-1">
                        <Route className="w-3 h-3" />
                        {draft.items.length} stops
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    className="px-3 py-2 text-xs font-medium rounded-full bg-primary text-primary-foreground"
                >
                    Save Crawl
                </button>
            </div>

            {draft.items.length > 0 && (
                <div className="mt-3 space-y-2">
                    {draft.items.slice(0, 4).map((item) => (
                        <div key={item.cafeId} className="flex items-center gap-2 text-xs text-text/70">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                {item.sortOrder + 1}
                            </span>
                            <span className="truncate">{item.name}</span>
                            {(item.cityMunicipality || item.region) && (
                                <span className="ml-auto flex items-center gap-1 text-text/40">
                                    <MapPin className="w-3 h-3" />
                                    {item.cityMunicipality ?? item.region}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
