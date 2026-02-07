"use client"

import { AnimatePresence, motion } from "motion/react"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { createPortal } from "react-dom"
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
        type?: NotificationItem["type"],
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

const NotificationContext = createContext<NotificationContextType | null>(null)

/**
 * Custom hook to access the notification context.
 * Throws an error if used outside of NotificationProvider.
 */
export function useNotification(): NotificationContextType {
    const context = useContext(NotificationContext)
    if (!context) {
        throw new Error(
            "useNotification must be used within a NotificationProvider"
        )
    }
    return context
}

// ============================================================================
// Notification Toast Component
// ============================================================================

function NotificationToast({
    notification,
    index,
    onDismiss,
}: {
    notification: NotificationItem
    index: number
    onDismiss: (id: string) => void
}) {
    const { id, title, message, type } = notification
    const style = notificationStyles[type]
    const IconComponent = style.icon

    return (
        <motion.div
            key={id}
            role='alert'
            aria-live='polite'
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{
                opacity: 1 - index * 0.15,
                x: 0,
                scale: 1 - index * 0.05,
                zIndex: 100 - index,
                y: index * -8,
            }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            whileHover={{ scale: 1 - index * 0.05 + 0.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={() => onDismiss(id)}
            className={`fixed bottom-6 right-6 w-[85svw] md:max-w-md select-none cursor-pointer rounded-xl bg-background border ${style.borderColor} text-text shadow-lg shadow-text/10 overflow-hidden`}
        >
            <div className={`flex items-start gap-3 p-4 ${style.bgAccent}`}>
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
                        onDismiss(id)
                    }}
                    aria-label='Dismiss notification'
                    className='shrink-0 p-1 hover:bg-text/10 rounded-lg transition-colors text-text/40 hover:text-text'
                >
                    <X size={16} />
                </button>
            </div>
        </motion.div>
    )
}

// ============================================================================
// Notification Container (Portal)
// ============================================================================

function NotificationContainer({
    notifications,
    onDismiss,
}: {
    notifications: NotificationItem[]
    onDismiss: (id: string) => void
}) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true)
    }, [])

    if (!mounted) return null

    return createPortal(
        <AnimatePresence>
            {notifications.map((notification, idx) => (
                <NotificationToast
                    key={notification.id}
                    notification={notification}
                    index={idx}
                    onDismiss={onDismiss}
                />
            ))}
        </AnimatePresence>,
        document.body
    )
}

// ============================================================================
// Provider Component
// ============================================================================

export default function NotificationProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

    // Cleanup timeouts on unmount
    useEffect(() => {
        const timeouts = timeoutsRef.current
        return () => {
            timeouts.forEach((timeout) => clearTimeout(timeout))
            timeouts.clear()
        }
    }, [])

    const removeNotification = useCallback((id: string) => {
        const timeout = timeoutsRef.current.get(id)
        if (timeout) {
            clearTimeout(timeout)
            timeoutsRef.current.delete(id)
        }
        setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, [])

    const clearAll = useCallback(() => {
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
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

            const notification: NotificationItem = {
                id,
                title,
                message,
                type,
                duration,
            }

            setNotifications((prev) => {
                const updated = [notification, ...prev].slice(
                    0,
                    MAX_NOTIFICATIONS
                )

                // Clear timeouts for removed notifications
                if (prev.length >= MAX_NOTIFICATIONS) {
                    prev.slice(MAX_NOTIFICATIONS - 1).forEach((n) => {
                        const timeout = timeoutsRef.current.get(n.id)
                        if (timeout) {
                            clearTimeout(timeout)
                            timeoutsRef.current.delete(n.id)
                        }
                    })
                }

                return updated
            })

            // Set auto-dismiss timeout if duration > 0
            if (duration > 0) {
                const timeout = setTimeout(
                    () => removeNotification(id),
                    duration
                )
                timeoutsRef.current.set(id, timeout)
            }
        },
        [removeNotification]
    )

    const contextValue = useMemo<NotificationContextType>(
        () => ({
            notifications,
            addNotification,
            removeNotification,
            clearAll,
        }),
        [notifications, addNotification, removeNotification, clearAll]
    )

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
            <NotificationContainer
                notifications={notifications}
                onDismiss={removeNotification}
            />
        </NotificationContext.Provider>
    )
}

// Re-export context for advanced use cases
export { NotificationContext }
