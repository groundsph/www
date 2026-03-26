"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { profiles } from "@/db/schema"
import { eq } from "drizzle-orm"

const MAX_API_KEYS_PER_USER = 3

export interface ApiKeyInfo {
    id: string
    name: string | null
    prefix: string
    start: string | null
    createdAt: Date
    expiresAt: Date | null
}

interface ApiKeyActionResult {
    success: boolean
    error?: string
    data?: {
        key?: string
        keys?: ApiKeyInfo[]
    }
}

async function isAdminOrModerator(): Promise<boolean> {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    if (!session?.user) return false

    const result = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, session.user.id))
        .limit(1)

    const role = result[0]?.role
    return role === "admin" || role === "moderator"
}

export async function listApiKeys(): Promise<ApiKeyActionResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    try {
        const result = await auth.api.listApiKeys({
            headers: await headers(),
        })

        const keyList = Array.isArray(result) ? result : (result as { apiKeys: unknown[] }).apiKeys || []

        return {
            success: true,
            data: {
                keys: keyList.map((k) => {
                    const key = k as {
                        id: string
                        name: string | null
                        start: string | null
                        prefix: string | null
                        createdAt: Date
                        expiresAt: Date | null
                    }
                    return {
                        id: key.id,
                        name: key.name,
                        prefix: key.prefix ?? "",
                        start: key.start ?? null,
                        createdAt: key.createdAt,
                        expiresAt: key.expiresAt,
                    }
                }),
            },
        }
    } catch (error) {
        console.error("Error listing API keys:", error)
        return { success: false, error: "Failed to list API keys" }
    }
}

export async function createApiKey(
    name?: string,
    expiresAt?: Date
): Promise<ApiKeyActionResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    try {
        const existingKeys = await auth.api.listApiKeys({
            headers: await headers(),
        })

        if (existingKeys.length >= MAX_API_KEYS_PER_USER) {
            return {
                success: false,
                error: `Maximum of ${MAX_API_KEYS_PER_USER} API keys allowed`,
            }
        }

        const result = await auth.api.createApiKey({
            headers: await headers(),
            body: {
                name: name || undefined,
                expiresIn: expiresAt
                    ? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
                    : undefined,
            },
        })

        return {
            success: true,
            data: {
                key: result.key,
            },
        }
    } catch (error) {
        console.error("Error creating API key:", error)
        return { success: false, error: "Failed to create API key" }
    }
}

export async function deleteApiKey(keyId: string): Promise<ApiKeyActionResult> {
    if (!(await isAdminOrModerator())) {
        return { success: false, error: "Not authorized" }
    }

    try {
        await auth.api.deleteApiKey({
            headers: await headers(),
            body: {
                keyId,
            },
        })

        return { success: true }
    } catch (error) {
        console.error("Error deleting API key:", error)
        return { success: false, error: "Failed to delete API key" }
    }
}
