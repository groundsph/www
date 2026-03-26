"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    X,
    Shield,
    Loader2,
    AlertCircle,
    CheckCircle,
    Key,
    Lock,
    Smartphone,
    Fingerprint,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
    verifyActionConfirmation,
    getUserConfirmationStatus,
    type ConfirmationMethod,
    type UserConfirmationStatus,
    getActionDisplayName,
    type SensitiveAction,
} from "@/lib/action-confirmation"

interface ActionConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    action: SensitiveAction
    actionName?: string
    description?: string
    onConfirmed: () => void
    onCancel?: () => void
}

export default function ActionConfirmationModal({
    isOpen,
    onClose,
    action,
    actionName,
    description,
    onConfirmed,
    onCancel,
}: ActionConfirmationModalProps) {
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedMethod, setSelectedMethod] = useState<ConfirmationMethod | null>(null)
    const [totpCode, setTotpCode] = useState("")
    const [password, setPassword] = useState("")
    const [userStatus, setUserStatus] = useState<UserConfirmationStatus | null>(null)

    const displayName = actionName || getActionDisplayName(action)
    const defaultDescription = description || `This action requires additional verification before proceeding.`

    // Load user confirmation status when modal opens
    const loadUserStatus = useCallback(async () => {
        if (!isOpen) return
        setLoading(true)
        setError(null)
        try {
            const status = await getUserConfirmationStatus()
            setUserStatus(status)
            // Auto-select preferred method if available
            if (status.preferredMethod) {
                setSelectedMethod(status.preferredMethod)
            }
        } catch (err) {
            console.error("Error loading user status:", err)
            setError("Failed to load verification options")
        } finally {
            setLoading(false)
        }
    }, [isOpen])

    // Load status when modal opens
    useState(() => {
        if (isOpen) {
            loadUserStatus()
        }
    })

    const handleClose = () => {
        if (!verifying) {
            setError(null)
            setTotpCode("")
            setPassword("")
            setSelectedMethod(null)
            onClose()
            onCancel?.()
        }
    }

    const handlePasskeyVerify = async () => {
        setVerifying(true)
        setError(null)
        try {
            // Initiate passkey authentication via Better Auth
            const result = await authClient.signIn.passkey()

            if (result.error) {
                setError(result.error.message || "Passkey verification failed")
                return
            }

            // If passkey succeeded, complete the verification
            const verifyResult = await verifyActionConfirmation("passkey", {})
            if (verifyResult.success) {
                onConfirmed()
                handleClose()
            } else {
                setError(verifyResult.error || "Verification failed")
            }
        } catch (err) {
            console.error("Passkey verification error:", err)
            setError("Passkey verification failed. Please try again.")
        } finally {
            setVerifying(false)
        }
    }

    const handleTOTPVerify = async () => {
        if (!totpCode || totpCode.length !== 6) {
            setError("Please enter a valid 6-digit TOTP code")
            return
        }

        setVerifying(true)
        setError(null)
        try {
            const result = await verifyActionConfirmation("totp", { code: totpCode })
            if (result.success) {
                onConfirmed()
                handleClose()
            } else {
                setError(result.error || "Invalid TOTP code")
            }
        } catch (err) {
            console.error("TOTP verification error:", err)
            setError("TOTP verification failed. Please try again.")
        } finally {
            setVerifying(false)
        }
    }

    const handlePasswordVerify = async () => {
        if (!password) {
            setError("Please enter your password")
            return
        }

        setVerifying(true)
        setError(null)
        try {
            const result = await verifyActionConfirmation("password", { password })
            if (result.success) {
                onConfirmed()
                handleClose()
            } else {
                setError(result.error || "Invalid password")
            }
        } catch (err) {
            console.error("Password verification error:", err)
            setError("Password verification failed. Please try again.")
        } finally {
            setVerifying(false)
        }
    }

    const handleVerify = async () => {
        if (!selectedMethod) return

        switch (selectedMethod) {
            case "passkey":
                await handlePasskeyVerify()
                break
            case "totp":
                await handleTOTPVerify()
                break
            case "password":
                await handlePasswordVerify()
                break
        }
    }

    const getMethodIcon = (method: ConfirmationMethod) => {
        switch (method) {
            case "passkey":
                return <Fingerprint className="w-5 h-5" />
            case "totp":
                return <Smartphone className="w-5 h-5" />
            case "password":
                return <Lock className="w-5 h-5" />
        }
    }

    const getMethodLabel = (method: ConfirmationMethod) => {
        switch (method) {
            case "passkey":
                return "Passkey"
            case "totp":
                return "Authenticator App"
            case "password":
                return "Password"
        }
    }

    const getMethodDescription = (method: ConfirmationMethod) => {
        switch (method) {
            case "passkey":
                return "Use your device's biometric authentication or security key"
            case "totp":
                return "Enter the 6-digit code from your authenticator app"
            case "password":
                return "Enter your account password"
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:w-full bg-background rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-tertiary/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-lg">Confirm Action</h2>
                                    <p className="text-sm text-text/60">{displayName}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                disabled={verifying}
                                className="p-2 rounded-lg hover:bg-tertiary/30 transition-colors disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                                    <p className="text-text/60">Loading verification options...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Description */}
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm text-text/80">{defaultDescription}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Verification Methods */}
                                    {(!selectedMethod || selectedMethod === "passkey") && userStatus?.hasPasskey && (
                                        <button
                                            onClick={() => setSelectedMethod("passkey")}
                                            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all mb-3 ${
                                                selectedMethod === "passkey"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-tertiary/50 hover:border-primary/50 hover:bg-tertiary/20"
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                                                {getMethodIcon("passkey")}
                                            </div>
                                            <div className="text-left flex-1">
                                                <h3 className="font-medium">{getMethodLabel("passkey")}</h3>
                                                <p className="text-sm text-text/60">{getMethodDescription("passkey")}</p>
                                            </div>
                                            {selectedMethod === "passkey" && (
                                                <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                                            )}
                                        </button>
                                    )}

                                    {(!selectedMethod || selectedMethod === "totp") && userStatus?.hasTOTP && (
                                        <button
                                            onClick={() => setSelectedMethod("totp")}
                                            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all mb-3 ${
                                                selectedMethod === "totp"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-tertiary/50 hover:border-primary/50 hover:bg-tertiary/20"
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                                                {getMethodIcon("totp")}
                                            </div>
                                            <div className="text-left flex-1">
                                                <h3 className="font-medium">{getMethodLabel("totp")}</h3>
                                                <p className="text-sm text-text/60">{getMethodDescription("totp")}</p>
                                            </div>
                                            {selectedMethod === "totp" && (
                                                <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                                            )}
                                        </button>
                                    )}

                                    {(!selectedMethod || selectedMethod === "password") && userStatus?.hasPassword && (
                                        <button
                                            onClick={() => setSelectedMethod("password")}
                                            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all mb-3 ${
                                                selectedMethod === "password"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-tertiary/50 hover:border-primary/50 hover:bg-tertiary/20"
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                                                {getMethodIcon("password")}
                                            </div>
                                            <div className="text-left flex-1">
                                                <h3 className="font-medium">{getMethodLabel("password")}</h3>
                                                <p className="text-sm text-text/60">{getMethodDescription("password")}</p>
                                            </div>
                                            {selectedMethod === "password" && (
                                                <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                                            )}
                                        </button>
                                    )}

                                    {/* No methods available */}
                                    {userStatus && !userStatus.hasPasskey && !userStatus.hasTOTP && !userStatus.hasPassword && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-medium text-red-600">No verification methods available</p>
                                                    <p className="text-sm text-text/60 mt-1">
                                                        Please set up a passkey, TOTP, or password in your account settings before performing this action.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TOTP Input */}
                                    {selectedMethod === "totp" && (
                                        <div className="mt-6">
                                            <label className="block text-sm font-medium mb-2">
                                                Enter 6-digit code
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={6}
                                                value={totpCode}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                                                    setTotpCode(value)
                                                }}
                                                placeholder="000000"
                                                className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] bg-tertiary/20 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                                                disabled={verifying}
                                                autoFocus
                                            />
                                        </div>
                                    )}

                                    {/* Password Input */}
                                    {selectedMethod === "password" && (
                                        <div className="mt-6">
                                            <label className="block text-sm font-medium mb-2">
                                                Enter your password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    className="w-full px-4 py-3 pr-10 bg-tertiary/20 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    disabled={verifying}
                                                    autoFocus
                                                />
                                                <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {error && (
                                        <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-600">{error}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!loading && (
                            <div className="p-4 border-t border-tertiary/50 flex gap-3">
                                {selectedMethod && (
                                    <button
                                        onClick={() => setSelectedMethod(null)}
                                        disabled={verifying}
                                        className="px-4 py-2 rounded-lg font-medium text-text/70 hover:bg-tertiary/30 transition-colors disabled:opacity-50"
                                    >
                                        Back
                                    </button>
                                )}
                                <button
                                    onClick={handleClose}
                                    disabled={verifying}
                                    className="px-4 py-2 rounded-lg font-medium text-text/70 hover:bg-tertiary/30 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                {selectedMethod && (
                                    <button
                                        onClick={handleVerify}
                                        disabled={verifying || (selectedMethod === "totp" && totpCode.length !== 6) || (selectedMethod === "password" && !password)}
                                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {verifying ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Verifying...
                                            </>
                                        ) : (
                                            <>Verify & Continue</>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
