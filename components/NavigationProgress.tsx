"use client"

import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export default function NavigationProgress() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isNavigating, setIsNavigating] = useState(false)
    const [progress, setProgress] = useState(0)

    // Reset when the route changes (navigation complete)
    useEffect(() => {
        setIsNavigating(false)
        setProgress(0)
    }, [pathname, searchParams])

    // Listen for link clicks to detect navigation start
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            try {
                const target = e.target
                if (!(target instanceof HTMLElement)) return

                const anchor = target.closest("a")
                if (!anchor) return

                const href = anchor.getAttribute("href")
                if (!href) return

                // Only trigger for internal navigation
                if (
                    href.startsWith("/") &&
                    !href.startsWith("//") &&
                    !anchor.hasAttribute("target") &&
                    !anchor.hasAttribute("download")
                ) {
                    // Check if it's a different page
                    const currentPath =
                        typeof window !== "undefined"
                            ? window.location.pathname + window.location.search
                            : ""
                    if (href !== currentPath && !href.startsWith("#")) {
                        setIsNavigating(true)
                        setProgress(0)
                    }
                }
            } catch {
                // Silently ignore any errors
            }
        }

        if (typeof document !== "undefined") {
            document.addEventListener("click", handleClick, true)
            return () =>
                document.removeEventListener("click", handleClick, true)
        }
    }, [])

    // Animate progress while navigating
    useEffect(() => {
        if (!isNavigating) return

        // Quick initial progress
        setProgress(30)

        const timer1 = setTimeout(() => setProgress(50), 100)
        const timer2 = setTimeout(() => setProgress(70), 300)
        const timer3 = setTimeout(() => setProgress(85), 600)
        const timer4 = setTimeout(() => setProgress(95), 1000)

        return () => {
            clearTimeout(timer1)
            clearTimeout(timer2)
            clearTimeout(timer3)
            clearTimeout(timer4)
        }
    }, [isNavigating])

    if (!isNavigating && progress === 0) return null

    return (
        <div
            className='fixed top-0 left-0 right-0 h-1 z-9999 pointer-events-none'
            style={{ backgroundColor: "transparent" }}
        >
            <div
                className='h-full bg-primary transition-all duration-200 ease-out'
                style={{
                    width: `${progress}%`,
                    boxShadow: "0 0 10px rgba(116, 81, 45, 0.5)",
                }}
            />
        </div>
    )
}
