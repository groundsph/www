"use server"

import { db } from "@/db"
import { notifications } from "@/db/schema"
import { eq, desc, count, and } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"

export interface Notification {
    id: string
    type: string
    title: string
    message: string
    data: Record<string, unknown> | null
    read: boolean
    createdAt: Date
}

export interface NotificationActionResult {
    success: boolean
    error?: string
}

export interface CreateNotificationInput {
    userId: string
    type: string
    title: string
    message: string
    data?: Record<string, unknown>
}

/**
 * Creates a new notification for a user.
 * Can only be called by server-side code (not directly by clients).
 */
export async function createNotification(
    input: CreateNotificationInput
): Promise<NotificationActionResult> {
    try {
        await db.insert(notifications).values({
            userId: input.userId,
            type: input.type,
            title: input.title,
            message: input.message,
            data: input.data ?? null,
            read: false,
        })

        return { success: true }
    } catch (error) {
        console.error("Error creating notification:", error)
        return { success: false, error: "Failed to create notification" }
    }
}

/**
 * Gets notifications for the current user.
 * Returns empty array if not authenticated.
 */
export async function getUserNotifications(
    userId: string,
    limit: number = 50
): Promise<{ notifications: Notification[]; error?: string }> {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.id !== userId) {
        return { notifications: [], error: "Not authorized" }
    }

    try {
        const result = await db
            .select({
                id: notifications.id,
                type: notifications.type,
                title: notifications.title,
                message: notifications.message,
                data: notifications.data,
                read: notifications.read,
                createdAt: notifications.createdAt,
            })
            .from(notifications)
            .where(eq(notifications.userId, userId))
            .orderBy(desc(notifications.createdAt))
            .limit(limit)

        return {
            notifications: result.map((n) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                data: n.data as Record<string, unknown> | null,
                read: n.read ?? false,
                createdAt: n.createdAt ?? new Date(),
            })),
        }
    } catch (error) {
        console.error("Error fetching notifications:", error)
        return { notifications: [], error: "Failed to fetch notifications" }
    }
}

/**
 * Marks a single notification as read.
 * Users can only mark their own notifications as read.
 */
export async function markNotificationRead(
    notificationId: string
): Promise<NotificationActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "Not authenticated" }
    }

    try {
        // Verify the notification belongs to the current user
        const notification = await db
            .select({ userId: notifications.userId })
            .from(notifications)
            .where(eq(notifications.id, notificationId))
            .limit(1)

        if (!notification[0]) {
            return { success: false, error: "Notification not found" }
        }

        if (notification[0].userId !== currentUser.id) {
            return { success: false, error: "Not authorized" }
        }

        await db
            .update(notifications)
            .set({ read: true })
            .where(eq(notifications.id, notificationId))

        return { success: true }
    } catch (error) {
        console.error("Error marking notification as read:", error)
        return { success: false, error: "Failed to mark notification as read" }
    }
}

/**
 * Marks all notifications as read for the current user.
 */
export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { success: false, error: "Not authenticated" }
    }

    try {
        await db
            .update(notifications)
            .set({ read: true })
            .where(
                and(
                    eq(notifications.userId, currentUser.id),
                    eq(notifications.read, false)
                )
            )

        return { success: true }
    } catch (error) {
        console.error("Error marking all notifications as read:", error)
        return { success: false, error: "Failed to mark all notifications as read" }
    }
}

/**
 * Gets the count of unread notifications for the current user.
 */
export async function getUnreadCount(): Promise<{ count: number; error?: string }> {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { count: 0 }
    }

    try {
        const result = await db
            .select({ count: count() })
            .from(notifications)
            .where(
                and(
                    eq(notifications.userId, currentUser.id),
                    eq(notifications.read, false)
                )
            )

        return { count: result[0]?.count ?? 0 }
    } catch (error) {
        console.error("Error fetching unread count:", error)
        return { count: 0, error: "Failed to fetch unread count" }
    }
}
