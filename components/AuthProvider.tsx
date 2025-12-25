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

    // Unified auth handler - similar to your old pattern
    const handleAuth = useCallback(
        async (
            signedIn: boolean,
            authUser?: User,
            showNotification?: boolean
        ) => {
            if (signedIn && authUser) {
                setUser(authUser)
                const profileData = await fetchProfile(authUser.id)
                setProfile(profileData)

                if (showNotification) {
                    addNotification("You are now signed in.", "success")
                    router.refresh()
                }
            } else {
                setUser(null)
                setProfile(null)

                if (showNotification) {
                    addNotification("You are now signed out.", "warning")
                    router.refresh()
                }
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
                // Initial load - no notification needed
                if (session) {
                    handleAuth(true, session.user, false)
                } else {
                    handleAuth(false, undefined, false)
                }
            } else if (event === "SIGNED_IN") {
                if (session) {
                    handleAuth(true, session.user, true)
                }
            } else if (event === "SIGNED_OUT") {
                handleAuth(false, undefined, true)
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
            if (event.key?.includes("grounds-auth")) {
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
