import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db"
import { headers } from "next/headers"
import { admin, anonymous, phoneNumber } from "better-auth/plugins"
import bcrypt from "bcrypt"

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, // Match current Supabase behavior
        minPasswordLength: 6, // Supabase default
        password: {
            hash: async (password) => {
                return await bcrypt.hash(password, 10);
            },
            verify: async ({ hash, password }) => {
                return await bcrypt.compare(password, hash);
            }
        }
    },
    plugins: [admin(), anonymous(), phoneNumber()],
    user: {
        additionalFields: {
            userMetadata: { type: 'json', required: false, input: false },
            appMetadata: { type: 'json', required: false, input: false },
            invitedAt: { type: 'date', required: false, input: false },
            lastSignInAt: { type: 'date', required: false, input: false },
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes
        },
    },
    rateLimit: {
        enabled: true,
        window: 60, // 1 minute
        max: 10, // 10 requests per minute
    },
    trustedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000",
    ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user

/**
 * Get the currently authenticated user from the Better Auth session.
 * Use this in server actions and API routes instead of db.auth.getUser()
 */
export async function getCurrentUser(): Promise<User | null> {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    return session?.user ?? null
}
