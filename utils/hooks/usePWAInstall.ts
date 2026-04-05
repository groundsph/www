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

// Cached snapshots to avoid infinite loops
let cachedClientSnapshot: { isStandalone: boolean; isMobile: boolean; dismissed: boolean } | null = null
const SERVER_SNAPSHOT = { isStandalone: false, isMobile: false, dismissed: true }

function getSnapshot() {
    if (typeof window === "undefined") {
        return SERVER_SNAPSHOT
    }
    
    const mq = window.matchMedia("(display-mode: standalone)")
    const ua = navigator.userAgent.toLowerCase()
    const stored = localStorage.getItem(DISMISS_KEY)
    
    const newSnapshot = {
        isStandalone: mq.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
        isMobile: /android|iphone|ipad|ipod/.test(ua),
        dismissed: stored === "true",
    }
    
    // Only return new object if values changed
    if (cachedClientSnapshot && 
        cachedClientSnapshot.isStandalone === newSnapshot.isStandalone &&
        cachedClientSnapshot.isMobile === newSnapshot.isMobile &&
        cachedClientSnapshot.dismissed === newSnapshot.dismissed) {
        return cachedClientSnapshot
    }
    
    cachedClientSnapshot = newSnapshot
    return newSnapshot
}

function getServerSnapshot() {
    return SERVER_SNAPSHOT
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
