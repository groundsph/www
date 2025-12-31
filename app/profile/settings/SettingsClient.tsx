"use client"

import { authClient } from "@/lib/auth-client"
import { useNotification } from "@/components/NotificationProvider"
import { motion, AnimatePresence } from "motion/react"
import {
    ArrowLeft,
    Eye,
    EyeOff,
    Fingerprint,
    Key,
    Laptop,
    Loader2,
    LogOut,
    Monitor,
    Plus,
    Shield,
    Smartphone,
    Trash2,
    Link2,
    Check,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import {
    getLinkedAccounts,
    hasPassword,
    setPassword as setUserPassword,
    type LinkedAccount,
} from "@/app/api/actions/auth"

interface User {
    id: string
    email: string
    name: string
    emailVerified: boolean
    image?: string | null
    createdAt: Date
    updatedAt: Date
    role?: string | null
}

interface Session {
    id: string
    token: string
    userId: string
    expiresAt: Date
    createdAt: Date
    ipAddress?: string | null
    userAgent?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Passkey type from better-auth
type Passkey = Record<string, any>

type TabType = "password" | "sessions" | "passkeys" | "connected-accounts"

export default function SettingsClient({ user }: { user: User }) {
    const { addNotification } = useNotification()
    const searchParams = useSearchParams()

    // Initialize active tab from URL or default to 'password'
    const [activeTab, setActiveTab] = useState<TabType>(() => {
        const tab = searchParams.get("tab")
        if (
            tab &&
            ["password", "sessions", "passkeys", "connected-accounts"].includes(
                tab
            )
        ) {
            return tab as TabType
        }
        return "password"
    })

    // Password change state
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [isChangingPassword, setIsChangingPassword] = useState(false)

    // Sessions state
    const [sessions, setSessions] = useState<Session[]>([])
    const [loadingSessions, setLoadingSessions] = useState(true)
    const [revokingSession, setRevokingSession] = useState<string | null>(null)

    // Passkeys state
    const [passkeys, setPasskeys] = useState<Passkey[]>([])
    const [loadingPasskeys, setLoadingPasskeys] = useState(true)
    const [addingPasskey, setAddingPasskey] = useState(false)
    const [deletingPasskey, setDeletingPasskey] = useState<string | null>(null)
    const [passkeyName, setPasskeyName] = useState("")

    // Linked Accounts state
    const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
    const [hasPasswordSet, setHasPasswordSet] = useState(true)
    const [loadingLinkedAccounts, setLoadingLinkedAccounts] = useState(true)
    const [isLinking, setIsLinking] = useState<string | null>(null)

    // Fetch sessions
    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const result = await authClient.listSessions()
                if (result.data) {
                    setSessions(result.data as Session[])
                }
            } catch (error) {
                console.error("Error fetching sessions:", error)
            } finally {
                setLoadingSessions(false)
            }
        }
        fetchSessions()
    }, [])

    // Fetch passkeys
    useEffect(() => {
        const fetchPasskeys = async () => {
            try {
                const result = await authClient.passkey.listUserPasskeys()
                if (result.data) {
                    setPasskeys(result.data)
                }
            } catch (error) {
                console.error("Error fetching passkeys:", error)
            } finally {
                setLoadingPasskeys(false)
            }
        }
        fetchPasskeys()
    }, [])

    // Fetch linked accounts and password status
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [accounts, passwordStatus] = await Promise.all([
                    getLinkedAccounts(),
                    hasPassword(),
                ])
                setLinkedAccounts(accounts)
                setHasPasswordSet(passwordStatus)
            } catch (error) {
                console.error("Error fetching auth data:", error)
            } finally {
                setLoadingLinkedAccounts(false)
            }
        }
        fetchData()
    }, [])

    // Handle password change
    const handleChangePassword = async () => {
        if (!hasPasswordSet) {
            // Set Password Flow
            if (!newPassword || !confirmPassword) {
                addNotification("Please fill in all password fields", "error")
                return
            }
        } else {
            // Change Password Flow
            if (!currentPassword || !newPassword || !confirmPassword) {
                addNotification("Please fill in all password fields", "error")
                return
            }
        }

        if (newPassword.length < 6) {
            addNotification(
                "New password must be at least 6 characters",
                "error"
            )
            return
        }
        if (newPassword !== confirmPassword) {
            addNotification("Passwords do not match", "error")
            return
        }

        setIsChangingPassword(true)
        try {
            if (!hasPasswordSet) {
                // Set initial password
                const result = await setUserPassword(newPassword)
                if (!result.success) {
                    addNotification(
                        result.error || "Failed to set password",
                        "error"
                    )
                } else {
                    addNotification("Password set successfully", "success")
                    setHasPasswordSet(true)
                    setNewPassword("")
                    setConfirmPassword("")
                }
            } else {
                // Change existing password
                const result = await authClient.changePassword({
                    currentPassword,
                    newPassword,
                    revokeOtherSessions: false,
                })

                if (result.error) {
                    addNotification(
                        result.error.message || "Failed to change password",
                        "error"
                    )
                } else {
                    addNotification("Password changed successfully", "success")
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                }
            }
        } catch (error) {
            console.error("Error changing password:", error)
            addNotification("Failed to change password", "error")
        } finally {
            setIsChangingPassword(false)
        }
    }

    // Handle revoke session
    const handleRevokeSession = async (token: string) => {
        setRevokingSession(token)
        try {
            const result = await authClient.revokeSession({ token })
            if (result.error) {
                addNotification("Failed to revoke session", "error")
            } else {
                setSessions((prev) => prev.filter((s) => s.token !== token))
                addNotification("Session revoked successfully", "success")
            }
        } catch (error) {
            console.error("Error revoking session:", error)
            addNotification("Failed to revoke session", "error")
        } finally {
            setRevokingSession(null)
        }
    }

    // Handle revoke all other sessions
    const handleRevokeOtherSessions = async () => {
        try {
            const result = await authClient.revokeOtherSessions()
            if (result.error) {
                addNotification("Failed to revoke sessions", "error")
            } else {
                // Keep only current session
                const currentSession = await authClient.getSession()
                if (currentSession.data?.session) {
                    setSessions([currentSession.data.session as Session])
                }
                addNotification(
                    "Other sessions revoked successfully",
                    "success"
                )
            }
        } catch (error) {
            console.error("Error revoking sessions:", error)
            addNotification("Failed to revoke sessions", "error")
        }
    }

    // Handle add passkey
    const handleAddPasskey = async () => {
        setAddingPasskey(true)
        try {
            const result = await authClient.passkey.addPasskey({
                name: passkeyName || "My Passkey",
            })

            if (result.error) {
                addNotification(
                    result.error.message || "Failed to add passkey",
                    "error"
                )
            } else {
                // Refresh passkeys list
                const refreshed = await authClient.passkey.listUserPasskeys()
                if (refreshed.data) {
                    setPasskeys(refreshed.data)
                }
                setPasskeyName("")
                addNotification("Passkey added successfully", "success")
            }
        } catch (error) {
            console.error("Error adding passkey:", error)
            addNotification("Failed to add passkey", "error")
        } finally {
            setAddingPasskey(false)
        }
    }

    // Handle delete passkey
    const handleDeletePasskey = async (id: string) => {
        setDeletingPasskey(id)
        try {
            const result = await authClient.passkey.deletePasskey({ id })
            if (result.error) {
                addNotification("Failed to delete passkey", "error")
            } else {
                setPasskeys((prev) => prev.filter((p) => p.id !== id))
                addNotification("Passkey deleted successfully", "success")
            }
        } catch (error) {
            console.error("Error deleting passkey:", error)
            addNotification("Failed to delete passkey", "error")
        } finally {
            setDeletingPasskey(null)
        }
    }

    const handleLinkSocial = async (
        provider: "google" | "facebook" | "discord"
    ) => {
        setIsLinking(provider)
        try {
            const result = await authClient.linkSocial({
                provider: provider,
                callbackURL: "/profile/settings?tab=connected-accounts",
            })
            // Redirects happen automatically
            if (result.error) {
                addNotification(
                    result.error.message || "Failed to link account",
                    "error"
                )
            }
        } catch (err) {
            console.error("Link error:", err)
            addNotification("Failed to link account", "error")
        } finally {
            setIsLinking(null)
        }
    }

    // Get device icon from user agent
    const getDeviceIcon = (userAgent: string | null | undefined) => {
        if (!userAgent) return Monitor
        const ua = userAgent.toLowerCase()
        if (
            ua.includes("mobile") ||
            ua.includes("android") ||
            ua.includes("iphone")
        ) {
            return Smartphone
        }
        return Laptop
    }

    // Parse browser name from user agent
    const getBrowserName = (userAgent: string | null | undefined) => {
        if (!userAgent) return "Unknown Browser"
        const ua = userAgent
        if (ua.includes("Firefox")) return "Firefox"
        if (ua.includes("Edg")) return "Microsoft Edge"
        if (ua.includes("Chrome")) return "Chrome"
        if (ua.includes("Safari")) return "Safari"
        if (ua.includes("Opera") || ua.includes("OPR")) return "Opera"
        return "Browser"
    }

    // Get OS name from user agent
    const getOSName = (userAgent: string | null | undefined) => {
        if (!userAgent) return ""
        const ua = userAgent
        if (ua.includes("Windows")) return "Windows"
        if (ua.includes("Mac")) return "macOS"
        if (ua.includes("Linux")) return "Linux"
        if (ua.includes("Android")) return "Android"
        if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS"
        return ""
    }

    // Format date
    const formatDate = (date: Date | string | null) => {
        if (!date) return "Unknown"
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    // Format relative time
    const formatRelativeTime = (date: Date | string | null) => {
        if (!date) return "Unknown"
        const now = new Date()
        const then = new Date(date)
        const diffMs = now.getTime() - then.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return formatDate(date)
    }

    const tabs = [
        {
            id: "password" as TabType,
            label: "Password",
            icon: Key,
            description: "Change your password",
        },
        {
            id: "sessions" as TabType,
            label: "Sessions",
            icon: Shield,
            description: "Manage active logins",
        },
        {
            id: "passkeys" as TabType,
            label: "Passkeys",
            icon: Fingerprint,
            description: "Passwordless authentication",
        },
        {
            id: "connected-accounts" as TabType,
            label: "Connected Accounts",
            icon: Link2,
            description: "Manage social logins",
        },
    ]

    return (
        <main className='w-full min-h-screen px-4 py-8 [&_button]:cursor-pointer'>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className='max-w-6xl mx-auto'
            >
                {/* Header */}
                <div className='mb-8'>
                    <Link
                        href='/profile'
                        className='inline-flex items-center gap-2 text-text/60 hover:text-text transition-colors mb-4'
                    >
                        <ArrowLeft className='w-4 h-4' />
                        Back to Profile
                    </Link>
                    <h1 className='text-3xl font-bold font-serif'>
                        Account Settings
                    </h1>
                    <p className='text-text/60 mt-1'>
                        Manage your password, sessions, and security settings
                    </p>
                </div>

                {/* Layout: Sidebar + Content */}
                <div className='flex flex-col lg:flex-row gap-6'>
                    {/* Sidebar Navigation */}
                    <nav className='lg:w-64 shrink-0'>
                        <div className='lg:sticky lg:top-8 space-y-1'>
                            {tabs.map((tab) => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-left ${
                                            activeTab === tab.id
                                                ? "bg-primary text-white shadow-lg shadow-primary/25"
                                                : "text-text/70 hover:bg-text/5"
                                        }`}
                                    >
                                        <Icon className='w-5 h-5' />
                                        <div>
                                            <div>{tab.label}</div>
                                            <div
                                                className={`text-xs ${activeTab === tab.id ? "text-white/70" : "text-text/50"}`}
                                            >
                                                {tab.description}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </nav>

                    {/* Content Area */}
                    <div className='flex-1'>
                        <AnimatePresence mode='wait'>
                            {/* Password Tab */}
                            {activeTab === "password" && (
                                <motion.div
                                    key='password'
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className='bg-text/5 border border-text/10 rounded-xl p-6'
                                >
                                    <h2 className='text-xl font-semibold mb-4'>
                                        {hasPasswordSet
                                            ? "Change Password"
                                            : "Set Password"}
                                    </h2>
                                    <p className='text-text/60 mb-6'>
                                        {hasPasswordSet
                                            ? "Update your password to keep your account secure."
                                            : "Add a password to your account to sign in with email."}
                                    </p>

                                    <div className='space-y-4'>
                                        {/* Current Password - Only if password is set */}
                                        {hasPasswordSet && (
                                            <div>
                                                <label className='block text-sm font-medium mb-2'>
                                                    Current Password
                                                </label>
                                                <div className='relative'>
                                                    <input
                                                        type={
                                                            showCurrentPassword
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        value={currentPassword}
                                                        onChange={(e) =>
                                                            setCurrentPassword(
                                                                e.target.value
                                                            )
                                                        }
                                                        className='w-full px-4 py-3 bg-background border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 pr-12'
                                                        placeholder='Enter current password'
                                                    />
                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            setShowCurrentPassword(
                                                                !showCurrentPassword
                                                            )
                                                        }
                                                        className='absolute right-3 top-1/2 -translate-y-1/2 text-text/40 hover:text-text'
                                                    >
                                                        {showCurrentPassword ? (
                                                            <EyeOff className='w-5 h-5' />
                                                        ) : (
                                                            <Eye className='w-5 h-5' />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* New Password */}
                                        <div>
                                            <label className='block text-sm font-medium mb-2'>
                                                New Password
                                            </label>
                                            <div className='relative'>
                                                <input
                                                    type={
                                                        showNewPassword
                                                            ? "text"
                                                            : "password"
                                                    }
                                                    value={newPassword}
                                                    onChange={(e) =>
                                                        setNewPassword(
                                                            e.target.value
                                                        )
                                                    }
                                                    className='w-full px-4 py-3 bg-background border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 pr-12'
                                                    placeholder='Enter new password'
                                                />
                                                <button
                                                    type='button'
                                                    onClick={() =>
                                                        setShowNewPassword(
                                                            !showNewPassword
                                                        )
                                                    }
                                                    className='absolute right-3 top-1/2 -translate-y-1/2 text-text/40 hover:text-text'
                                                >
                                                    {showNewPassword ? (
                                                        <EyeOff className='w-5 h-5' />
                                                    ) : (
                                                        <Eye className='w-5 h-5' />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Confirm Password */}
                                        <div>
                                            <label className='block text-sm font-medium mb-2'>
                                                Confirm New Password
                                            </label>
                                            <input
                                                type='password'
                                                value={confirmPassword}
                                                onChange={(e) =>
                                                    setConfirmPassword(
                                                        e.target.value
                                                    )
                                                }
                                                className='w-full px-4 py-3 bg-background border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                                placeholder='Confirm new password'
                                            />
                                        </div>

                                        <button
                                            onClick={handleChangePassword}
                                            disabled={isChangingPassword}
                                            className='w-full mt-4 px-4 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                                        >
                                            {isChangingPassword ? (
                                                <>
                                                    <Loader2 className='w-4 h-4 animate-spin' />
                                                    {hasPasswordSet
                                                        ? "Changing Password..."
                                                        : "Setting Password..."}
                                                </>
                                            ) : (
                                                <>
                                                    <Key className='w-4 h-4' />
                                                    {hasPasswordSet
                                                        ? "Change Password"
                                                        : "Set Password"}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Sessions Tab */}
                            {activeTab === "sessions" && (
                                <motion.div
                                    key='sessions'
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className='bg-text/5 border border-text/10 rounded-xl p-6'
                                >
                                    <div className='flex items-center justify-between mb-4'>
                                        <div>
                                            <h2 className='text-xl font-semibold'>
                                                Active Sessions
                                            </h2>
                                            <p className='text-text/60 text-sm mt-1'>
                                                Manage devices where you're
                                                currently logged in
                                            </p>
                                        </div>
                                        {sessions.length > 1 && (
                                            <button
                                                onClick={
                                                    handleRevokeOtherSessions
                                                }
                                                className='text-red-500 hover:text-red-600 text-sm font-medium flex items-center gap-1'
                                            >
                                                <LogOut className='w-4 h-4' />
                                                Sign out all others
                                            </button>
                                        )}
                                    </div>

                                    {loadingSessions ? (
                                        <div className='flex items-center justify-center py-12'>
                                            <Loader2 className='w-6 h-6 animate-spin text-text/40' />
                                        </div>
                                    ) : sessions.length === 0 ? (
                                        <p className='text-text/60 text-center py-8'>
                                            No active sessions
                                        </p>
                                    ) : (
                                        <div className='space-y-3'>
                                            {sessions.map((session) => {
                                                const DeviceIcon =
                                                    getDeviceIcon(
                                                        session.userAgent
                                                    )
                                                const isCurrentSession =
                                                    session.createdAt &&
                                                    new Date(
                                                        session.createdAt
                                                    ).getTime() ===
                                                        Math.max(
                                                            ...sessions.map(
                                                                (s) =>
                                                                    s.createdAt
                                                                        ? new Date(
                                                                              s.createdAt
                                                                          ).getTime()
                                                                        : 0
                                                            )
                                                        )

                                                return (
                                                    <div
                                                        key={session.id}
                                                        className={`flex items-center gap-4 p-4 bg-background border rounded-xl transition-all ${
                                                            isCurrentSession
                                                                ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                                                                : "border-text/10 hover:border-text/20"
                                                        }`}
                                                    >
                                                        <div
                                                            className={`p-3 rounded-xl ${isCurrentSession ? "bg-primary/10" : "bg-text/5"}`}
                                                        >
                                                            <DeviceIcon
                                                                className={`w-5 h-5 ${isCurrentSession ? "text-primary" : "text-text/60"}`}
                                                            />
                                                        </div>
                                                        <div className='flex-1 min-w-0'>
                                                            <div className='flex items-center gap-2 mb-0.5'>
                                                                <span className='font-semibold'>
                                                                    {getBrowserName(
                                                                        session.userAgent
                                                                    )}
                                                                </span>
                                                                {getOSName(
                                                                    session.userAgent
                                                                ) && (
                                                                    <span className='text-text/50 text-sm'>
                                                                        on{" "}
                                                                        {getOSName(
                                                                            session.userAgent
                                                                        )}
                                                                    </span>
                                                                )}
                                                                {isCurrentSession && (
                                                                    <span className='text-xs bg-primary text-white px-2 py-0.5 rounded-full font-medium'>
                                                                        This
                                                                        device
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className='flex items-center gap-2 text-sm text-text/50'>
                                                                <span>
                                                                    {session.ipAddress ||
                                                                        "Unknown IP"}
                                                                </span>
                                                                <span>•</span>
                                                                <span>
                                                                    {formatRelativeTime(
                                                                        session.createdAt
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {!isCurrentSession && (
                                                            <button
                                                                onClick={() =>
                                                                    handleRevokeSession(
                                                                        session.token
                                                                    )
                                                                }
                                                                disabled={
                                                                    revokingSession ===
                                                                    session.token
                                                                }
                                                                className='p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50'
                                                                title='Revoke session'
                                                            >
                                                                {revokingSession ===
                                                                session.token ? (
                                                                    <Loader2 className='w-4 h-4 animate-spin' />
                                                                ) : (
                                                                    <LogOut className='w-4 h-4' />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Passkeys Tab */}
                            {activeTab === "passkeys" && (
                                <motion.div
                                    key='passkeys'
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className='bg-text/5 border border-text/10 rounded-xl p-6'
                                >
                                    <h2 className='text-xl font-semibold mb-2'>
                                        Passkeys
                                    </h2>
                                    <p className='text-text/60 mb-6'>
                                        Passkeys are a secure way to sign in
                                        without a password. Use your
                                        fingerprint, face, or device PIN.
                                    </p>

                                    {/* Add Passkey Form */}
                                    <div className='mb-6 p-4 bg-background border border-text/10 rounded-lg'>
                                        <h3 className='font-medium mb-3'>
                                            Add a new passkey
                                        </h3>
                                        <div className='flex gap-3'>
                                            <input
                                                type='text'
                                                value={passkeyName}
                                                onChange={(e) =>
                                                    setPasskeyName(
                                                        e.target.value
                                                    )
                                                }
                                                className='flex-1 px-4 py-2 bg-text/5 border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                                placeholder='Passkey name (e.g. MacBook Pro)'
                                            />
                                            <button
                                                onClick={handleAddPasskey}
                                                disabled={addingPasskey}
                                                className='px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2'
                                            >
                                                {addingPasskey ? (
                                                    <Loader2 className='w-4 h-4 animate-spin' />
                                                ) : (
                                                    <Plus className='w-4 h-4' />
                                                )}
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Passkeys List */}
                                    {loadingPasskeys ? (
                                        <div className='flex items-center justify-center py-12'>
                                            <Loader2 className='w-6 h-6 animate-spin text-text/40' />
                                        </div>
                                    ) : passkeys.length === 0 ? (
                                        <div className='text-center py-8'>
                                            <Fingerprint className='w-12 h-12 text-text/20 mx-auto mb-3' />
                                            <p className='text-text/60'>
                                                No passkeys registered yet
                                            </p>
                                            <p className='text-sm text-text/40 mt-1'>
                                                Add a passkey to sign in
                                                securely without a password
                                            </p>
                                        </div>
                                    ) : (
                                        <div className='space-y-3'>
                                            {passkeys.map((passkey) => (
                                                <div
                                                    key={passkey.id}
                                                    className='flex items-center gap-4 p-4 bg-background border border-text/10 rounded-lg'
                                                >
                                                    <div className='p-2 bg-primary/10 rounded-lg'>
                                                        <Fingerprint className='w-5 h-5 text-primary' />
                                                    </div>
                                                    <div className='flex-1 min-w-0'>
                                                        <p className='font-medium'>
                                                            {passkey.name ||
                                                                "Unnamed Passkey"}
                                                        </p>
                                                        <p className='text-sm text-text/60'>
                                                            {passkey.deviceType ===
                                                            "platform"
                                                                ? "Built-in authenticator"
                                                                : "Security key"}{" "}
                                                            • Added{" "}
                                                            {formatDate(
                                                                passkey.createdAt
                                                            )}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            handleDeletePasskey(
                                                                passkey.id
                                                            )
                                                        }
                                                        disabled={
                                                            deletingPasskey ===
                                                            passkey.id
                                                        }
                                                        className='p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50'
                                                        title='Delete passkey'
                                                    >
                                                        {deletingPasskey ===
                                                        passkey.id ? (
                                                            <Loader2 className='w-4 h-4 animate-spin' />
                                                        ) : (
                                                            <Trash2 className='w-4 h-4' />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Connected Accounts Tab */}
                            {activeTab === "connected-accounts" && (
                                <motion.div
                                    key='connected-accounts'
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className='bg-text/5 border border-text/10 rounded-xl p-6'
                                >
                                    <h2 className='text-xl font-semibold mb-2'>
                                        Connected Accounts
                                    </h2>
                                    <p className='text-text/60 mb-6'>
                                        Link your social accounts to sign in
                                        easily.
                                    </p>

                                    {loadingLinkedAccounts ? (
                                        <div className='flex items-center justify-center py-12'>
                                            <Loader2 className='w-6 h-6 animate-spin text-text/40' />
                                        </div>
                                    ) : (
                                        <div className='space-y-4'>
                                            {/* Google */}
                                            <div className='flex items-center justify-between p-4 bg-background border border-text/10 rounded-xl'>
                                                <div className='flex items-center gap-3'>
                                                    <div className='w-10 h-10 flex items-center justify-center bg-white rounded-full p-2 border border-text/10'>
                                                        <svg
                                                            viewBox='0 0 24 24'
                                                            className='w-full h-full'
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
                                                    </div>
                                                    <div>
                                                        <h3 className='font-medium'>
                                                            Google
                                                        </h3>
                                                        {linkedAccounts.find(
                                                            (a) =>
                                                                a.provider ===
                                                                "google"
                                                        ) ? (
                                                            <p className='text-sm text-green-600 flex items-center gap-1'>
                                                                <Check className='w-3 h-3' />{" "}
                                                                Connected
                                                            </p>
                                                        ) : (
                                                            <p className='text-sm text-text/50'>
                                                                Not connected
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {linkedAccounts.find(
                                                    (a) =>
                                                        a.provider === "google"
                                                ) ? (
                                                    <button
                                                        disabled
                                                        className='text-sm text-text/40 font-medium px-4 py-2 bg-text/5 rounded-lg border border-text/5 cursor-default'
                                                    >
                                                        Connected
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            handleLinkSocial(
                                                                "google"
                                                            )
                                                        }
                                                        disabled={!!isLinking}
                                                        className='text-sm text-text hover:text-primary font-medium px-4 py-2 border border-text/20 hover:border-primary rounded-lg transition-colors flex items-center gap-2'
                                                    >
                                                        {isLinking ===
                                                            "google" && (
                                                            <Loader2 className='w-3 h-3 animate-spin' />
                                                        )}
                                                        Connect
                                                    </button>
                                                )}
                                            </div>

                                            {/* Facebook */}
                                            <div className='flex items-center justify-between p-4 bg-background border border-text/10 rounded-xl'>
                                                <div className='flex items-center gap-3'>
                                                    <div className='w-10 h-10 flex items-center justify-center bg-[#1877F2] text-white rounded-full p-2'>
                                                        <svg
                                                            viewBox='0 0 24 24'
                                                            className='w-full h-full fill-current'
                                                            xmlns='http://www.w3.org/2000/svg'
                                                        >
                                                            <path d='M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.771-5.818 5.766-5.818 2.022 0 3.19.17 3.19.17l-.014 3.61h-2.11c-1.361 0-1.781.962-1.781 2.068v1.561h3.984l-.136 3.681h-3.848v7.953h-5.05z' />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 className='font-medium'>
                                                            Facebook
                                                        </h3>
                                                        {linkedAccounts.find(
                                                            (a) =>
                                                                a.provider ===
                                                                "facebook"
                                                        ) ? (
                                                            <p className='text-sm text-green-600 flex items-center gap-1'>
                                                                <Check className='w-3 h-3' />{" "}
                                                                Connected
                                                            </p>
                                                        ) : (
                                                            <p className='text-sm text-text/50'>
                                                                Not connected
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {linkedAccounts.find(
                                                    (a) =>
                                                        a.provider ===
                                                        "facebook"
                                                ) ? (
                                                    <button
                                                        disabled
                                                        className='text-sm text-text/40 font-medium px-4 py-2 bg-text/5 rounded-lg border border-text/5 cursor-default'
                                                    >
                                                        Connected
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            handleLinkSocial(
                                                                "facebook"
                                                            )
                                                        }
                                                        disabled={!!isLinking}
                                                        className='text-sm text-text hover:text-primary font-medium px-4 py-2 border border-text/20 hover:border-primary rounded-lg transition-colors flex items-center gap-2'
                                                    >
                                                        {isLinking ===
                                                            "facebook" && (
                                                            <Loader2 className='w-3 h-3 animate-spin' />
                                                        )}
                                                        Connect
                                                    </button>
                                                )}
                                            </div>

                                            {/* Discord */}
                                            <div className='flex items-center justify-between p-4 bg-background border border-text/10 rounded-xl'>
                                                <div className='flex items-center gap-3'>
                                                    <div className='w-10 h-10 flex items-center justify-center bg-[#5865F2] text-white rounded-full p-2'>
                                                        <svg
                                                            viewBox='0 0 24 24'
                                                            className='w-full h-full fill-current'
                                                            xmlns='http://www.w3.org/2000/svg'
                                                        >
                                                            <path d='M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z' />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 className='font-medium'>
                                                            Discord
                                                        </h3>
                                                        {linkedAccounts.find(
                                                            (a) =>
                                                                a.provider ===
                                                                "discord"
                                                        ) ? (
                                                            <p className='text-sm text-green-600 flex items-center gap-1'>
                                                                <Check className='w-3 h-3' />{" "}
                                                                Connected
                                                            </p>
                                                        ) : (
                                                            <p className='text-sm text-text/50'>
                                                                Not connected
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {linkedAccounts.find(
                                                    (a) =>
                                                        a.provider === "discord"
                                                ) ? (
                                                    <button
                                                        disabled
                                                        className='text-sm text-text/40 font-medium px-4 py-2 bg-text/5 rounded-lg border border-text/5 cursor-default'
                                                    >
                                                        Connected
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            handleLinkSocial(
                                                                "discord"
                                                            )
                                                        }
                                                        disabled={!!isLinking}
                                                        className='text-sm text-text hover:text-primary font-medium px-4 py-2 border border-text/20 hover:border-primary rounded-lg transition-colors flex items-center gap-2'
                                                    >
                                                        {isLinking ===
                                                            "discord" && (
                                                            <Loader2 className='w-3 h-3 animate-spin' />
                                                        )}
                                                        Connect
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </main>
    )
}
