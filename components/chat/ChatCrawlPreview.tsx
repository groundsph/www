"use client"

import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { MapPin, Route } from "lucide-react"
import type { ChatCrawlDraft } from "@/utils/types/chat"
import { saveChatCrawlDraft } from "@/utils/chat-crawl-draft"
import { emitChatEvent } from "@/utils/chat-events"
import { useHaptics } from "@/hooks/useHaptics"

interface ChatCrawlPreviewProps {
    draft: ChatCrawlDraft
}

export default function ChatCrawlPreview({ draft }: ChatCrawlPreviewProps) {
    const router = useRouter()
    const { trigger } = useHaptics()

    const handleSave = () => {
        saveChatCrawlDraft({ ...draft, isPublic: false })
        emitChatEvent({ type: "close" })
        router.push("/community/crawls/create?draft=chat")
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className='mt-3 border border-primary/10 rounded-xl p-3 bg-secondary/5'
        >
            <div className='flex items-start justify-between gap-3'>
                <div>
                    <p className='text-sm font-semibold text-text'>
                        {draft.title}
                    </p>
                    {draft.description && (
                        <p className='text-xs text-text/60 mt-1'>
                            {draft.description}
                        </p>
                    )}
                    <p className='text-xs text-text/60 mt-2 flex items-center gap-1'>
                        <Route className='w-3 h-3' />
                        {draft.items.length} stops
                    </p>
                </div>
                <motion.button
                    onClick={() => { trigger("success"); handleSave() }}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className='px-3 py-2 text-xs font-bold rounded-lg bg-text text-background shadow-none transition-colors text-nowrap'
                >
                    Save Crawl
                </motion.button>
            </div>

            {draft.items.length > 0 && (
                <div className='mt-3 space-y-2'>
                    {draft.items.slice(0, 4).map((item, index) => (
                        <motion.div
                            key={item.cafeId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.06, type: "spring", stiffness: 400, damping: 25 }}
                            className='flex items-center gap-2 text-xs text-text/70'
                        >
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: index * 0.06 + 0.1, type: "spring", stiffness: 500, damping: 20 }}
                                className='w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center'
                            >
                                {item.sortOrder + 1}
                            </motion.span>
                            <span className='truncate'>{item.name}</span>
                            {(item.cityMunicipality || item.region) && (
                                <span className='ml-auto flex items-center gap-1 text-text/40'>
                                    <MapPin className='w-3 h-3' />
                                    {item.cityMunicipality ?? item.region}
                                </span>
                            )}
                        </motion.div>
                    ))}
                    {draft.items.length > 4 && (
                        <p className='text-xs text-text/40 text-center'>
                            +{draft.items.length - 4} more
                        </p>
                    )}
                </div>
            )}
        </motion.div>
    )
}
