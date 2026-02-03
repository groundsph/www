"use client"

import { useAuth } from "@/components/AuthProvider"
import {
    checkUsernameAvailability,
    updateProfile,
} from "@/app/api/actions/profile"
import { signIn, signUp, authClient } from "@/lib/auth-client"
import { motion } from "motion/react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useNotification } from "@/components/NotificationProvider"

type AuthMode = "signin" | "signup" | "username" | "reset"

export default function AuthPageClient() {
    // Context
    const { refreshProfile, user } = useAuth()
    const { addNotification } = useNotification()

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
    const [usernameStatus, setUsernameStatus] = useState<
        "idle" | "checking" | "available" | "taken" | "current"
    >("idle")
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [currentProfile, setCurrentProfile] = useState<{
        id: string
        username: string
        display_name: string
    } | null>(null)
    const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)

    // Get last used login method
    const lastMethod = authClient.getLastUsedLoginMethod()

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
            addNotification("Authentication failed. Please try again.", "error")
        }
    }, [searchParams, user, addNotification])

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
        if (mode !== "signin") return

        const initPasskeyAutofill = async () => {
            // Check if conditional mediation (autofill) is available
            const isAvailable =
                await PublicKeyCredential.isConditionalMediationAvailable?.()
            if (!isAvailable) return

            authClient.signIn
                .passkey({
                    autoFill: true,
                    fetchOptions: {
                        onError: (ctx) => {
                            // Ignore abort errors from conditional UI - don't show notifications
                            if (ctx.error.status !== 401) {
                                console.error(
                                    "Passkey autofill error:",
                                    ctx.error
                                )
                            }
                        },
                    },
                })
                .then((result) => {
                    if (result?.error) {
                        // Don't log errors for autofill - it's expected to fail/cancel
                        // when the user doesn't use a passkey
                        const isAbortError = 
                            result.error.message?.includes("abort") ||
                            result.error.message?.includes("cancelled") ||
                            result.error.message?.includes("user") ||
                            !result.error.message ||
                            Object.keys(result.error).length === 0
                        
                        if (!isAbortError) {
                            console.error(
                                "Passkey authentication failed:",
                                result.error
                            )
                        }
                    } else {
                        const redirect = searchParams.get("redirect") || "/"
                        window.location.href = redirect
                    }
                })
                .catch(() => {
                    // Ignore initial abort errors or failures when conditional UI starts
                })
        }

        initPasskeyAutofill()
    }, [mode, searchParams])

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
            addNotification(
                err instanceof Error ? err.message : "Failed to sign in",
                "error"
            )
        } finally {
            setIsLoading(false)
        }
    }

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        if (password !== confirmPassword) {
            addNotification("Passwords do not match", "error")
            setIsLoading(false)
            return
        }

        if (!isPasswordValid) {
            addNotification("Please fulfill all password requirements", "error")
            setIsLoading(false)
            return
        }

        if (!acceptedTerms) {
            addNotification(
                "You must accept the Terms and Conditions to create an account",
                "error"
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
            addNotification(
                err instanceof Error ? err.message : "Failed to sign up",
                "error"
            )
        } finally {
            setIsLoading(false)
        }
    }

    const handleUsernameSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        if (!username.trim()) {
            addNotification("Username is required", "error")
            setIsLoading(false)
            return
        }

        if (!displayName.trim()) {
            addNotification("Display name is required", "error")
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
            addNotification(
                err instanceof Error ? err.message : "Failed to set profile",
                "error"
            )
        } finally {
            setIsLoading(false)
        }
    }

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

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

            addNotification(
                "Password reset link sent! Check your email.",
                "success"
            )
            setEmail("")
        } catch (err: unknown) {
            addNotification(
                err instanceof Error
                    ? err.message
                    : "Failed to send reset email",
                "error"
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
                        <span className='text-primary/80'>.ph</span>
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
                                    <span className="flex items-center justify-center gap-2">
                                        {isLoading
                                            ? "Loading..."
                                            : mode === "signin"
                                              ? "Sign in"
                                              : "Sign up"}
                                        {!isLoading && mode === "signin" && lastMethod === "email" && (
                                            <span className='ml-2 text-xs bg-white text-primary px-2 py-0.5 rounded-full'>
                                                Last used
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </form>

                            {mode === "signin" && (
                                <div className='mt-4'>
                                    <div className='relative flex items-center justify-center text-text/40 text-sm my-4'>
                                        <div className='flex-1 border-t border-text/10' />
                                        <span className='px-3'>or</span>
                                        <div className='flex-1 border-t border-text/10' />
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setIsPasskeyLoading(true)
                                            try {
                                                const result =
                                                    await authClient.signIn.passkey()
                                                if (result.error) {
                                                    // Check if user cancelled
                                                    const errorMsg = result.error.message || ""
                                                    const isCancelled =
                                                        errorMsg.toLowerCase().includes("cancel") ||
                                                        errorMsg.toLowerCase().includes("abort") ||
                                                        errorMsg.toLowerCase().includes("not allowed")

                                                    if (isCancelled) {
                                                        addNotification("Passkey sign-in cancelled", "warning")
                                                    } else {
                                                        addNotification(
                                                            result.error.message || "Passkey authentication failed",
                                                            "error"
                                                        )
                                                    }
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
                                                addNotification(
                                                    "An unexpected error occurred during passkey sign-in",
                                                    "error"
                                                )
                                            } finally {
                                                setIsPasskeyLoading(false)
                                            }
                                        }}
                                        disabled={isLoading || isPasskeyLoading}
                                        className='w-full py-3 bg-text/10 text-text font-semibold rounded-xl hover:bg-text/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                                    >
                                        {isPasskeyLoading ? (
                                            <>
                                                <div className='w-4 h-4 border-2 border-text/30 border-t-text rounded-full animate-spin' />
                                                Waiting for passkey...
                                            </>
                                        ) : (
                                            <>
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
                                                <span>Sign in with Passkey</span>
                                                {lastMethod === "passkey" && (
                                                    <span className='ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full'>
                                                        Last used
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Social Sign In */}
                            <div className='relative flex items-center justify-center text-text/40 text-sm my-4'>
                                <div className='flex-1 border-t border-text/10' />
                                <span className='px-3'>or continue with</span>
                                <div className='flex-1 border-t border-text/10' />
                            </div>

                            <div className='flex flex-col gap-3 mb-4 [&_button]:cursor-pointer'>
                                <button
                                    onClick={async () => {
                                        setIsLoading(true)
                                        try {
                                            await signIn.social({
                                                provider: "google",
                                                callbackURL:
                                                    searchParams.get(
                                                        "redirect"
                                                    ) || "/",
                                            })
                                        } catch (err) {
                                            console.error(
                                                "Google sign in error",
                                                err
                                            )
                                            addNotification(
                                                "Failed to sign in with Google",
                                                "error"
                                            )
                                            setIsLoading(false)
                                        }
                                    }}
                                    disabled={isLoading}
                                    className='w-full py-3 bg-text/10 text-text font-semibold rounded-xl hover:bg-text/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                                >
                                    <svg
                                        viewBox='0 0 24 24'
                                        className='w-5 h-5'
                                        xmlns='http://www.w3.org/2000/svg'
                                    >
                                        <path
                                            d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                                            fill='#4285F4'
                                        />
                                        <path
                                            d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                                            fill='#34A853'
                                        />
                                        <path
                                            d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                                            fill='#FBBC05'
                                        />
                                        <path
                                            d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                                            fill='#EA4335'
                                        />
                                    </svg>
                                    <span>Google</span>
                                    {lastMethod === "google" && (
                                        <span className='ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full'>
                                            Last used
                                        </span>
                                    )}
                                </button>
                                {/* <button
                                    onClick={async () => {
                                        setIsLoading(true)
                                        try {
                                            await signIn.social({
                                                provider: "facebook",
                                                callbackURL:
                                                    searchParams.get(
                                                        "redirect"
                                                    ) || "/",
                                            })
                                        } catch (err) {
                                            console.error(
                                                "Facebook sign in error",
                                                err
                                            )
                                            addNotification(
                                                "Failed to sign in with Facebook",
                                                "error"
                                            )
                                            setIsLoading(false)
                                        }
                                    }}
                                    disabled={isLoading}
                                    className='w-full py-3 bg-text/10 text-text font-semibold rounded-xl hover:bg-text/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                                >
                                    <svg
                                        viewBox='0 0 24 24'
                                        className='w-5 h-5 fill-current'
                                        xmlns='http://www.w3.org/2000/svg'
                                    >
                                        <path d='M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.771-5.818 5.766-5.818 2.022 0 3.19.17 3.19.17l-.014 3.61h-2.11c-1.361 0-1.781.962-1.781 2.068v1.561h3.984l-.136 3.681h-3.848v7.953h-5.05z' />
                                    </svg>
                                    Facebook
                                </button> */}
                                <button
                                    onClick={async () => {
                                        setIsLoading(true)
                                        try {
                                            await signIn.social({
                                                provider: "discord",
                                                callbackURL:
                                                    searchParams.get(
                                                        "redirect"
                                                    ) || "/",
                                            })
                                        } catch (err) {
                                            console.error(
                                                "Discord sign in error",
                                                err
                                            )
                                            addNotification(
                                                "Failed to sign in with Discord",
                                                "error"
                                            )
                                            setIsLoading(false)
                                        }
                                    }}
                                    disabled={isLoading}
                                    className='w-full py-3 bg-text/10 text-text font-semibold rounded-xl hover:bg-text/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                                >
                                    <svg
                                        viewBox='0 0 24 24'
                                        className='w-5 h-5 fill-current'
                                        xmlns='http://www.w3.org/2000/svg'
                                    >
                                        <path d='M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z' />
                                    </svg>
                                    <span>Discord</span>
                                    {lastMethod === "discord" && (
                                        <span className='ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full'>
                                            Last used
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Forgot Password Link */}
                            {mode === "signin" && (
                                <p className='text-center mt-4'>
                                    <button
                                        onClick={() => {
                                            setMode("reset")
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
