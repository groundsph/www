"use client"

import { useAuth } from "@/components/AuthProvider"
import { useEffect, useState, useCallback } from "react"

/**
 * Custom hook to manage cafe passport actions (favorite, wishlist, visited)
 * Consolidates the duplicated toggle logic from CafeDetails
 */
export function useCafeActions(cafeId: string) {
    const { user, profile, refreshProfile } = useAuth()

    // States
    const [isVisited, setIsVisited] = useState(false)
    const [isFavorite, setIsFavorite] = useState(false)
    const [isInWishlist, setIsInWishlist] = useState(false)

    // Initialize from passport
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
    }, [profile, cafeId])

    // Toggle handlers with optimistic updates
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
        } catch (error) {
            console.error("Visited toggle failed", error)
            setIsVisited(!newState)
        }
    }, [user, isVisited, cafeId, refreshProfile])

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
        toggleVisited,
        toggleFavorite,
        toggleWishlist,
    }
}
