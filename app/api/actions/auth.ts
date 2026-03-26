"use server"

import { db } from "@/db"
import { account, passkey } from "@/db/schema"
import { auth } from "@/lib/auth"
import { eq, count } from "drizzle-orm"
import { headers } from "next/headers"

export type LinkedAccount = {
    provider: string
    createdAt: Date
}

export type AuthMethod = "passkey" | "totp" | "password" | "oauth"

export interface UserAuthMethods {
    hasPasskey: boolean
    hasTOTP: boolean
    hasPassword: boolean
    hasOAuth: boolean
    methods: AuthMethod[]
}

/**
 * Get all accounts linked to the verified user
 */
export async function getLinkedAccounts(): Promise<LinkedAccount[]> {
    const hdrs = await headers()
    const session = await auth.api.getSession({
        headers: hdrs,
    })

    if (!session?.user) {
        return []
    }

    const accounts = await db
        .select({
            providerId: account.providerId,
            createdAt: account.createdAt,
        })
        .from(account)
        .where(eq(account.userId, session.user.id))

    return accounts.map((acc) => ({
        provider: acc.providerId,
        createdAt: acc.createdAt,
    }))
}

/**
 * Check if the user has a password set (credential account)
 */
export async function hasPassword(): Promise<boolean> {
    const hdrs = await headers()
    const session = await auth.api.getSession({
        headers: hdrs,
    })

    if (!session?.user) {
        return false
    }

    const accounts = await db
        .select({
            providerId: account.providerId,
        })
        .from(account)
        .where(eq(account.userId, session.user.id))

    return accounts.some((acc) => acc.providerId === "credential")
}

/**
 * Set a password for the user.
 * This should only be used if the user doesn't have a password set yet (e.g. social login only).
 * If they have a password, they should use the changePassword flow which requires current password.
 */
export async function setPassword(password: string): Promise<{ success: boolean; error?: string }> {
    const hdrs = await headers()
    const session = await auth.api.getSession({
        headers: hdrs,
    })

    if (!session?.user) {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await auth.api.setPassword({
            body: {
                newPassword: password,
            },
            headers: hdrs
        })

        return { success: true }
    } catch (error) {
        console.error("Error setting password:", error)
        return { success: false, error: "Failed to set password" }
    }
}

/**
 * Check if the user has any passkeys configured
 */
export async function userHasPasskey(): Promise<boolean> {
    const hdrs = await headers()
    const session = await auth.api.getSession({
        headers: hdrs,
    })

    if (!session?.user) {
        return false
    }

    const result = await db
        .select({ count: count() })
        .from(passkey)
        .where(eq(passkey.userId, session.user.id))

    return result[0]?.count > 0
}

/**
 * Check if the user has TOTP (2FA) enabled
 * Note: Requires @better-auth/totp plugin
 */
export async function userHasTOTP(): Promise<boolean> {
    const hdrs = await headers()
    const session = await auth.api.getSession({
        headers: hdrs,
    })

    if (!session?.user) {
        return false
    }

    try {
        const user = session.user as unknown as {
            twoFactorEnabled?: boolean
        }
        return user.twoFactorEnabled === true
    } catch {
        return false
    }
}

/**
 * Get all authentication methods available to the user
 */
export async function getUserAuthMethods(): Promise<UserAuthMethods> {
    const hdrs = await headers()
    const session = await auth.api.getSession({
        headers: hdrs,
    })

    if (!session?.user) {
        return {
            hasPasskey: false,
            hasTOTP: false,
            hasPassword: false,
            hasOAuth: false,
            methods: [],
        }
    }

    const [passkeyResult, accounts] = await Promise.all([
        db
            .select({ count: count() })
            .from(passkey)
            .where(eq(passkey.userId, session.user.id)),
        db
            .select({
                providerId: account.providerId,
            })
            .from(account)
            .where(eq(account.userId, session.user.id)),
    ])

    const hasPasskey = passkeyResult[0]?.count > 0
    const hasPassword = accounts.some((acc) => acc.providerId === "credential")
    const hasOAuth = accounts.some((acc) =>
        ["google", "discord", "facebook"].includes(acc.providerId)
    )

    let hasTOTP = false
    try {
        const user = session.user as unknown as {
            twoFactorEnabled?: boolean
        }
        hasTOTP = user.twoFactorEnabled === true
    } catch {
        hasTOTP = false
    }

    const methods: AuthMethod[] = []
    if (hasPasskey) methods.push("passkey")
    if (hasTOTP) methods.push("totp")
    if (hasPassword) methods.push("password")
    if (hasOAuth) methods.push("oauth")

    return {
        hasPasskey,
        hasTOTP,
        hasPassword,
        hasOAuth,
        methods,
    }
}

/**
 * Verify user's password for sensitive action confirmation
 */
export async function verifyUserPassword(
    password: string
): Promise<{ success: boolean; error?: string }> {
    const hdrs = await headers()
    const session = await auth.api.getSession({
        headers: hdrs,
    })

    if (!session?.user) {
        return { success: false, error: "Unauthorized" }
    }

    try {
        const result = await auth.api.signInEmail({
            body: {
                email: session.user.email,
                password,
            },
            headers: hdrs,
        })

        if (!result || "error" in result) {
            return { success: false, error: "Invalid password" }
        }

        return { success: true }
    } catch (error) {
        console.error("Password verification error:", error)
        return { success: false, error: "Password verification failed" }
    }
}

/**
 * Verify TOTP code for sensitive action confirmation
 * Note: Requires @better-auth/totp plugin
 */
export async function verifyUserTOTP(
    code: string
): Promise<{ success: boolean; error?: string }> {
    // TOTP verification stub - requires @better-auth/totp plugin
    void code
    const hdrs = await headers()
    const session = await auth.api.getSession({
        headers: hdrs,
    })

    if (!session?.user) {
        return { success: false, error: "Unauthorized" }
    }

    const hasTOTP = await userHasTOTP()
    if (!hasTOTP) {
        return { success: false, error: "TOTP not configured" }
    }

    try {
        // TOTP verification requires @better-auth/totp plugin
        // This is a placeholder for when the plugin is installed
        console.warn("TOTP verification attempted but @better-auth/totp plugin is not installed")
        return { success: false, error: "TOTP verification not available" }
    } catch (error) {
        console.error("TOTP verification error:", error)
        return { success: false, error: "Invalid TOTP code" }
    }
}
