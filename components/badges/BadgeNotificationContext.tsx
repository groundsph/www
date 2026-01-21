"use client"

import {
    createContext,
    useCallback,
    useContext,
    useState,
    useRef,
    useEffect,
} from "react"
import BadgeNotification from "./BadgeNotification"
import { getBadgeByName, type BadgeDetails } from "@/app/api/actions/badges"

interface BadgeNotificationContextType {
    showBadgeNotification: (badgeName: string) => void
    showBadgeNotifications: (badgeNames: string[]) => void
}

const BadgeNotificationContext = createContext<BadgeNotificationContextType | null>(null)

export function useBadgeNotification() {
    const context = useContext(BadgeNotificationContext)
    if (!context) {
        throw new Error(
            "useBadgeNotification must be used within BadgeNotificationProvider"
        )
    }
    return context
}

export default function BadgeNotificationProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [currentBadge, setCurrentBadge] = useState<BadgeDetails | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [shouldProcess, setShouldProcess] = useState(false)
    const queueRef = useRef<string[]>([])
    const isProcessingRef = useRef(false)

    const processQueue = useCallback(async () => {
        if (isProcessingRef.current || queueRef.current.length === 0) return

        isProcessingRef.current = true
        const badgeName = queueRef.current.shift()

        if (badgeName) {
            const badge = await getBadgeByName(badgeName)
            if (badge) {
                setCurrentBadge(badge)
                setIsVisible(true)
            } else {
                isProcessingRef.current = false
                setShouldProcess(true)
            }
        }
    }, [])

    const handleDismiss = useCallback(() => {
        setIsVisible(false)
        setTimeout(() => {
            setCurrentBadge(null)
            isProcessingRef.current = false
            setShouldProcess(true)
        }, 300)
    }, [])

    const showBadgeNotification = useCallback(
        (badgeName: string) => {
            queueRef.current.push(badgeName)
            setShouldProcess(true)
        },
        []
    )

    const showBadgeNotifications = useCallback(
        (badgeNames: string[]) => {
            queueRef.current.push(...badgeNames)
            setShouldProcess(true)
        },
        []
    )

    useEffect(() => {
        if (shouldProcess) {
            const timer = setTimeout(() => {
                processQueue()
                setShouldProcess(false)
            }, 0)
            return () => clearTimeout(timer)
        }
    }, [shouldProcess, processQueue])

    return (
        <BadgeNotificationContext.Provider
            value={{ showBadgeNotification, showBadgeNotifications }}
        >
            {children}
            <BadgeNotification
                badge={currentBadge}
                isVisible={isVisible}
                onDismiss={handleDismiss}
            />
        </BadgeNotificationContext.Provider>
    )
}
