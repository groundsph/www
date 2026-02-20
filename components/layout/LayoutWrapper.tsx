"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { ChatWidget } from "@/components/chat/ChatWidget"
import Footer from "./Footer"
import Navbar from "./Navbar"

interface LayoutWrapperProps {
    children: React.ReactNode
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
    const pathname = usePathname()
    const isAuthPage = pathname?.startsWith("/auth")
    const isMenuPage = pathname?.match(/^\/cafes\/[^/]+\/menu$/)

    // Track if user navigated internally (vs direct access via QR/link)
    const [isInternalNavigation, setIsInternalNavigation] = useState(false)

    useEffect(() => {
        if (isMenuPage) {
            // Check if the user navigated from within the site
            const referrer = document.referrer
            const isInternal =
                referrer.includes(window.location.host) ||
                (window.history.length > 1 &&
                    sessionStorage.getItem("__next_scroll") !== null)
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsInternalNavigation(isInternal)
        }
    }, [isMenuPage])

    // Hide navbar on auth pages and menu pages (menu page has its own conditional header)
    const hideNav = isAuthPage || isMenuPage
    // Hide footer on auth pages, and on menu pages for direct access
    const hideFooter = isAuthPage || (isMenuPage && !isInternalNavigation)

    // Hide chat widget on auth pages
    const hideChat = isAuthPage

    return (
        <>
            {!hideNav && <Navbar />}
            {children}
            {!hideFooter && <Footer />}
            {!hideChat && <ChatWidget />}
        </>
    )
}
