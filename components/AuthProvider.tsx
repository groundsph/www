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

export type Profile = Tables<"profiles">

// Better Auth user type
interface BetterAuthUser {
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
    isLoading: boolean
    refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    isAdmin: false,
    isWriter: false,
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

    // Better Auth session hook
    const { data: session, isPending } = useSession()

    // States
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Track if we've already shown the sign-in notification to prevent duplicates
    const hasShownSignInNotification = useRef(false)
    const wasSignedIn = useRef(false)
    const previousUserId = useRef<string | null>(null)

    // Functions
    const fetchProfile = useCallback(
        async (userId: string): Promise<Profile | null> => {
            try {
                // Fetch profile from API
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

    const refreshProfile = useCallback(async () => {
        if (session?.user) {
            const data = await fetchProfile(session.user.id)
            setProfile(data)
        }
    }, [session?.user, fetchProfile])

    // Handle auth state changes based on Better Auth session
    useEffect(() => {
        if (isPending) return

        const handleSessionChange = async () => {
            if (session?.user) {
                // User is signed in
                const userId = session.user.id
                const isNewSignIn = previousUserId.current !== userId

                // Fetch profile
                const profileData = await fetchProfile(userId)
                setProfile(profileData)

                // Show notification only for new sign-ins
                if (
                    isNewSignIn &&
                    previousUserId.current !== null &&
                    !hasShownSignInNotification.current
                ) {
                    addNotification("You are now signed in.", "success")
                    hasShownSignInNotification.current = true
                    router.refresh()
                }

                previousUserId.current = userId
                wasSignedIn.current = true
            } else {
                // User is signed out
                if (wasSignedIn.current) {
                    addNotification("You are now signed out.", "warning")
                    router.refresh()
                }

                setProfile(null)
                previousUserId.current = null
                wasSignedIn.current = false
                hasShownSignInNotification.current = false
            }

            setIsLoading(false)
        }

        handleSessionChange()
    }, [session, isPending, fetchProfile, addNotification, router])

    // Computed values
    const isAdmin = profile?.role === "admin" || profile?.role === "moderator"
    const isWriter = profile?.role === "writer"

    // Memoize context value to prevent unnecessary re-renders
    const contextValue = useMemo<AuthContextType>(
        () => ({
            user: session?.user ?? null,
            profile,
            isAdmin,
            isWriter,
            isLoading: isPending || isLoading,
            refreshProfile,
        }),
        [
            session?.user,
            profile,
            isAdmin,
            isWriter,
            isPending,
            isLoading,
            refreshProfile,
        ]
    )

    // Render
    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    )
}
