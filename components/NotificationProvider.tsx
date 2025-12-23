"use client"

import { AnimatePresence } from "motion/react"
import { createContext, useCallback, useState } from "react"
import { motion } from "motion/react"

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
                {notifications.map(({ id, title, message, type }, idx) => (
                    <motion.div
                        key={id}
                        initial={{
                            opacity: 0,
                            scale: 0,
                        }}
                        animate={{
                            opacity: 1 - idx * 0.2,
                            scale: 1 - idx * 0.1,
                            zIndex: 100 - idx,
                            y: idx * -10,
                        }}
                        exit={{
                            opacity: 0,
                            scale: 0,
                            y: 0,
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                        }}
                        whileHover={{ opacity: 0.8 }}
                        onClick={() => removeNotification(id)}
                        className={`fixed bottom-6 right-6 px-3 w-[80svw] md:max-w-lg py-2 select-none cursor-pointer rounded-xl bg-background border-2 text-text flex flex-col gap-1 shadow-md
                            ${type === "success" ? "border-green-400/60" : ""}
                            ${type === "error" ? "border-red-400/60" : ""}
                            ${type === "warning" ? "border-orange-400/60" : ""}
                            ${type === "info" ? "border-background" : ""}
                            `}
                    >
                        <p className='font-bold text-xs opacity-60'>{title}</p>
                        <p className='text-sm font-medium text-pretty'>
                            {message}
                        </p>
                    </motion.div>
                ))}
            </AnimatePresence>
        </NotificationContext.Provider>
    )
}
