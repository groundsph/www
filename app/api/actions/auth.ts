"use server"

import { db } from "@/db"
import { account } from "@/db/schema"
import { auth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"

export type LinkedAccount = {
    provider: string
    createdAt: Date
}

/**
 * Get all accounts linked to the verified user
 */
export async function getLinkedAccounts(): Promise<LinkedAccount[]> {
    const session = await auth.api.getSession({
        headers: await headers(),
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
    const session = await auth.api.getSession({
        headers: await headers(),
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
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session?.user) {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await auth.api.setPassword({
            body: {
                newPassword: password,
            },
            headers: await headers()
        })

        return { success: true }
    } catch (error) {
        console.error("Error setting password:", error)
        return { success: false, error: "Failed to set password" }
    }
}
