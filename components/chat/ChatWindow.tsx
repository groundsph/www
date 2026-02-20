"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion } from "motion/react"
import { X, Send, AlertCircle, Loader2 } from "lucide-react"
import ChatMessage from "./ChatMessage"
import { sendChatMessage } from "@/app/api/actions/chat"

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
}

interface ChatWindowProps {
    remainingMessages: number
    onClose: () => void
}

export default function ChatWindow({ remainingMessages, onClose }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentRemaining, setCurrentRemaining] = useState(remainingMessages)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [])

    // Handle Escape key to close chat
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose()
            }
        }
        document.addEventListener("keydown", handleEscape)
        return () => document.removeEventListener("keydown", handleEscape)
    }, [onClose])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading || currentRemaining <= 0) return

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages((prev) => [...prev, userMessage])
        setInput("")
        setIsLoading(true)
        setError(null)

        try {
            const result = await sendChatMessage({ message: userMessage.content })

            if (result.success && result.message) {
                const assistantMessage: Message = {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: result.message,
                    timestamp: new Date(),
                }
                setMessages((prev) => [...prev, assistantMessage])
                setCurrentRemaining(result.remaining)
            } else {
                setError(result.error || "Failed to send message")
                setCurrentRemaining(result.remaining)
            }
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setIsLoading(false)
            setTimeout(scrollToBottom, 100)
        }
    }

    return (
        <div className="w-[380px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
                <div>
                    <h3 className="font-semibold text-sm">Chat with Grounds AI</h3>
                    <p className="text-xs opacity-80">
                        {currentRemaining > 0
                            ? `${currentRemaining} messages remaining`
                            : "No messages remaining"}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-primary-foreground/10 rounded-full transition-colors"
                    aria-label="Close chat"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="h-[400px] max-h-[60vh] overflow-y-auto p-4 space-y-4 bg-background">
                {messages.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                        <p className="text-sm">Ask me about cafes, locations, or recommendations!</p>
                    </div>
                )}
                {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                ))}
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-muted-foreground"
                    >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                    </motion.div>
                )}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg"
                    >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-card">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                            currentRemaining > 0
                                ? "Type your message..."
                                : "Rate limit reached"
                        }
                        disabled={isLoading || currentRemaining <= 0}
                        className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        maxLength={2000}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim() || currentRemaining <= 0}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Send message"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                {currentRemaining <= 0 && (
                    <p className="text-xs text-destructive mt-2">
                        You&#39;ve reached the message limit. Please try again later.
                    </p>
                )}
            </form>
        </div>
    )
}
