"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { MessageSquare } from "lucide-react"
import ChatWindow from "./ChatWindow"

interface ChatWidgetProps {
    remainingMessages?: number
    isEnabled?: boolean
}

export function ChatWidget({ remainingMessages = 10, isEnabled = true }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false)

    if (!isEnabled) return null

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="mb-4"
                    >
                        <ChatWindow
                            remainingMessages={remainingMessages}
                            onClose={() => setIsOpen(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors relative"
                aria-label={isOpen ? "Close chat" : "Open chat"}
            >
                <MessageSquare className="w-6 h-6" />
                {remainingMessages > 0 && remainingMessages < 10 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                        {remainingMessages}
                    </span>
                )}
            </button>
        </div>
    )
}
