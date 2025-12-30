/**
 * User Migration Script - Supabase to Better Auth
 * 
 * This script is IDEMPOTENT - safe to run multiple times.
 * Uses upsert pattern to update existing records or insert new ones.
 * 
 * Run with: bun run scripts/migrate-users.ts
 */

import { createClient } from "@supabase/supabase-js"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { sql } from "drizzle-orm"
import * as dotenv from "dotenv"

// Load environment variables
dotenv.config({ path: ".env.local" })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const DATABASE_URL = process.env.DATABASE_URL!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !DATABASE_URL) {
    console.error("Missing required environment variables")
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
})

const neonSql = neon(DATABASE_URL)
const db = drizzle(neonSql)

interface MigrationStats {
    total: number
    inserted: number
    updated: number
    errors: number
}

async function migrateUsers(): Promise<MigrationStats> {
    console.log("🚀 Starting user migration from Supabase to Neon...")

    const stats: MigrationStats = {
        total: 0,
        inserted: 0,
        updated: 0,
        errors: 0
    }

    let page = 1
    const perPage = 1000

    while (true) {
        console.log(`📥 Fetching page ${page}...`)

        const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage
        })

        if (error) {
            console.error("Error fetching users:", error)
            throw error
        }

        const { users } = data

        if (users.length === 0) {
            console.log("✅ No more users to migrate")
            break
        }

        console.log(`📝 Processing ${users.length} users...`)

        for (const user of users) {
            stats.total++

            try {
                // Better Auth stores users in the 'user' table
                // We use raw SQL for upsert since the schema may not match exactly yet
                await db.execute(sql`
                    INSERT INTO "user" (id, email, "emailVerified", "createdAt", "updatedAt")
                    VALUES (
                        ${user.id},
                        ${user.email},
                        ${user.email_confirmed_at ? true : false},
                        ${user.created_at},
                        ${new Date().toISOString()}
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        email = ${user.email},
                        "emailVerified" = ${user.email_confirmed_at ? true : false},
                        "updatedAt" = ${new Date().toISOString()}
                `)

                // Check if this was an insert or update
                // For simplicity, we just count operations
                stats.inserted++

            } catch (err) {
                console.error(`❌ Error migrating user ${user.id}:`, err)
                stats.errors++
            }
        }

        console.log(`✅ Page ${page} complete`)
        page++
    }

    return stats
}

async function main() {
    console.log("=".repeat(50))
    console.log("User Migration: Supabase → Neon + Better Auth")
    console.log("=".repeat(50))
    console.log("")

    try {
        const stats = await migrateUsers()

        console.log("")
        console.log("=".repeat(50))
        console.log("📊 Migration Summary")
        console.log("=".repeat(50))
        console.log(`Total users processed: ${stats.total}`)
        console.log(`Successfully migrated: ${stats.inserted}`)
        console.log(`Errors: ${stats.errors}`)
        console.log("")

        if (stats.errors > 0) {
            console.log("⚠️  Some users failed to migrate. Check the logs above.")
            process.exit(1)
        }

        console.log("🎉 Migration complete!")

    } catch (err) {
        console.error("❌ Migration failed:", err)
        process.exit(1)
    }
}

main()
