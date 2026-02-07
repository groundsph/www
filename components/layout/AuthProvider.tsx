"use client"

import { useSession } from "@/lib/auth-client"
import { Tables } from "@/utils/types/database.types"
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

// Extend the base profile type with computed fields from the API
export type Profile = Tables<"profiles"> & {
    owned_cafe_count?: number
}

// Better Auth user type - matches the session user from better-auth
export interface BetterAuthUser {
    id: string
    email: string
    emailVerified: boolean
    name?: string
    image?: string | null
    createdAt: Date
    updatedAt: Date
}

interface AuthContextType {
    user: BetterAuthUser | null
    profile: Profile | null
    isAdmin: boolean
    isWriter: boolean
    isOwner: boolean
    isLoading: boolean
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Custom hook to access the auth context.
 * Throws an error if used outside of AuthProvider.
 */
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}

export default function AuthProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const { addNotification } = useNotification()
    const router = useRouter()

    // Better Auth session hook
    const { data: session, isPending } = useSession()

    // Profile state
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isProfileLoading, setIsProfileLoading] = useState(true)

    // Track sign-in/out transitions for notifications
    const previousUserIdRef = useRef<string | null>(null)
    const hasShownSignInNotification = useRef(false)

    // Fetch profile from API
    const fetchProfile = useCallback(
        async (userId: string): Promise<Profile | null> => {
            try {
                const response = await fetch(`/api/profile/${userId}`)
                if (!response.ok) {
                    console.error(
                        "Error fetching profile:",
                        response.statusText
                    )
                    return null
                }
                return await response.json()
            } catch (err) {
                console.error("Unexpected error fetching profile:", err)
                return null
            }
        },
        []
    )

    // Public method to refresh profile
    const refreshProfile = useCallback(async () => {
        if (session?.user) {
            const data = await fetchProfile(session.user.id)
            setProfile(data)
        }
    }, [session, fetchProfile])

    // Handle session changes
    useEffect(() => {
        if (isPending) return

        const userId = session?.user?.id ?? null
        const previousUserId = previousUserIdRef.current

        // User signed in
        if (userId && userId !== previousUserId) {
            fetchProfile(userId).then((data) => {
                setProfile(data)
                setIsProfileLoading(false)

                // Show notification only on actual sign-in (not initial load)
                if (
                    previousUserId !== null &&
                    !hasShownSignInNotification.current
                ) {
                    addNotification("You are now signed in.", "success")
                    hasShownSignInNotification.current = true
                    router.refresh()
                }
            })
        }
        // User signed out
        else if (!userId && previousUserId !== null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setProfile(null)
            setIsProfileLoading(false)
            addNotification("You are now signed out.", "warning")
            hasShownSignInNotification.current = false
            router.refresh()
        }
        // No change or initial load with no user
        else if (!userId) {
            setIsProfileLoading(false)
        }

        previousUserIdRef.current = userId
    }, [session?.user?.id, isPending, fetchProfile, addNotification, router])

    // Computed role checks
    const isAdmin = profile?.role === "admin" || profile?.role === "moderator"
    const isWriter = profile?.role === "writer"
    const isOwner = (profile?.owned_cafe_count ?? 0) > 0

    // Memoized context value
    const contextValue = useMemo<AuthContextType>(
        () => ({
            user: session?.user ?? null,
            profile,
            isAdmin,
            isWriter,
            isOwner,
            isLoading: isPending || isProfileLoading,
            refreshProfile,
        }),
        [
            session?.user,
            profile,
            isAdmin,
            isWriter,
            isOwner,
            isPending,
            isProfileLoading,
            refreshProfile,
        ]
    )

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    )
}

// Re-export the context for advanced use cases
export { AuthContext }
