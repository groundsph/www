"use client"

import { useSyncExternalStore } from "react"

interface PWAInstallState {
    isStandalone: boolean
    isMobile: boolean
    canInstall: boolean
    dismissed: boolean
    dismiss: () => void
}

const DISMISS_KEY = "pwa-install-dismissed"

function getSnapshot() {
    if (typeof window === "undefined") {
        return { isStandalone: false, isMobile: false, dismissed: true }
    }
    const mq = window.matchMedia("(display-mode: standalone)")
    const ua = navigator.userAgent.toLowerCase()
    const stored = localStorage.getItem(DISMISS_KEY)
    return {
        isStandalone: mq.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
        isMobile: /android|iphone|ipad|ipod/.test(ua),
        dismissed: stored === "true",
    }
}

function getServerSnapshot() {
    return { isStandalone: false, isMobile: false, dismissed: true }
}

function subscribe(callback: () => void) {
    if (typeof window === "undefined") return () => {}
    const handler = () => callback()
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
}

export function usePWAInstall(): PWAInstallState {
    const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, "true")
        window.dispatchEvent(new Event("storage"))
    }

    return {
        ...state,
        canInstall: state.isMobile && !state.isStandalone && !state.dismissed,
        dismiss,
    }
}
