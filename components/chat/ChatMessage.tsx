"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import MarkdownRender from "@/components/ui/MarkdownRender"
import { cn } from "@/utils/cn"
import type { ChatMessage } from "@/utils/types/chat"
import { submitChatFeedback } from "@/app/api/actions/chat-feedback"
import ChatCafeCarousel from "./ChatCafeCarousel"
import ChatCrawlPreview from "./ChatCrawlPreview"
import ShrinkwrapBubble from "./ShrinkwrapBubble"

interface ChatMessageProps {
    message: ChatMessage
}

type FeedbackState = "none" | "up" | "down"

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user"
    const [feedbackState, setFeedbackState] = useState<FeedbackState>(
        message.feedback === "positive" ? "up" : message.feedback === "negative" ? "down" : "none"
    )
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleFeedback = async (type: "up" | "down") => {
        // Prevent duplicate feedback
        if (feedbackState !== "none" || isSubmitting) return

        setIsSubmitting(true)
        const rating = type === "up" ? 1 : -1

        try {
            const result = await submitChatFeedback(message.id, rating)
            if (result.success) {
                setFeedbackState(type)
            }
        } catch (error) {
            console.error("Failed to submit feedback:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
        >
            <div className="max-w-[90%]">
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                    <ShrinkwrapBubble
                        text={message.content}
                        font="14px Inter, ui-sans-serif, system-ui, sans-serif"
                        maxWidth={380}
                        minWidth={40}
                        className={cn(
                            "px-4 py-2.5 rounded-2xl border text-sm leading-relaxed",
                            isUser
                                ? "bg-secondary/10 border-secondary/20 rounded-br-md text-right ml-auto"
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
                            <div className="flex items-center gap-1 mt-1">
                                <motion.button
                                    whileHover={feedbackState === "none" && !isSubmitting ? { scale: 1.1 } : {}}
                                    whileTap={feedbackState === "none" && !isSubmitting ? { scale: 0.9 } : {}}
                                    onClick={() => handleFeedback("up")}
                                    disabled={feedbackState !== "none" || isSubmitting}
                                    className={cn(
                                        "p-1 rounded transition-colors",
                                        feedbackState === "up"
                                            ? "text-green-500 bg-green-500/10"
                                            : feedbackState === "none" && !isSubmitting
                                                ? "text-text/30 hover:text-text/60"
                                                : "text-text/20 cursor-default"
                                    )}
                                    aria-label="Helpful response"
                                >
                                    <ThumbsUp
                                        className={cn(
                                            "w-3 h-3 transition-all",
                                            feedbackState === "up" && "fill-current"
                                        )}
                                    />
                                </motion.button>
                                <motion.button
                                    whileHover={feedbackState === "none" && !isSubmitting ? { scale: 1.1 } : {}}
                                    whileTap={feedbackState === "none" && !isSubmitting ? { scale: 0.9 } : {}}
                                    onClick={() => handleFeedback("down")}
                                    disabled={feedbackState !== "none" || isSubmitting}
                                    className={cn(
                                        "p-1 rounded transition-colors",
                                        feedbackState === "down"
                                            ? "text-red-500 bg-red-500/10"
                                            : feedbackState === "none" && !isSubmitting
                                                ? "text-text/30 hover:text-text/60"
                                                : "text-text/20 cursor-default"
                                    )}
                                    aria-label="Not helpful"
                                >
                                    <ThumbsDown
                                        className={cn(
                                            "w-3 h-3 transition-all",
                                            feedbackState === "down" && "fill-current"
                                        )}
                                    />
                                </motion.button>
                            </div>
                        )}
                    </ShrinkwrapBubble>
                </motion.div>
            </div>
        </div>
    )
}
