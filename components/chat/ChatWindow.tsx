"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Send, AlertCircle, Loader2, Sparkles } from "lucide-react"
import ChatMessage from "./ChatMessage"
import { sendChatMessage } from "@/app/api/actions/chat"
import { cn } from "@/utils/cn"
import { useUserLocation } from "@/hooks/useUserLocation"
import {
    clearChatHistory,
    loadChatHistory,
    migrateLegacyChatHistory,
    saveChatHistory,
    shouldClearChatHistory,
} from "@/utils/chat-history"
import type { ChatCafeCard, ChatCardContext, ChatCrawlDraft } from "@/utils/types/chat"

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
    crawlDraft?: ChatCrawlDraft
}

interface ChatWindowProps {
    remainingMessages: number
    onClose: () => void
}

export default function ChatWindow({
    remainingMessages,
    onClose,
}: ChatWindowProps) {
    const isDev = process.env.NODE_ENV === "development"
    const [messages, setMessages] = useState<Message[]>(() => {
        if (typeof window === "undefined") return []
        if (shouldClearChatHistory()) {
            clearChatHistory()
            return []
        }
        migrateLegacyChatHistory()
        const saved = loadChatHistory<Message>()
        return saved.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
    })
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentRemaining, setCurrentRemaining] = useState(remainingMessages)
    const [pendingMessage, setPendingMessage] = useState<Message | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (typeof window === "undefined") return
        if (messages.length > 0) {
            saveChatHistory(messages)
            return
        }
        clearChatHistory()
    }, [messages])

    useEffect(() => {
        if (currentRemaining <= 0 && typeof window !== "undefined") {
            clearChatHistory()
        }
    }, [currentRemaining])

    const {
        location,
        loading: locationLoading,
        error: locationError,
        refresh: refreshLocation,
        isEstimate,
    } = useUserLocation({ skipInitialFetch: false })

    const locationSummary = useMemo(() => {
        if (location.lat && location.lng) {
            return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
        }
        if (location.city || location.region) {
            return `${location.city ?? ""}${location.city && location.region ? ", " : ""}${location.region ?? ""}`.trim()
        }
        return null
    }, [location.city, location.region, location.lat, location.lng])

    const mapLocationError = useCallback((message: string | null) => {
        if (!message) return null
        if (message.includes("timed out")) {
            return "The chat provider timed out. Please try again in a moment."
        }
        if (message.includes("401")) {
            return "Chat provider rejected the API key. Please check your configuration."
        }
        if (message.includes("403")) {
            return "Chat provider denied access to this model. Please verify your plan or model name."
        }
        if (message.includes("404")) {
            return "Chat provider endpoint or model was not found. Please verify configuration."
        }
        if (message.includes("Rate limit")) {
            return "Rate limit exceeded. Please try again later."
        }
        return message
    }, [])

    const shouldRequestLocation = (text: string) => {
        const query = text.toLowerCase()
        return (
            query.includes("near me") ||
            query.includes("nearby") ||
            query.includes("closest") ||
            query.includes("around me")
        )
    }

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [])

    const handleClearHistory = useCallback(() => {
        setMessages([])
        setError(null)
        setPendingMessage(null)
        clearChatHistory()
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

    // Schedule daily reset at local midnight
    useEffect(() => {
        if (typeof window === "undefined") return
        const now = new Date()
        const nextMidnight = new Date(now)
        nextMidnight.setHours(24, 0, 0, 0)
        const timeoutMs = nextMidnight.getTime() - now.getTime()

        const timeout = window.setTimeout(() => {
            clearChatHistory()
            setMessages([])
        }, timeoutMs)

        return () => window.clearTimeout(timeout)
    }, [])

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

        // For near-me queries, queue message if location is still loading
        if (shouldRequestLocation(userMessage.content) && locationLoading) {
            refreshLocation()
            setPendingMessage(userMessage)
            setIsLoading(false)
            return
        }

        try {
            const locationHint = location.lat && location.lng
                ? `\n\nUser location: ${location.lat}, ${location.lng}. Use get_nearby_cafes.`
                : locationSummary
                    ? `\n\nUser location context: ${locationSummary}.`
                    : ""

            const result = await sendChatMessage({
                message: `${userMessage.content}${locationHint}`,
            })

            if (result.success && result.message) {
                const assistantMessage: Message = {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: result.message,
                    timestamp: new Date(),
                    cafes: result.cafes,
                    cardContext: result.cardContext,
                    crawlDraft: result.crawlDraft,
                }
                setMessages((prev) => [...prev, assistantMessage])
                setCurrentRemaining(result.remaining)
            } else {
                setError(mapLocationError(result.error || "Failed to send message"))
                setCurrentRemaining(result.remaining)
            }
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setIsLoading(false)
            setTimeout(scrollToBottom, 100)
        }
    }

    // Process pending message when location is ready
    useEffect(() => {
        if (!pendingMessage) return
        if (locationLoading) return
        if (!locationSummary && !location.lat && !location.lng && !locationError) return

        void (async () => {
            try {
                const locationHint = location.lat && location.lng
                    ? `\n\nUser location: ${location.lat}, ${location.lng}. Use get_nearby_cafes.`
                    : locationSummary
                        ? `\n\nUser location context: ${locationSummary}.`
                        : ""

                const result = await sendChatMessage({
                    message: `${pendingMessage.content}${locationHint}`,
                })

                if (result.success && result.message) {
                    const assistantMessage: Message = {
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: result.message,
                        timestamp: new Date(),
                        cafes: result.cafes,
                        cardContext: result.cardContext,
                        crawlDraft: result.crawlDraft,
                    }
                    setMessages((prev) => [...prev, assistantMessage])
                    setCurrentRemaining(result.remaining)
                } else {
                    setError(mapLocationError(result.error || "Failed to send message"))
                    setCurrentRemaining(result.remaining)
                }
            } catch {
                setError("An unexpected error occurred")
            } finally {
                setIsLoading(false)
                setTimeout(scrollToBottom, 100)
            }
        })()
        setPendingMessage(null)
    }, [pendingMessage, locationLoading, locationSummary, location.lat, location.lng, locationError, mapLocationError, scrollToBottom])

    useEffect(() => {
        if (locationError) {
            setError(mapLocationError(locationError.message))
        }
    }, [locationError, mapLocationError])

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className='w-[min(450px,calc(100vw-2rem))] sm:w-[450px] lg:w-[520px] bg-background border border-primary/10 rounded-2xl shadow-2xl shadow-primary/5 overflow-hidden text-text'
        >
            {/* Header */}
            <div className='flex items-center justify-between px-4 py-3.5 border-b border-primary/10 bg-linear-to-r from-secondary/5 to-transparent'>
                <div className='flex items-center gap-3'>
                    <motion.div
                        className='p-2 bg-secondary/20 rounded-xl'
                        animate={{
                            scale: [1, 1.05, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "easeInOut",
                        }}
                    >
                        <Sparkles className='w-4 h-4 text-secondary' />
                    </motion.div>
                    <div>
                        <h3 className='font-semibold text-sm'>
                            Chat with Grounds AI
                        </h3>
                        <motion.p
                            key={currentRemaining}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className='text-xs text-text/60'
                        >
                            {currentRemaining > 0
                                ? `${currentRemaining} messages remaining`
                                : "No messages remaining"}
                        </motion.p>
                    </div>
                </div>
                <div className='flex items-center gap-2'>
                    {isDev && (
                        <button
                            type="button"
                            onClick={handleClearHistory}
                            className="text-xs text-text/60 hover:text-text transition-colors"
                        >
                            Clear history
                        </button>
                    )}
                    <motion.button
                        onClick={onClose}
                        whileHover={{
                            scale: 1.1,
                            backgroundColor: "var(--primary-10)",
                        }}
                        whileTap={{ scale: 0.95 }}
                        className='p-2 rounded-xl transition-colors hover:bg-primary/10'
                        aria-label='Close chat'
                    >
                        <X className='w-5 h-5' />
                    </motion.button>
                </div>
            </div>

            {/* Messages */}
            <div className='h-[420px] sm:h-[480px] lg:h-[520px] max-h-[70vh] overflow-y-auto space-y-4 px-4 py-4 bg-background'>
                <AnimatePresence mode='popLayout'>
                    {messages.length === 0 && (
                        <motion.div
                            id="messages-entry"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className='flex flex-col items-center justify-center h-full text-center space-y-4'
                        >
                            <motion.div
                                className='p-4 bg-secondary/10 rounded-2xl'
                                animate={{
                                    y: [0, -5, 0],
                                    rotate: [0, 2, -2, 0],
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    repeatType: "loop",
                                    ease: "easeInOut",
                                }}
                            >
                                <Sparkles className='w-8 h-8 text-secondary' />
                            </motion.div>
                            <div className='space-y-1'>
                                <p className='text-sm font-medium'>
                                    Ask me anything about cafes!
                                </p>
                                <p className='text-xs text-text/50'>
                                    Locations, recommendations, amenities...
                                </p>
                            </div>
                        </motion.div>
                    )}
                    {messages.map((message, index) => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                                delay: index * 0.05,
                                type: "spring",
                                stiffness: 300,
                                damping: 24,
                            }}
                        >
                            <ChatMessage message={message} />
                        </motion.div>
                    ))}
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className='flex items-center gap-3 p-3 bg-secondary/5 rounded-xl w-fit'
                        >
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: [0.5, 1, 0.5],
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                            >
                                <Loader2 className='w-4 h-4 text-secondary animate-spin' />
                            </motion.div>
                            <span className='text-sm text-text/70'>
                                Grounds AI is thinking...
                            </span>
                        </motion.div>
                    )}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className='flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive'
                        >
                            <AlertCircle className='w-4 h-4 shrink-0' />
                            <span className='text-sm'>{error}</span>
                        </motion.div>
                    )}
                    {locationLoading && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className='flex items-center gap-2 p-3 bg-secondary/10 rounded-xl text-secondary'
                        >
                            <Loader2 className='w-4 h-4 animate-spin' />
                            <span className='text-sm'>Requesting your location...</span>
                        </motion.div>
                    )}
                    {!locationLoading && isEstimate && locationSummary && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className='text-xs text-text/60'
                        >
                            Using estimated location: {locationSummary}
                        </motion.div>
                    )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
                onSubmit={handleSubmit}
                className='p-3 border-t border-primary/10 bg-background/80 backdrop-blur-sm'
            >
                <div className='relative flex gap-2'>
                    <div className='flex-1 relative'>
                        <input
                            type='text'
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={
                                currentRemaining > 0
                                    ? "Ask about cafes, locations, or recommendations..."
                                    : "Rate limit reached"
                            }
                            disabled={isLoading || currentRemaining <= 0}
                            className={cn(
                                "w-full px-4 py-3 pr-12 border rounded-xl text-sm transition-all duration-200",
                                "bg-background focus:bg-background",
                                "focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                input.trim()
                                    ? "border-primary/30"
                                    : "border-text/20 hover:border-text/30",
                            )}
                            maxLength={2000}
                        />
                        <AnimatePresence>
                            {input.trim() && (
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className='absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text/30 font-medium'
                                >
                                    {input.length}/2000
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                    <motion.button
                        type='submit'
                        disabled={
                            isLoading || !input.trim() || currentRemaining <= 0
                        }
                        whileHover={
                            !isLoading && input.trim() && currentRemaining > 0
                                ? { scale: 1.05 }
                                : {}
                        }
                        whileTap={
                            !isLoading && input.trim() && currentRemaining > 0
                                ? { scale: 0.95 }
                                : {}
                        }
                        className={cn(
                            "px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200",
                            "flex items-center gap-2 min-w-11 justify-center",
                            input.trim() && currentRemaining > 0
                                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg"
                                : "bg-text/10 text-text/40 cursor-not-allowed",
                        )}
                        aria-label='Send message'
                    >
                        <AnimatePresence mode='wait'>
                            {isLoading ? (
                                <motion.div
                                    key='loading'
                                    initial={{ opacity: 0, rotate: -90 }}
                                    animate={{ opacity: 1, rotate: 0 }}
                                    exit={{ opacity: 0, rotate: 90 }}
                                >
                                    <Loader2 className='w-4 h-4 animate-spin text-background' />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key='send'
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                >
                                    <Send className='w-4 h-4 text-background' />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </div>
                <AnimatePresence>
                    {currentRemaining <= 0 && (
                        <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className='text-xs text-destructive mt-2 flex items-center gap-1.5'
                        >
                            <AlertCircle className='w-3 h-3' />
                            You&apos;ve reached the message limit. Please try
                            again later.
                        </motion.p>
                    )}
                </AnimatePresence>
            </form>
        </motion.div>
    )
}
