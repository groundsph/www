import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db"
import { headers } from "next/headers"
import { admin } from "better-auth/plugins"
import { passkey } from "@better-auth/passkey"
import bcrypt from "bcrypt"

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    advanced: {
        database: {
            generateId: false
        }
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        minPasswordLength: 12,
        password: {
            hash: async (password) => {
                return await bcrypt.hash(password, 10);
            },
            verify: async ({ hash, password }) => {
                return await bcrypt.compare(password, hash);
            }
        }
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        },
        // facebook: {
        //     clientId: process.env.FACEBOOK_CLIENT_ID || "",
        //     clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
        // },
        discord: {
            clientId: process.env.DISCORD_CLIENT_ID || "",
            clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
        },
    },
    plugins: [
        admin({
            adminUserIds: process.env.ADMIN_USER_IDS?.split(",") || [],
        }),
        passkey()
    ],
    user: {
        additionalFields: {
            userMetadata: { type: 'json', required: false, input: false },
            appMetadata: { type: 'json', required: false, input: false },
            invitedAt: { type: 'date', required: false, input: false },
            lastSignInAt: { type: 'date', required: false, input: false },
        },
    },
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", /* "facebook", */ "discord"],
            allowDifferentEmails: true,
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
        max: 100, // 100 requests per minute (was 10, too aggressive)
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
