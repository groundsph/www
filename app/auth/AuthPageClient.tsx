"use client"

import { AuthContext } from "@/components/AuthProvider"
import {
    checkUsernameAvailability,
    updateProfile,
} from "@/app/api/actions/profile"
import { signIn, signUp, authClient } from "@/lib/auth-client"
import { motion } from "motion/react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useContext } from "react"

type AuthMode = "signin" | "signup" | "username" | "reset"

export default function AuthPageClient() {
    // Context
    const authContext = useContext(AuthContext)
    if (!authContext) {
        throw new Error("AuthContext not found")
    }
    const { refreshProfile, user } = authContext

    // Constants
    const searchParams = useSearchParams()
    const router = useRouter()

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
        "idle" | "checking" | "available" | "taken" | "current"
    >("idle")
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [currentProfile, setCurrentProfile] = useState<{
        id: string
        username: string
        display_name: string
    } | null>(null)

    // Effects
    useEffect(() => {
        const setup = searchParams.get("setup")
        const authError = searchParams.get("error")

        if (setup === "username" && user) {
            setMode("username")
            // Fetch current profile to pre-fill and show current username
            const fetchCurrentProfile = async () => {
                try {
                    const response = await fetch(`/api/profile/${user.id}`)
                    if (response.ok) {
                        const profile = await response.json()
                        if (profile) {
                            setCurrentProfile(profile)
                            setUsername(profile.username || "")
                            setDisplayName(profile.display_name || "")
                        }
                    }
                } catch (err) {
                    console.error("Error fetching profile:", err)
                }
            }
            fetchCurrentProfile()
        }
        if (authError === "auth_failed") {
            setError("Authentication failed. Please try again.")
        }
    }, [searchParams, user])

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

        // If username matches current username, it's their own - mark as current
        if (
            currentProfile &&
            username.trim().toLowerCase() ===
                currentProfile.username.toLowerCase()
        ) {
            setUsernameStatus("current")
            return
        }

        setUsernameStatus("checking")

        const timeoutId = setTimeout(async () => {
            try {
                // Pass current user ID to exclude from availability check
                const result = await checkUsernameAvailability(
                    username.trim(),
                    currentProfile?.id
                )
                setUsernameStatus(result.available ? "available" : "taken")
            } catch {
                setUsernameStatus("idle")
            }
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [username, mode, currentProfile])

    // Conditional UI (Passkey Autofill)
    useEffect(() => {
        if (mode === "signin") {
            authClient.signIn
                .passkey({
                    autoFill: true,
                    fetchOptions: {
                        onError: (ctx) => {
                            // Ignore abort errors from conditional UI
                            if (ctx.error.status !== 401) {
                                console.error(
                                    "Passkey autofill error:",
                                    ctx.error
                                )
                            }
                        },
                    },
                })
                .catch(() => {
                    // Ignore initial abort errors or failures when conditional UI starts
                })
        }
    }, [mode])

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
            const { error } = await signIn.email({
                email,
                password,
            })
            if (error) throw new Error(error.message)
            // Redirect on success
            const redirect = searchParams.get("redirect") || "/"
            window.location.href = redirect
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

        if (!acceptedTerms) {
            setError(
                "You must accept the Terms and Conditions to create an account"
            )
            setIsLoading(false)
            return
        }

        try {
            const { error } = await signUp.email({
                email,
                password,
                name: email.split("@")[0], // Use email prefix as initial name
            })
            if (error) throw new Error(error.message)
            // Move to username step and update URL to stay in sync
            const redirectParam = searchParams.get("redirect")
            const newUrl = redirectParam
                ? `/auth?setup=username&redirect=${encodeURIComponent(redirectParam)}`
                : "/auth?setup=username"
            router.replace(newUrl)
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
            if (!user) throw new Error("Not authenticated")

            // Update profile via server action
            const result = await updateProfile(user.id, {
                username: username.trim(),
                display_name: displayName.trim(),
                profile_completed: true,
            })

            if (!result.success) throw new Error(result.error)

            refreshProfile()
            // Redirect on success
            const redirect = searchParams.get("redirect") || "/"
            window.location.href = redirect
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
            // Call the forgot password endpoint
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    redirectTo: `${window.location.origin}/auth/reset-password`,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Failed to send reset email")
            }

            setSuccess("Password reset link sent! Check your email.")
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
                                {currentProfile && (
                                    <span className='block mt-2 text-text/50'>
                                        Your current username is{" "}
                                        <span className='font-mono text-primary'>
                                            @{currentProfile.username}
                                        </span>
                                    </span>
                                )}
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
                                                  : usernameStatus === "current"
                                                    ? "border-blue-400 focus:border-blue-400"
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
                                            {usernameStatus === "current" && (
                                                <svg
                                                    className='w-5 h-5 text-blue-500'
                                                    fill='none'
                                                    viewBox='0 0 24 24'
                                                    stroke='currentColor'
                                                >
                                                    <path
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                        strokeWidth={2}
                                                        d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
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
                                {usernameStatus === "current" && (
                                    <p className='text-blue-500 text-xs mt-1'>
                                        This is your current username
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
                                        name='email'
                                        autoComplete='username webauthn'
                                        placeholder='juan@grounds.ph'
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
                                    <>
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
                                        <div className='flex items-start gap-3'>
                                            <input
                                                type='checkbox'
                                                id='accept-terms'
                                                checked={acceptedTerms}
                                                onChange={(e) =>
                                                    setAcceptedTerms(
                                                        e.target.checked
                                                    )
                                                }
                                                className='mt-1 w-4 h-4 rounded border-secondary/30 text-primary focus:ring-primary/50 cursor-pointer'
                                                disabled={isLoading}
                                            />
                                            <label
                                                htmlFor='accept-terms'
                                                className='text-sm text-text/70 cursor-pointer'
                                            >
                                                I agree to the{" "}
                                                <Link
                                                    href='/legal/terms/accounts'
                                                    target='_blank'
                                                    className='text-primary hover:underline'
                                                >
                                                    Terms and Conditions
                                                </Link>{" "}
                                                and{" "}
                                                <Link
                                                    href='/legal/privacy'
                                                    target='_blank'
                                                    className='text-primary hover:underline'
                                                >
                                                    Privacy Policy
                                                </Link>
                                            </label>
                                        </div>
                                    </>
                                )}
                                <button
                                    type='submit'
                                    disabled={
                                        isLoading ||
                                        (mode === "signup" && !acceptedTerms)
                                    }
                                    className='w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg cursor-pointer'
                                >
                                    {isLoading
                                        ? "Loading..."
                                        : mode === "signin"
                                          ? "Sign in"
                                          : "Sign up"}
                                </button>
                            </form>

                            {/* Passkey Sign In - Only on sign-in mode */}
                            {mode === "signin" && (
                                <div className='mt-4'>
                                    <div className='relative flex items-center justify-center text-text/40 text-sm my-4'>
                                        <div className='flex-1 border-t border-text/10' />
                                        <span className='px-3'>or</span>
                                        <div className='flex-1 border-t border-text/10' />
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setIsLoading(true)
                                            setError(null)
                                            try {
                                                const result =
                                                    await authClient.signIn.passkey()
                                                if (result.error) {
                                                    setError(
                                                        result.error.message ||
                                                            "Passkey authentication failed"
                                                    )
                                                } else {
                                                    const redirect =
                                                        searchParams.get(
                                                            "redirect"
                                                        ) || "/"
                                                    window.location.href =
                                                        redirect
                                                }
                                            } catch (err) {
                                                console.error(
                                                    "Passkey sign-in error:",
                                                    err
                                                )
                                                setError(
                                                    "Passkey authentication failed"
                                                )
                                            } finally {
                                                setIsLoading(false)
                                            }
                                        }}
                                        disabled={isLoading}
                                        className='w-full py-3 bg-text/10 text-text font-semibold rounded-xl hover:bg-text/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                                    >
                                        <svg
                                            className='w-5 h-5'
                                            fill='none'
                                            viewBox='0 0 24 24'
                                            stroke='currentColor'
                                        >
                                            <path
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                                strokeWidth={2}
                                                d='M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4'
                                            />
                                        </svg>
                                        Sign in with Passkey
                                    </button>
                                </div>
                            )}

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
