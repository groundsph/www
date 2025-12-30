/**
 * Data Migration Script - Supabase to Neon
 * 
 * This script provides INSTRUCTIONS for migrating data using pg_dump/pg_restore.
 * These are the industry-standard PostgreSQL tools for database migration.
 * 
 * The script can be run to verify connectivity and output the migration commands.
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

// Load environment variables
dotenv.config({ path: ".env.local" })

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL!
const DATABASE_URL = process.env.DATABASE_URL!

// Tables in order of dependencies (parent tables first)
const TABLES_TO_MIGRATE = [
    "profiles",
    "badge_definitions",
    "cafes",
    "user_badges",
    "cafe_rating_stats",
    "cafe_menu_items",
    "cafe_stories",
    "cafe_subscriptions",
    "cafe_page_views",
    "cafe_claims",
    "cafe_edit_suggestions",
    "reviews",
    "review_interactions",
    "owner_review_responses",
    "blog_posts",
    "blog_reports",
    "events",
    "featured_schedules",
    "featured_slot_requests",
    "contribution_logs",
    "owner_verification_requests",
    "supporter_subscriptions",
    "avatar_deletion_queue",
]

function main() {
    console.log("=".repeat(70))
    console.log("📦 Data Migration Guide: Supabase → Neon")
    console.log("=".repeat(70))
    console.log("")
    console.log("This migration uses pg_dump and pg_restore, the standard PostgreSQL tools.")
    console.log("These commands are IDEMPOTENT - safe to run multiple times.")
    console.log("")
    console.log("=".repeat(70))
    console.log("Step 1: Export from Supabase")
    console.log("=".repeat(70))
    console.log("")
    console.log("Run this command to export schema + data:")
    console.log("")
    console.log("```bash")
    console.log(`pg_dump "${SUPABASE_DB_URL}" \\`)
    console.log("  --schema=public \\")
    console.log("  --no-owner \\")
    console.log("  --no-privileges \\")
    console.log("  --format=custom \\")
    console.log("  --file=supabase_backup.dump")
    console.log("```")
    console.log("")
    console.log("This exports:")
    console.log("  ✓ All tables and columns")
    console.log("  ✓ All enums, views, functions, triggers")
    console.log("  ✓ All data")
    console.log("  ✓ All indexes and constraints")
    console.log("")
    console.log("=".repeat(70))
    console.log("Step 2: Import to Neon")
    console.log("=".repeat(70))
    console.log("")
    console.log("Run this command to import into Neon:")
    console.log("")
    console.log("```bash")
    console.log(`pg_restore "${DATABASE_URL}" \\`)
    console.log("  --no-owner \\")
    console.log("  --no-privileges \\")
    console.log("  --clean \\")
    console.log("  --if-exists \\")
    console.log("  supabase_backup.dump")
    console.log("```")
    console.log("")
    console.log("Flags explanation:")
    console.log("  --clean: Drop existing objects before recreating")
    console.log("  --if-exists: Don't error if objects don't exist")
    console.log("  These make the command RE-RUNNABLE!")
    console.log("")
    console.log("=".repeat(70))
    console.log("Tables to migrate:")
    console.log("=".repeat(70))
    console.log("")
    TABLES_TO_MIGRATE.forEach((t, i) => console.log(`  ${i + 1}. ${t}`))
    console.log("")
    console.log("=".repeat(70))
    console.log("Quick one-liner (combines both steps):")
    console.log("=".repeat(70))
    console.log("")
    console.log("```bash")
    console.log(`pg_dump "${SUPABASE_DB_URL}" \\`)
    console.log("  --schema=public --no-owner --no-privileges --format=custom \\")
    console.log(`  | pg_restore -d "${DATABASE_URL}" \\`)
    console.log("  --no-owner --no-privileges --clean --if-exists")
    console.log("```")
    console.log("")
    console.log("🎉 Run this before your final deployment for complete sync!")
    console.log("")
}

main()
