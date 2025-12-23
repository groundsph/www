"use client"

import { AuthContext } from "@/components/AuthProvider"
import { createLocalClient } from "@/utils/supabase/client"
import { motion } from "motion/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, useEffect, useContext } from "react"

type AuthMode = "signin" | "signup" | "username"

export default function AuthPageClient() {
    // Context
    const authContext = useContext(AuthContext)
    if (!authContext) {
        throw new Error("AuthContext not found")
    }
    const { refreshProfile } = authContext

    // Constants
    const supabase = createLocalClient()
    const searchParams = useSearchParams()

    // States
    const [mode, setMode] = useState<AuthMode>("signin")
    const [isLoading, setIsLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [username, setUsername] = useState("")
    const [displayName, setDisplayName] = useState("")
    const [error, setError] = useState<string | null>(null)

    // Effects
    useEffect(() => {
        const setup = searchParams.get("setup")
        const authError = searchParams.get("error")

        if (setup === "username") {
            setMode("username")
        }
        if (authError === "auth_failed") {
            setError("Authentication failed. Please try again.")
        }
    }, [searchParams])

    // Functions
    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw error
            // Redirect on success
            window.location.href = "/"
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to sign in")
        } finally {
            setIsLoading(false)
        }
    }

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            setIsLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            })
            if (error) throw error
            // Move to username step
            setMode("username")
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to sign up")
        } finally {
            setIsLoading(false)
        }
    }

    const handleUsernameSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        if (!username.trim()) {
            setError("Username is required")
            setIsLoading(false)
            return
        }

        if (!displayName.trim()) {
            setError("Display name is required")
            setIsLoading(false)
            return
        }

        try {
            // Get current user
            const {
                data: { user },
            } = await supabase.auth.getUser()
            if (!user) throw new Error("Not authenticated")

            // Update profiles table
            const { error: profileError } = await supabase
                .from("profiles")
                // @ts-ignore - Supabase types issue
                .update({
                    username: username.trim(),
                    display_name: displayName.trim(),
                })
                .eq("id", user.id)

            if (profileError) throw profileError

            refreshProfile()
            // Redirect on success
            window.location.href = "/"
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Failed to set profile"
            )
        } finally {
            setIsLoading(false)
        }
    }

    // Render
    return (
        <main className='w-full min-h-screen flex items-center justify-center px-4 py-12'>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className='w-full max-w-md'
            >
                {/* Logo */}
                <Link
                    href='/'
                    className='block text-center mb-8'
                >
                    <h1 className='text-4xl md:text-5xl font-bold font-serif'>
                        Grounds
                        <span className='text-primary/80'>.</span>
                    </h1>
                </Link>

                {/* Card */}
                <div className=''>
                    {/* Title */}
                    <h2 className='text-2xl font-semibold font-serif text-text mb-6'>
                        {mode === "signin" && "Login to your Account"}
                        {mode === "signup" && "Create your Account"}
                        {mode === "username" && "Set Up Your Profile"}
                    </h2>

                    {/* Error Message */}
                    {error && (
                        <div className='bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm'>
                            {error}
                        </div>
                    )}

                    {/* Profile Setup Form (after signup) */}
                    {mode === "username" && (
                        <form
                            onSubmit={handleUsernameSubmit}
                            className='space-y-4'
                        >
                            <p className='text-text/70 text-sm mb-4'>
                                Almost there! Set up your profile to get
                                started.
                            </p>
                            <div>
                                <input
                                    type='text'
                                    placeholder='Username (unique identifier)'
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value)
                                    }
                                    className='w-full px-4 py-3 rounded-xl border border-secondary/30 bg-tertiary/50 text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                            <div>
                                <input
                                    type='text'
                                    placeholder='Display Name (how others see you)'
                                    value={displayName}
                                    onChange={(e) =>
                                        setDisplayName(e.target.value)
                                    }
                                    className='w-full px-4 py-3 rounded-xl border border-secondary/30 bg-tertiary/50 text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                            <button
                                type='submit'
                                disabled={isLoading}
                                className='w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg'
                            >
                                {isLoading ? "Saving..." : "Complete Sign Up"}
                            </button>
                        </form>
                    )}

                    {/* Sign In / Sign Up Forms */}
                    {mode !== "username" && (
                        <>
                            <form
                                onSubmit={
                                    mode === "signin"
                                        ? handleEmailSignIn
                                        : handleEmailSignUp
                                }
                                className='space-y-4'
                            >
                                <div>
                                    <input
                                        type='email'
                                        placeholder='juan@ground.com'
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        className='w-full px-4 py-3 rounded-xl border border-secondary/30 bg-tertiary/50 text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                                <div>
                                    <input
                                        type='password'
                                        placeholder='Password'
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        className='w-full px-4 py-3 rounded-xl border border-secondary/30 bg-tertiary/50 text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                                {mode === "signup" && (
                                    <div>
                                        <input
                                            type='password'
                                            placeholder='Confirm Password'
                                            value={confirmPassword}
                                            onChange={(e) =>
                                                setConfirmPassword(
                                                    e.target.value
                                                )
                                            }
                                            className='w-full px-4 py-3 rounded-xl border border-secondary/30 bg-tertiary/50 text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
                                            disabled={isLoading}
                                            required
                                        />
                                    </div>
                                )}
                                <button
                                    type='submit'
                                    disabled={isLoading}
                                    className='w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg'
                                >
                                    {isLoading
                                        ? "Loading..."
                                        : mode === "signin"
                                        ? "Sign in"
                                        : "Sign up"}
                                </button>
                            </form>

                            {/* Toggle Mode */}
                            <p className='text-center text-text/60 mt-6 text-sm'>
                                {mode === "signin" ? (
                                    <>
                                        Don&apos;t have an account?{" "}
                                        <button
                                            onClick={() => {
                                                setMode("signup")
                                                setError(null)
                                            }}
                                            className='text-primary font-semibold hover:underline'
                                        >
                                            Sign up
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        Already have an account?{" "}
                                        <button
                                            onClick={() => {
                                                setMode("signin")
                                                setError(null)
                                            }}
                                            className='text-primary font-semibold hover:underline'
                                        >
                                            Sign in
                                        </button>
                                    </>
                                )}
                            </p>
                        </>
                    )}
                </div>
            </motion.div>
        </main>
    )
}
