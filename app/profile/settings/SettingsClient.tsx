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
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

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

type TabType = "password" | "sessions" | "passkeys"

export default function SettingsClient({ user }: { user: User }) {
    const { addNotification } = useNotification()
    const [activeTab, setActiveTab] = useState<TabType>("password")

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

    // Handle password change
    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            addNotification("Please fill in all password fields", "error")
            return
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
                                        Change Password
                                    </h2>
                                    <p className='text-text/60 mb-6'>
                                        Update your password to keep your
                                        account secure.
                                    </p>

                                    <div className='space-y-4'>
                                        {/* Current Password */}
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
                                                    Changing Password...
                                                </>
                                            ) : (
                                                <>
                                                    <Key className='w-4 h-4' />
                                                    Change Password
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
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </main>
    )
}
