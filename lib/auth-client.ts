"use client"

import { createAuthClient } from "better-auth/react"
import { passkeyClient } from "@better-auth/passkey/client"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000",
    plugins: [passkeyClient(), adminClient()],
})

// Export common auth methods
export const { signIn, signUp, signOut, useSession } = authClient
