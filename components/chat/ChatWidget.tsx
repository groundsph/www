"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { MessageSquare, X } from "lucide-react"
import ChatWindow from "./ChatWindow"
import { usePathname } from "next/navigation"
import { subscribeChatEvents } from "@/utils/chat-events"

interface ChatWidgetProps {
    remainingMessages?: number
    isEnabled?: boolean
}

export function ChatWidget({
    remainingMessages = 10,
    isEnabled = true,
}: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [prefillMessage, setPrefillMessage] = useState<string | null>(null)
    const [autoSend, setAutoSend] = useState(false)
    const { trigger } = useHaptics()

    const curPath = usePathname()

    useEffect(() => {
        const unsubscribe = subscribeChatEvents((event) => {
            if (event.type === "open") {
                setPrefillMessage(event.message ?? null)
                setAutoSend(event.autoSend ?? false)
                setIsOpen(true)
                return
            }
            if (event.type === "close") {
                setIsOpen(false)
            }
        })
        return () => {
            unsubscribe()
        }
    }, [])

    function isDisabledForPath() {
        if (!curPath) return false
        if (curPath.includes("/manage")) return true
        if (curPath.includes("/owner")) return true
        return false
    }

    if (!isEnabled) return null

    return (
        <AnimatePresence mode='sync'>
            {!isDisabledForPath() && (
                <motion.div
                    id='ai-chat-widget'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className='fixed bottom-4 right-4 z-[var(--z-chat)] flex flex-col items-end'
                >
                    <AnimatePresence mode='wait'>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 25,
                                }}
                                className='mb-3'
                            >
                                <ChatWindow
                                    remainingMessages={remainingMessages}
                                    onClose={() => setIsOpen(false)}
                                    prefillMessage={prefillMessage ?? undefined}
                                    autoSend={autoSend}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button
                        onClick={() => {
                            trigger(isOpen ? "soft" : "medium")
                            setIsOpen(!isOpen)
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        animate={{
                            boxShadow: [
                                "0 4px 20px -5px var(--secondary-20)",
                                "0 8px 30px -5px var(--secondary-40)",
                                "0 4px 20px -5px var(--secondary-20)",
                            ],
                        }}
                        transition={{
                            boxShadow: {
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            },
                        }}
                        className='relative p-3 bg-secondary text-background rounded-full shadow-xl border-2 border-secondary/30 hover:bg-secondary/90 transition-colors cursor-pointer group'
                        aria-label={isOpen ? "Close chat" : "Open chat"}
                    >
                        <AnimatePresence mode='wait'>
                            {isOpen ? (
                                <motion.div
                                    key='close'
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <X className='w-5 h-5' />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key='open'
                                    initial={{ rotate: 90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: -90, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <MessageSquare className='w-5 h-5' />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {remainingMessages > 0 && remainingMessages < 10 && (
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className='absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center shadow-lg'
                            >
                                {remainingMessages}
                            </motion.span>
                        )}

                        {/* Pulse animation for new users */}
                        {!isOpen && remainingMessages === 10 && (
                            <motion.span
                                className='absolute inset-0 rounded-full bg-secondary/50'
                                animate={{
                                    scale: [1, 1.3, 1],
                                    opacity: [0.5, 0, 0.5],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: 2,
                                    delay: 1,
                                }}
                            />
                        )}
                    </motion.button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
