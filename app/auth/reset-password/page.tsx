"use client"

import { createLocalClient } from "@/utils/supabase/client"
import { motion } from "motion/react"
import Link from "next/link"
import { useState } from "react"

export default function ResetPasswordPage() {
    const supabase = createLocalClient()
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters")
            return
        }

        setIsLoading(true)

        try {
            const { error } = await supabase.auth.updateUser({ password })

            if (error) {
                throw error
            }

            setSuccess(true)
            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = "/auth"
            }, 2000)
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Failed to reset password"
            )
        } finally {
            setIsLoading(false)
        }
    }

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
                    <h2 className='text-2xl font-semibold font-serif text-text mb-6'>
                        Set New Password
                    </h2>

                    {/* Error Message */}
                    {error && (
                        <div className='bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm'>
                            {error}
                        </div>
                    )}

                    {/* Success Message */}
                    {success ? (
                        <div className='bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm'>
                            Password updated successfully! Redirecting to
                            login...
                        </div>
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className='space-y-4'
                        >
                            <div>
                                <input
                                    type='password'
                                    placeholder='New Password'
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    className='w-full px-4 py-3 rounded-xl border border-secondary/30 bg-tertiary/50 text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
                                    disabled={isLoading}
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div>
                                <input
                                    type='password'
                                    placeholder='Confirm New Password'
                                    value={confirmPassword}
                                    onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    className='w-full px-4 py-3 rounded-xl border border-secondary/30 bg-tertiary/50 text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'
                                    disabled={isLoading}
                                    required
                                    minLength={6}
                                />
                            </div>
                            <button
                                type='submit'
                                disabled={isLoading}
                                className='w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg'
                            >
                                {isLoading ? "Updating..." : "Update Password"}
                            </button>
                        </form>
                    )}

                    <p className='text-center text-text/60 mt-6 text-sm'>
                        <Link
                            href='/auth'
                            className='text-primary font-semibold hover:underline'
                        >
                            Back to Sign in
                        </Link>
                    </p>
                </div>
            </motion.div>
        </main>
    )
}
