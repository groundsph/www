"use client"

import { createLocalClient } from "@/utils/supabase/client"
import { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react"
import { NotificationContext } from "./NotificationProvider"

interface AuthContextType {
    user: User | null
}

export const AuthContext = createContext<AuthContextType | null>(null)

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

    // Functions
    const handleAuthChange = useCallback(
        async (event: AuthChangeEvent, session: Session | null) => {
            if (event === "INITIAL_SESSION") {
                if (session) {
                    setUser(session.user)
                } else {
                    setUser(null)
                }
            } else if (event === "SIGNED_IN") {
                if (session) {
                    setUser(session.user)
                    addNotification("You are now signed in.", "success")
                }
            } else if (event === "SIGNED_OUT") {
                setUser(null)
                addNotification("You are now signed out.", "error")
            }
        },
        [setUser, addNotification]
    )

    // Effects
    useEffect(() => {
        // Auth State Change
        supabase.auth.onAuthStateChange((event, session) =>
            handleAuthChange(event, session)
        )
    }, [supabase.auth, handleAuthChange])

    // Render
    return (
        <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
    )
}
