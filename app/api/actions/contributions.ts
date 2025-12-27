'use server'

import { createClient } from "@/utils/supabase/server"
import { Database } from "@/utils/types/database.types"

type ContributionLog = Database['public']['Tables']['contribution_logs']['Row']

export interface ContributionLogWithAuthor extends ContributionLog {
    author: {
        id: string
        username: string
        display_name: string
        avatar_url: string | null
    }
}

export interface ContributionLogWithCafe extends ContributionLog {
    cafe: {
        id: string
        name: string
        slug: string
        thumbnail: string
    }
}

/**
 * Get contribution logs for a specific cafe
 * Public endpoint - anyone can view
 */
export async function getCafeContributions(
    cafeId: string,
    limit: number = 20
): Promise<ContributionLogWithAuthor[]> {
    const db = await createClient()

    const { data, error } = await db
        .from('contribution_logs')
        .select(`
            *,
            author:profiles!contribution_logs_user_id_fkey(
                id, username, display_name, avatar_url
            )
        `)
        .eq('cafe_id', cafeId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('[getCafeContributions] Error:', error)
        return []
    }

    return data as unknown as ContributionLogWithAuthor[]
}

/**
 * Get contribution logs for a specific user
 * Public endpoint - anyone can view
 */
export async function getUserContributions(
    userId: string,
    limit: number = 50
): Promise<ContributionLogWithCafe[]> {
    const db = await createClient()

    const { data, error } = await db
        .from('contribution_logs')
        .select(`
            *,
            cafe:cafes!contribution_logs_cafe_id_fkey(
                id, name, slug, thumbnail
            )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('[getUserContributions] Error:', error)
        return []
    }

    return data as unknown as ContributionLogWithCafe[]
}
