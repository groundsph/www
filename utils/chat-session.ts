"use server"

import { cookies } from "next/headers"

const CHAT_SESSION_COOKIE = "chat_session_id"
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

/**
 * Gets or creates a chat session ID for the current request.
 * 
 * For authenticated users, this should use their Better Auth session ID.
 * For anonymous users, generates a random UUID and stores it in an httpOnly cookie.
 * 
 * @param existingSessionId - Optional existing session ID (from cookie or auth)
 * @returns Promise resolving to the session ID string
 */
export async function getOrCreateChatSessionId(
	existingSessionId: string | null
): Promise<string> {
	// If an existing session ID is provided, return it
	if (existingSessionId) {
		return existingSessionId
	}

	// Generate a new session ID using crypto.randomUUID()
	const newSessionId = crypto.randomUUID()

	// Set the cookie for anonymous users
	const cookieStore = await cookies()
	cookieStore.set(CHAT_SESSION_COOKIE, newSessionId, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		maxAge: SESSION_MAX_AGE,
		path: "/",
	})

	return newSessionId
}

/**
 * Gets the current chat session ID from cookies without creating a new one.
 * 
 * @returns Promise resolving to the session ID string or null if not found
 */
export async function getChatSessionId(): Promise<string | null> {
	const cookieStore = await cookies()
	return cookieStore.get(CHAT_SESSION_COOKIE)?.value ?? null
}

/**
 * Clears the chat session cookie.
 * Useful when a user logs out or when the session should be reset.
 */
export async function clearChatSessionId(): Promise<void> {
	const cookieStore = await cookies()
	cookieStore.delete(CHAT_SESSION_COOKIE)
}
