"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Navbar from "@/components/navbar"
import Footer from "@/components/Footer"

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
            setIsInternalNavigation(isInternal)
        }
    }, [isMenuPage])

    // Hide navbar on auth pages and menu pages (menu page has its own conditional header)
    const hideNav = isAuthPage || isMenuPage
    // Hide footer on auth pages, and on menu pages for direct access
    const hideFooter = isAuthPage || (isMenuPage && !isInternalNavigation)

    return (
        <>
            {!hideNav && <Navbar />}
            {children}
            {!hideFooter && <Footer />}
        </>
    )
}
