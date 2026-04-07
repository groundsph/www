"use client"

import { motion } from "motion/react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import MarkdownRender from "@/components/ui/MarkdownRender"
import { cn } from "@/utils/cn"
import type { ChatMessage } from "@/utils/types/chat"
import { submitChatFeedback } from "@/app/api/actions/chat-feedback"
import ChatCafeCarousel from "./ChatCafeCarousel"
import ChatCrawlPreview from "./ChatCrawlPreview"

interface ChatMessageProps {
    message: ChatMessage
}

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user"

    const handleFeedback = async (type: "positive" | "negative") => {
        // Call server action
        await submitChatFeedback({
            messageId: message.id,
            feedback: type,
            messageContent: message.content.slice(0, 500),
        })
    }

    return (
        <div
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
        >
            <div className="flex items-end gap-2 max-w-[90%]">
                {/* {!isUser && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-8 h-8 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0"
                    >
                        <Bot className="w-4 h-4 text-secondary" />
                    </motion.div>
                )} */}
                
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={cn(
                        "px-4 py-2.5 rounded-2xl border text-sm leading-relaxed w-full",
                        isUser
                            ? "bg-secondary/10 border-secondary/20 rounded-br-md text-right"
                            : "bg-background border-primary/10 rounded-bl-md"
                    )}
                >
                    {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                        <div className="max-w-none prose prose-sm">
                            <MarkdownRender content={message.content} compact />
                        </div>
                    )}
                    {message.cafes && message.cafes.length > 0 && (
                        <ChatCafeCarousel cafes={message.cafes} cardContext={message.cardContext} />
                    )}
                    {message.crawlDraft && <ChatCrawlPreview draft={message.crawlDraft} />}
                    {!isUser && (
                        <div className='flex items-center gap-1 mt-1'>
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleFeedback("positive")}
                                className={cn(
                                    "p-1 rounded transition-colors",
                                    message.feedback === "positive"
                                        ? "text-green-500 bg-green-500/10"
                                        : "text-text/30 hover:text-text/60"
                                )}
                                aria-label="Helpful response"
                            >
                                <ThumbsUp className='w-3 h-3' />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleFeedback("negative")}
                                className={cn(
                                    "p-1 rounded transition-colors",
                                    message.feedback === "negative"
                                        ? "text-red-500 bg-red-500/10"
                                        : "text-text/30 hover:text-text/60"
                                )}
                                aria-label="Not helpful"
                            >
                                <ThumbsDown className='w-3 h-3' />
                            </motion.button>
                        </div>
                    )}
                </motion.div>
                
                {/* {isUser && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
                    >
                        <User className="w-4 h-4 text-primary" />
                    </motion.div>
                )} */}
            </div>
        </div>
    )
}
