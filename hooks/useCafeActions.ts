"use client"

import { useAuth } from "@/components/AuthProvider"
import { useEffect, useState, useCallback } from "react"

/**
 * Custom hook to manage cafe passport actions (favorite, wishlist, visited/check-in)
 * Consolidates the duplicated toggle logic from CafeDetails
 */
export function useCafeActions(cafeId: string) {
    const { user, profile, refreshProfile } = useAuth()

    // States
    const [isVisited, setIsVisited] = useState(false)
    const [isFavorite, setIsFavorite] = useState(false)
    const [isInWishlist, setIsInWishlist] = useState(false)
    // Visit count tracking
    const [visitCount, setVisitCount] = useState(0)
    const [visitedToday, setVisitedToday] = useState(false)
    const [isCheckingIn, setIsCheckingIn] = useState(false)

    // Initialize from passport and fetch visit count
    useEffect(() => {
        if (profile?.passport) {
            const passport = profile.passport as {
                visited_ids?: string[]
                favorite_ids?: string[]
                wishlist_ids?: string[]
            }
            setIsVisited(passport.visited_ids?.includes(cafeId) ?? false)
            setIsFavorite(passport.favorite_ids?.includes(cafeId) ?? false)
            setIsInWishlist(passport.wishlist_ids?.includes(cafeId) ?? false)
        }

        // Fetch visit count from the new table
        if (user) {
            fetchVisitData()
        }
    }, [profile, cafeId, user])

    // Fetch visit count and today status
    const fetchVisitData = useCallback(async () => {
        try {
            const [{ getVisitCount }, { hasVisitedToday }] = await Promise.all([
                import("@/app/api/actions/profile"),
                import("@/app/api/actions/profile"),
            ])
            const [countResult, todayResult] = await Promise.all([
                getVisitCount(cafeId),
                hasVisitedToday(cafeId),
            ])
            setVisitCount(countResult.count)
            setVisitedToday(todayResult)
        } catch (error) {
            console.error("Failed to fetch visit data", error)
        }
    }, [cafeId])

    // Check-in handler (new additive visit behavior)
    const checkIn = useCallback(async () => {
        if (!user || isCheckingIn) return

        setIsCheckingIn(true)

        try {
            const { recordVisit } = await import("@/app/api/actions/profile")
            const result = await recordVisit(cafeId)

            if (result.success) {
                setVisitCount(result.visitCount)
                setVisitedToday(true)
                setIsVisited(true)
                refreshProfile()
            } else if (result.alreadyVisitedToday) {
                setVisitedToday(true)
            }

            return result
        } catch (error) {
            console.error("Check-in failed", error)
            return { success: false, visitCount, isFirstVisit: false, error: "Check-in failed" }
        } finally {
            setIsCheckingIn(false)
        }
    }, [user, isCheckingIn, cafeId, visitCount, refreshProfile])

    // Legacy toggle handler (kept for backward compatibility)
    const toggleVisited = useCallback(async () => {
        if (!user) return

        const newState = !isVisited
        setIsVisited(newState)

        try {
            const { toggleVisited: toggleVisitedAction } = await import(
                "@/app/api/actions/profile"
            )
            await toggleVisitedAction(cafeId)
            refreshProfile()
            // Refresh visit count after toggle
            fetchVisitData()
        } catch (error) {
            console.error("Visited toggle failed", error)
            setIsVisited(!newState)
        }
    }, [user, isVisited, cafeId, refreshProfile, fetchVisitData])

    const toggleFavorite = useCallback(async () => {
        if (!user) return

        const newState = !isFavorite
        setIsFavorite(newState)

        try {
            const { toggleFavorite: toggleFavoriteAction } = await import(
                "@/app/api/actions/profile"
            )
            await toggleFavoriteAction(cafeId)
            refreshProfile()
        } catch (error) {
            console.error("Favorite toggle failed", error)
            setIsFavorite(!newState)
        }
    }, [user, isFavorite, cafeId, refreshProfile])

    const toggleWishlist = useCallback(async () => {
        if (!user) return

        const newState = !isInWishlist
        setIsInWishlist(newState)

        try {
            const { toggleWishlist: toggleWishlistAction } = await import(
                "@/app/api/actions/profile"
            )
            await toggleWishlistAction(cafeId)
            refreshProfile()
        } catch (error) {
            console.error("Wishlist toggle failed", error)
            setIsInWishlist(!newState)
        }
    }, [user, isInWishlist, cafeId, refreshProfile])

    return {
        user,
        isVisited,
        isFavorite,
        isInWishlist,
        // New visit count properties
        visitCount,
        visitedToday,
        isCheckingIn,
        // Actions
        checkIn,
        toggleVisited,
        toggleFavorite,
        toggleWishlist,
    }
}
