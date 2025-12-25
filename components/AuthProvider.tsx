"use client"

import { createLocalClient } from "@/utils/supabase/client"
import { Tables } from "@/utils/types/database.types"
import { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
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

    // Memoize supabase client to prevent recreation on each render
    const supabase = useMemo(() => createLocalClient(), [])

    // States
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Functions
    const fetchProfile = useCallback(
        async (userId: string) => {
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", userId)
                    .single()

                if (error) {
                    console.error("Error fetching profile:", error)
                    setProfile(null)
                    return
                }

                setProfile(data)
            } catch (err) {
                console.error("Unexpected error fetching profile:", err)
                setProfile(null)
            }
        },
        [supabase]
    )

    const refreshProfile = useCallback(async () => {
        if (user) {
            await fetchProfile(user.id)
        }
    }, [user, fetchProfile])

    const handleAuthChange = useCallback(
        async (event: AuthChangeEvent, session: Session | null) => {
            if (event === "INITIAL_SESSION") {
                if (session) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                } else {
                    setUser(null)
                    setProfile(null)
                }
                setIsLoading(false)
            } else if (event === "SIGNED_IN") {
                if (session) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                    addNotification("You are now signed in.", "success")
                }
            } else if (event === "SIGNED_OUT") {
                setUser(null)
                setProfile(null)
                addNotification("You are now signed out.", "warning")
            } else if (event === "TOKEN_REFRESHED") {
                // Silently update user on token refresh
                if (session) {
                    setUser(session.user)
                }
            } else if (event === "USER_UPDATED") {
                // Re-fetch profile when user data is updated
                if (session) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                }
            }
        },
        [addNotification, fetchProfile]
    )

    // Effects
    useEffect(() => {
        // Subscribe to auth state changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) =>
            handleAuthChange(event, session)
        )

        // Cleanup subscription on unmount to prevent memory leaks
        return () => {
            subscription.unsubscribe()
        }
    }, [supabase.auth, handleAuthChange])

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
