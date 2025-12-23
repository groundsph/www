"use client"

import { AnimatePresence } from "motion/react"
import { createContext, useCallback, useState } from "react"
import { motion } from "motion/react"
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react"

export interface NotificationItem {
    id: string
    title?: string
    message: string
    type: "success" | "error" | "warning" | "info"
}

export interface NotificationContextType {
    notifications: NotificationItem[]
    addNotification: (
        message: string,
        type: NotificationItem["type"],
        title?: string
    ) => void
    removeNotification: (id: string) => void
}

export const NotificationContext = createContext<NotificationContextType>({
    notifications: [],
    addNotification: () => {},
    removeNotification: () => {},
})

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
}

export default function NotificationProvider({
    children,
}: {
    children: React.ReactNode
}) {
    // Constants

    // States
    const [notifications, setNotifications] = useState<NotificationItem[]>([])

    // Functions
    const removeNotification = useCallback(
        (id: string) => {
            setNotifications((prev) =>
                prev.filter((notification) => notification.id !== id)
            )
        },
        [setNotifications]
    )

    const addNotification = useCallback(
        (
            message: string,
            type: NotificationItem["type"] = "info",
            title?: string
        ) => {
            const id =
                Date.now().toString() + Math.random().toString(36).slice(2)
            const notification = { id, title, message, type }
            setNotifications((prev) => [notification, ...prev])
            // setTimeout(() => {
            //     removeNotification(id)
            // }, 5000)
        },
        [setNotifications]
    )

    // Effects

    // Render
    return (
        <NotificationContext.Provider
            value={{ notifications, addNotification, removeNotification }}
        >
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
