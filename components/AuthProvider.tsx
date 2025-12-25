"use client"

import { createLocalClient } from "@/utils/supabase/client"
import { Tables } from "@/utils/types/database.types"
import { User } from "@supabase/supabase-js"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { useRouter } from "next/navigation"
import { useNotification } from "./NotificationProvider"

export type Profile = Tables<"profiles">

interface AuthContextType {
    user: User | null
    profile: Profile | null
    isAdmin: boolean
    isLoading: boolean
    refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    isAdmin: false,
    isLoading: true,
    refreshProfile: async () => {},
})

/**
 * Custom hook to access the auth context.
 * Throws an error if used outside of AuthProvider.
 */
export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}

export default function AuthProvider({
    children,
}: {
    children: React.ReactNode
}) {
    // Context
    const { addNotification } = useNotification()
    const router = useRouter()

    // Memoize supabase client to prevent recreation on each render
    const supabase = useMemo(() => createLocalClient(), [])

    // States
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Track if we've already shown the sign-in notification to prevent duplicates
    const hasShownSignInNotification = useRef(false)
    const wasSignedIn = useRef(false)

    // Functions
    const fetchProfile = useCallback(
        async (userId: string): Promise<Profile | null> => {
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", userId)
                    .single()

                if (error) {
                    console.error("Error fetching profile:", error)
                    return null
                }

                return data
            } catch (err) {
                console.error("Unexpected error fetching profile:", err)
                return null
            }
        },
        [supabase]
    )

    const refreshProfile = useCallback(async () => {
        if (user) {
            const data = await fetchProfile(user.id)
            setProfile(data)
        }
    }, [user, fetchProfile])

    // Unified auth handler
    const handleAuth = useCallback(
        async (
            signedIn: boolean,
            authUser?: User,
            isExplicitSignIn?: boolean
        ) => {
            if (signedIn && authUser) {
                setUser(authUser)
                const profileData = await fetchProfile(authUser.id)
                setProfile(profileData)

                // Only show notification on explicit sign-in (not on page navigation or refresh)
                // and only if we weren't already signed in
                if (
                    isExplicitSignIn &&
                    !wasSignedIn.current &&
                    !hasShownSignInNotification.current
                ) {
                    addNotification("You are now signed in.", "success")
                    hasShownSignInNotification.current = true
                    router.refresh()
                }

                wasSignedIn.current = true
            } else {
                // Only show sign-out notification if user was previously signed in
                if (wasSignedIn.current) {
                    addNotification("You are now signed out.", "warning")
                    router.refresh()
                }

                setUser(null)
                setProfile(null)
                wasSignedIn.current = false
                hasShownSignInNotification.current = false
            }

            setIsLoading(false)
        },
        [addNotification, fetchProfile, router]
    )

    // Single effect for auth state - handles INITIAL_SESSION and all other events
    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "INITIAL_SESSION") {
                // Initial load - no notification, just set state
                if (session) {
                    wasSignedIn.current = true // Mark as already signed in
                    handleAuth(true, session.user, false)
                } else {
                    handleAuth(false, undefined, false)
                }
            } else if (event === "SIGNED_IN") {
                // Only show notification if this is a fresh sign-in
                if (session) {
                    handleAuth(true, session.user, true)
                }
            } else if (event === "SIGNED_OUT") {
                handleAuth(false, undefined, false)
            } else if (
                event === "TOKEN_REFRESHED" ||
                event === "USER_UPDATED"
            ) {
                // Silently update user on token refresh or user update
                if (session) {
                    handleAuth(true, session.user, false)
                }
            }
        })

        // Cleanup subscription on unmount
        return () => {
            subscription.unsubscribe()
        }
    }, [supabase.auth, handleAuth])

    // Handle cross-tab auth synchronization via storage events
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            // Check for Supabase auth cookie changes
            if (event.key?.includes("sb-") || event.key?.includes("supabase")) {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session) {
                        handleAuth(true, session.user, false)
                    } else {
                        handleAuth(false, undefined, false)
                    }
                })
            }
        }

        window.addEventListener("storage", handleStorageChange)
        return () => window.removeEventListener("storage", handleStorageChange)
    }, [supabase.auth, handleAuth])

    // Computed values
    const isAdmin = profile?.role === "admin" || profile?.role === "moderator"

    // Memoize context value to prevent unnecessary re-renders
    const contextValue = useMemo<AuthContextType>(
        () => ({
            user,
            profile,
            isAdmin,
            isLoading,
            refreshProfile,
        }),
        [user, profile, isAdmin, isLoading, refreshProfile]
    )

    // Render
    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    )
}
