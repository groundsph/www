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
    const [initialized, setInitialized] = useState(false)

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
            // Skip if not initialized yet (we handle initial session separately)
            if (!initialized && event !== "INITIAL_SESSION") {
                return
            }

            if (event === "INITIAL_SESSION") {
                if (session) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                } else {
                    setUser(null)
                    setProfile(null)
                }
                setIsLoading(false)
                setInitialized(true)
            } else if (event === "SIGNED_IN") {
                if (session) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                    addNotification("You are now signed in.", "success")
                    // Refresh the router to update server components
                    router.refresh()
                }
            } else if (event === "SIGNED_OUT") {
                setUser(null)
                setProfile(null)
                addNotification("You are now signed out.", "warning")
                // Refresh the router to update server components
                router.refresh()
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
        [addNotification, fetchProfile, initialized, router]
    )

    // Initialize session on mount
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession()
                if (session) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                }
            } catch (error) {
                console.error("Error initializing auth:", error)
            } finally {
                setIsLoading(false)
                setInitialized(true)
            }
        }

        initializeAuth()
    }, [supabase.auth, fetchProfile])

    // Subscribe to auth state changes
    useEffect(() => {
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

    // Handle cross-tab auth synchronization via storage events
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            // Check if the auth storage key changed
            if (event.key?.includes("grounds-auth")) {
                // Re-fetch session to sync state across tabs
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session) {
                        setUser(session.user)
                        fetchProfile(session.user.id)
                    } else {
                        setUser(null)
                        setProfile(null)
                    }
                })
            }
        }

        window.addEventListener("storage", handleStorageChange)
        return () => window.removeEventListener("storage", handleStorageChange)
    }, [supabase.auth, fetchProfile])

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
