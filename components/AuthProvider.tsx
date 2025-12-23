"use client"

import { createLocalClient } from "@/utils/supabase/client"
import { Tables } from "@/utils/types/database.types"
import { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react"
import { NotificationContext } from "./NotificationProvider"

export type Profile = Tables<"profiles">

interface AuthContextType {
    user: User | null
    profile: Profile | null
    isAdmin: boolean
    refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    isAdmin: false,
    refreshProfile: async () => {},
})

export default function AuthProvider({
    children,
}: {
    children: React.ReactNode
}) {
    // Context
    const notificationContext = useContext(NotificationContext)
    const { addNotification } = notificationContext

    // Constants
    const supabase = createLocalClient()

    // States
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)

    // Functions
    const fetchProfile = useCallback(
        async (userId: string) => {
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
            } else if (event === "SIGNED_IN") {
                if (session) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                    addNotification("You are now signed in.", "success")
                }
            } else if (event === "SIGNED_OUT") {
                setUser(null)
                setProfile(null)
                addNotification("You are now signed out.", "error")
            }
        },
        [setUser, addNotification, fetchProfile]
    )

    // Effects
    useEffect(() => {
        // Auth State Change
        supabase.auth.onAuthStateChange((event, session) =>
            handleAuthChange(event, session)
        )
    }, [supabase.auth, handleAuthChange])

    // Computed values
    const isAdmin = profile?.role === "admin" || profile?.role === "moderator"

    // Render
    return (
        <AuthContext.Provider
            value={{ user, profile, isAdmin, refreshProfile }}
        >
            {children}
        </AuthContext.Provider>
    )
}
