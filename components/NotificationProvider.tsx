"use client"

import { AnimatePresence } from "motion/react"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { motion } from "motion/react"
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react"

// ============================================================================
// Types
// ============================================================================

export interface NotificationItem {
    id: string
    title?: string
    message: string
    type: "success" | "error" | "warning" | "info"
    duration?: number // ms, undefined means no auto-dismiss
}

export interface NotificationOptions {
    title?: string
    duration?: number // ms, set to 0 to disable auto-dismiss
}

export interface NotificationContextType {
    notifications: NotificationItem[]
    addNotification: (
        message: string,
        type: NotificationItem["type"],
        options?: NotificationOptions | string // string for backwards compatibility (title)
    ) => void
    removeNotification: (id: string) => void
    clearAll: () => void
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DURATION = 5000 // 5 seconds
const MAX_NOTIFICATIONS = 5

const notificationStyles = {
    success: {
        icon: CheckCircle,
        borderColor: "border-primary/60",
        iconColor: "text-primary",
        bgAccent: "bg-primary/5",
    },
    error: {
        icon: XCircle,
        borderColor: "border-red-600/60",
        iconColor: "text-red-600",
        bgAccent: "bg-red-600/5",
    },
    warning: {
        icon: AlertTriangle,
        borderColor: "border-secondary/80",
        iconColor: "text-secondary",
        bgAccent: "bg-secondary/5",
    },
    info: {
        icon: Info,
        borderColor: "border-text/20",
        iconColor: "text-text/60",
        bgAccent: "bg-text/5",
    },
} as const

// ============================================================================
// Context
// ============================================================================

export const NotificationContext = createContext<
    NotificationContextType | undefined
>(undefined)

/**
 * Custom hook to access the notification context.
 * Throws an error if used outside of NotificationProvider.
 */
export function useNotification() {
    const context = useContext(NotificationContext)
    if (context === undefined) {
        throw new Error(
            "useNotification must be used within a NotificationProvider"
        )
    }
    return context
}

// ============================================================================
// Provider Component
// ============================================================================

export default function NotificationProvider({
    children,
}: {
    children: React.ReactNode
}) {
    // States
    const [notifications, setNotifications] = useState<NotificationItem[]>([])

    // Refs for tracking timeouts
    const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            timeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
            timeoutsRef.current.clear()
        }
    }, [])

    // Functions
    const removeNotification = useCallback((id: string) => {
        // Clear associated timeout
        const timeout = timeoutsRef.current.get(id)
        if (timeout) {
            clearTimeout(timeout)
            timeoutsRef.current.delete(id)
        }

        setNotifications((prev) =>
            prev.filter((notification) => notification.id !== id)
        )
    }, [])

    const clearAll = useCallback(() => {
        // Clear all timeouts
        timeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
        timeoutsRef.current.clear()

        setNotifications([])
    }, [])

    const addNotification = useCallback(
        (
            message: string,
            type: NotificationItem["type"] = "info",
            options?: NotificationOptions | string
        ) => {
            // Handle backwards compatibility with string title parameter
            const normalizedOptions: NotificationOptions =
                typeof options === "string"
                    ? { title: options }
                    : (options ?? {})

            const { title, duration = DEFAULT_DURATION } = normalizedOptions

            const id =
                Date.now().toString() + Math.random().toString(36).slice(2)
            const notification: NotificationItem = {
                id,
                title,
                message,
                type,
                duration,
            }

            setNotifications((prev) => {
                // Add new notification and limit to max
                const updated = [notification, ...prev].slice(
                    0,
                    MAX_NOTIFICATIONS
                )

                // Clear timeouts for removed notifications
                if (prev.length >= MAX_NOTIFICATIONS) {
                    const removedIds = prev
                        .slice(MAX_NOTIFICATIONS - 1)
                        .map((n) => n.id)
                    removedIds.forEach((removedId) => {
                        const timeout = timeoutsRef.current.get(removedId)
                        if (timeout) {
                            clearTimeout(timeout)
                            timeoutsRef.current.delete(removedId)
                        }
                    })
                }

                return updated
            })

            // Set auto-dismiss timeout if duration > 0
            if (duration > 0) {
                const timeout = setTimeout(() => {
                    removeNotification(id)
                }, duration)
                timeoutsRef.current.set(id, timeout)
            }
        },
        [removeNotification]
    )

    // Memoize context value to prevent unnecessary re-renders
    const contextValue = useMemo<NotificationContextType>(
        () => ({
            notifications,
            addNotification,
            removeNotification,
            clearAll,
        }),
        [notifications, addNotification, removeNotification, clearAll]
    )

    // Render
    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
            <AnimatePresence>
                {notifications.map(({ id, title, message, type }, idx) => {
                    const style = notificationStyles[type]
                    const IconComponent = style.icon

                    return (
                        <motion.div
                            key={id}
                            initial={{
                                opacity: 0,
                                x: 100,
                                scale: 0.9,
                            }}
                            animate={{
                                opacity: 1 - idx * 0.15,
                                x: 0,
                                scale: 1 - idx * 0.05,
                                zIndex: 100 - idx,
                                y: idx * -8,
                            }}
                            exit={{
                                opacity: 0,
                                x: 100,
                                scale: 0.9,
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 30,
                            }}
                            className={`fixed bottom-6 right-6 w-[85svw] md:max-w-md select-none cursor-pointer rounded-xl bg-background border ${style.borderColor} text-text shadow-lg shadow-text/10 overflow-hidden`}
                        >
                            <div
                                className={`flex items-start gap-3 p-4 ${style.bgAccent}`}
                            >
                                <div className={`shrink-0 ${style.iconColor}`}>
                                    <IconComponent
                                        size={20}
                                        strokeWidth={2.5}
                                    />
                                </div>
                                <div className='flex-1 min-w-0'>
                                    {title && (
                                        <p className='font-serif font-semibold text-sm text-text mb-0.5'>
                                            {title}
                                        </p>
                                    )}
                                    <p className='text-sm text-text/80 leading-relaxed'>
                                        {message}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        removeNotification(id)
                                    }}
                                    className='shrink-0 p-1 hover:bg-text/10 rounded-lg transition-colors text-text/40 hover:text-text'
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </NotificationContext.Provider>
    )
}
