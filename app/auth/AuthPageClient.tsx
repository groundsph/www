"use client"

import { AuthContext } from "@/components/AuthProvider"
import { checkUsernameAvailability } from "@/app/api/actions/profile"
import { createLocalClient } from "@/utils/supabase/client"
import { motion } from "motion/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState, useEffect, useContext } from "react"

type AuthMode = "signin" | "signup" | "username" | "reset"

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
    const [success, setSuccess] = useState<string | null>(null)
    const [usernameStatus, setUsernameStatus] = useState<
        "idle" | "checking" | "available" | "taken"
    >("idle")

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

    // Debounced username availability check
    useEffect(() => {
        if (mode !== "username" || !username.trim()) {
            setUsernameStatus("idle")
            return
        }

        if (username.trim().length < 3) {
            setUsernameStatus("idle")
            return
        }

        setUsernameStatus("checking")

        const timeoutId = setTimeout(async () => {
            try {
                const result = await checkUsernameAvailability(username.trim())
                setUsernameStatus(result.available ? "available" : "taken")
            } catch {
                setUsernameStatus("idle")
            }
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [username, mode])

    // Functions
    const checkPasswordRequirements = (password: string) => {
        return {
            length: password.length >= 12,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password),
        }
    }

    const passwordRequirements = checkPasswordRequirements(password)
    const isPasswordValid = Object.values(passwordRequirements).every(Boolean)

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

        if (!isPasswordValid) {
            setError("Please fulfill all password requirements")
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

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to send reset email")
            }

            setSuccess(data.message)
            setEmail("")
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to send reset email"
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
                        {mode === "reset" && "Reset Your Password"}
                    </h2>

                    {/* Error Message */}
                    {error && (
                        <div className='bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm'>
                            {error}
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className='bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm'>
                            {success}
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
                                <div className='relative'>
                                    <input
                                        type='text'
                                        placeholder='Username (unique identifier)'
                                        value={username}
                                        onChange={(e) =>
                                            setUsername(
                                                e.target.value
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9_]/g, "")
                                            )
                                        }
                                        className={`w-full px-4 py-3 rounded-xl border bg-tertiary/50 text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
                                            usernameStatus === "taken"
                                                ? "border-red-400 focus:border-red-400"
                                                : usernameStatus === "available"
                                                  ? "border-green-400 focus:border-green-400"
                                                  : "border-secondary/30 focus:border-primary"
                                        }`}
                                        disabled={isLoading}
                                        required
                                        minLength={3}
                                    />
                                    {/* Status indicator */}
                                    {username.trim().length >= 3 && (
                                        <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                                            {usernameStatus === "checking" && (
                                                <div className='w-4 h-4 border-2 border-text/30 border-t-primary rounded-full animate-spin' />
                                            )}
                                            {usernameStatus === "available" && (
                                                <svg
                                                    className='w-5 h-5 text-green-500'
                                                    fill='none'
                                                    viewBox='0 0 24 24'
                                                    stroke='currentColor'
                                                >
                                                    <path
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                        strokeWidth={2}
                                                        d='M5 13l4 4L19 7'
                                                    />
                                                </svg>
                                            )}
                                            {usernameStatus === "taken" && (
                                                <svg
                                                    className='w-5 h-5 text-red-500'
                                                    fill='none'
                                                    viewBox='0 0 24 24'
                                                    stroke='currentColor'
                                                >
                                                    <path
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                        strokeWidth={2}
                                                        d='M6 18L18 6M6 6l12 12'
                                                    />
                                                </svg>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* Status message */}
                                {usernameStatus === "taken" && (
                                    <p className='text-red-500 text-xs mt-1'>
                                        This username is already taken
                                    </p>
                                )}
                                {usernameStatus === "available" && (
                                    <p className='text-green-500 text-xs mt-1'>
                                        Username is available!
                                    </p>
                                )}
                                {username.trim().length > 0 &&
                                    username.trim().length < 3 && (
                                        <p className='text-text/50 text-xs mt-1'>
                                            Username must be at least 3
                                            characters
                                        </p>
                                    )}
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
                                disabled={
                                    isLoading ||
                                    usernameStatus === "taken" ||
                                    usernameStatus === "checking"
                                }
                                className='w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer'
                            >
                                {isLoading ? "Saving..." : "Complete Sign Up"}
                            </button>
                        </form>
                    )}

                    {/* Sign In / Sign Up Forms */}
                    {(mode === "signin" || mode === "signup") && (
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
                                    {mode === "signup" && (
                                        <div className='mt-3 space-y-2 p-3 bg-tertiary/30 rounded-lg border border-secondary/20'>
                                            <p className='text-xs font-semibold text-text/70 uppercase tracking-wider mb-2'>
                                                Password Requirements
                                            </p>
                                            <div className='grid grid-cols-1 gap-1'>
                                                <div
                                                    className={`flex items-center gap-2 text-xs ${passwordRequirements.length ? "text-green-600" : "text-text/50"}`}
                                                >
                                                    <div
                                                        className={`w-1.5 h-1.5 rounded-full ${passwordRequirements.length ? "bg-green-500" : "bg-text/30"}`}
                                                    />
                                                    At least 12 characters
                                                </div>
                                                <div
                                                    className={`flex items-center gap-2 text-xs ${passwordRequirements.uppercase ? "text-green-600" : "text-text/50"}`}
                                                >
                                                    <div
                                                        className={`w-1.5 h-1.5 rounded-full ${passwordRequirements.uppercase ? "bg-green-500" : "bg-text/30"}`}
                                                    />
                                                    One uppercase letter
                                                </div>
                                                <div
                                                    className={`flex items-center gap-2 text-xs ${passwordRequirements.lowercase ? "text-green-600" : "text-text/50"}`}
                                                >
                                                    <div
                                                        className={`w-1.5 h-1.5 rounded-full ${passwordRequirements.lowercase ? "bg-green-500" : "bg-text/30"}`}
                                                    />
                                                    One lowercase letter
                                                </div>
                                                <div
                                                    className={`flex items-center gap-2 text-xs ${passwordRequirements.number ? "text-green-600" : "text-text/50"}`}
                                                >
                                                    <div
                                                        className={`w-1.5 h-1.5 rounded-full ${passwordRequirements.number ? "bg-green-500" : "bg-text/30"}`}
                                                    />
                                                    One number
                                                </div>
                                                <div
                                                    className={`flex items-center gap-2 text-xs ${passwordRequirements.special ? "text-green-600" : "text-text/50"}`}
                                                >
                                                    <div
                                                        className={`w-1.5 h-1.5 rounded-full ${passwordRequirements.special ? "bg-green-500" : "bg-text/30"}`}
                                                    />
                                                    One special character
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                                    className='w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer'
                                >
                                    {isLoading
                                        ? "Loading..."
                                        : mode === "signin"
                                          ? "Sign in"
                                          : "Sign up"}
                                </button>
                            </form>

                            {/* Forgot Password Link */}
                            {mode === "signin" && (
                                <p className='text-center mt-4'>
                                    <button
                                        onClick={() => {
                                            setMode("reset")
                                            setError(null)
                                            setSuccess(null)
                                        }}
                                        className='text-text/60 text-sm hover:text-primary transition-colors cursor-pointer'
                                    >
                                        Forgot your password?
                                    </button>
                                </p>
                            )}

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
                                            className='text-primary font-semibold hover:underline cursor-pointer'
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
                                            className='text-primary font-semibold hover:underline cursor-pointer'
                                        >
                                            Sign in
                                        </button>
                                    </>
                                )}
                            </p>
                        </>
                    )}

                    {/* Password Reset Form */}
                    {mode === "reset" && (
                        <>
                            <form
                                onSubmit={handlePasswordReset}
                                className='space-y-4'
                            >
                                <p className='text-text/70 text-sm mb-4'>
                                    Enter your email address and we&apos;ll send
                                    you a link to reset your password.
                                </p>
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
                                <button
                                    type='submit'
                                    disabled={isLoading}
                                    className='w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer'
                                >
                                    {isLoading
                                        ? "Sending..."
                                        : "Send Reset Link"}
                                </button>
                            </form>

                            <p className='text-center text-text/60 mt-6 text-sm'>
                                Remember your password?{" "}
                                <button
                                    onClick={() => {
                                        setMode("signin")
                                        setError(null)
                                        setSuccess(null)
                                    }}
                                    className='text-primary font-semibold hover:underline'
                                >
                                    Sign in
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </motion.div>
        </main>
    )
}
