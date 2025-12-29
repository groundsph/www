#!/usr/bin/env bun
/**
 * Storage Migration Script
 * 
 * Migrates files from Supabase Storage to Cloudflare R2.
 * 
 * Usage:
 *   bun run scripts/migrate-storage.ts [options]
 * 
 * Options:
 *   --bucket <name>    Migrate only a specific bucket (default: all)
 *   --dry-run          Preview what would be migrated without actually doing it
 *   --update-db        Update database URLs after migration
 *   --limit <n>        Limit number of files to migrate (useful for testing)
 * 
 * Example:
 *   bun run scripts/migrate-storage.ts --dry-run
 *   bun run scripts/migrate-storage.ts --bucket cafes --limit 10
 *   bun run scripts/migrate-storage.ts --update-db
 */

import { createClient } from "@supabase/supabase-js"
import {
    S3Client,
    PutObjectCommand,
    HeadObjectCommand,
} from "@aws-sdk/client-s3"

// Bun automatically loads .env.local

// ============================================
// Configuration
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

const R2_CONFIG = {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucketName: process.env.R2_BUCKET_NAME!,
    publicUrl: process.env.R2_PUBLIC_URL!,
}

const BUCKETS = [
    "cafes",
    "reviews",
    "avatars",
    "blogs",
    "events",
    "menu-photos",
    "badges",
    "ownership-proofs",
] as const

type BucketName = typeof BUCKETS[number]

// Database table mappings for URL updates
const DB_MAPPINGS: Record<BucketName, { table: string; columns: string[] }> = {
    cafes: { table: "cafes", columns: ["thumbnail", "gallery"] },
    reviews: { table: "reviews", columns: ["images"] },
    avatars: { table: "profiles", columns: ["avatar_url"] },
    blogs: { table: "blog_posts", columns: ["cover_image"] },
    events: { table: "events", columns: ["image_url"] },
    "menu-photos": { table: "cafe_menu_items", columns: ["image_url"] },
    badges: { table: "badge_definitions", columns: ["image_url"] },
    "ownership-proofs": { table: "cafe_claims", columns: ["proof_urls"] },
}

// ============================================
// Clients
// ============================================

function createSupabaseAdmin() {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
    })
}

function createR2Client() {
    return new S3Client({
        region: "auto",
        endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_CONFIG.accessKeyId,
            secretAccessKey: R2_CONFIG.secretAccessKey,
        },
    })
}

// ============================================
// Migration Logic
// ============================================

interface MigrationStats {
    bucket: string
    total: number
    migrated: number
    skipped: number
    failed: number
    errors: string[]
}

async function fileExistsInR2(
    r2: S3Client,
    key: string
): Promise<boolean> {
    try {
        await r2.send(new HeadObjectCommand({
            Bucket: R2_CONFIG.bucketName,
            Key: key,
        }))
        return true
    } catch {
        return false
    }
}

async function downloadFromSupabase(
    supabase: ReturnType<typeof createSupabaseAdmin>,
    bucket: string,
    path: string
): Promise<{ data: Blob; contentType: string } | null> {
    const { data, error } = await supabase.storage.from(bucket).download(path)

    if (error || !data) {
        console.error(`  ❌ Failed to download ${bucket}/${path}:`, error?.message)
        return null
    }

    return {
        data,
        contentType: data.type || "application/octet-stream",
    }
}

async function uploadToR2(
    r2: S3Client,
    key: string,
    data: Blob,
    contentType: string
): Promise<boolean> {
    try {
        const arrayBuffer = await data.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        await r2.send(new PutObjectCommand({
            Bucket: R2_CONFIG.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        }))

        return true
    } catch (error) {
        console.error(`  ❌ Failed to upload to R2:`, error)
        return false
    }
}

async function listAllFilesInBucket(
    supabase: ReturnType<typeof createSupabaseAdmin>,
    bucket: string
): Promise<string[]> {
    const allPaths: string[] = []

    // List root level
    const { data: rootItems } = await supabase.storage.from(bucket).list("", { limit: 1000 })

    if (!rootItems) return allPaths

    for (const item of rootItems) {
        if (item.id === null) {
            // It's a folder, list its contents
            const { data: folderItems } = await supabase.storage
                .from(bucket)
                .list(item.name, { limit: 1000 })

            if (folderItems) {
                for (const file of folderItems) {
                    if (file.id !== null) {
                        allPaths.push(`${item.name}/${file.name}`)
                    }
                }
            }
        } else {
            // It's a file at root level
            allPaths.push(item.name)
        }
    }

    return allPaths
}

async function migrateBucket(
    supabase: ReturnType<typeof createSupabaseAdmin>,
    r2: S3Client,
    bucket: BucketName,
    options: { dryRun: boolean; limit?: number }
): Promise<MigrationStats> {
    const stats: MigrationStats = {
        bucket,
        total: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
        errors: [],
    }

    console.log(`\n📦 Migrating bucket: ${bucket}`)
    console.log("─".repeat(50))

    // Get all files
    let files = await listAllFilesInBucket(supabase, bucket)
    stats.total = files.length

    if (options.limit && files.length > options.limit) {
        console.log(`  ⚠️  Limiting to ${options.limit} files (total: ${files.length})`)
        files = files.slice(0, options.limit)
    }

    console.log(`  Found ${files.length} files to process`)

    for (const path of files) {
        const r2Key = `${bucket}/${path}` // R2 uses bucket as prefix

        if (options.dryRun) {
            console.log(`  [DRY RUN] Would migrate: ${path}`)
            stats.migrated++
            continue
        }

        // Check if already exists in R2
        if (await fileExistsInR2(r2, r2Key)) {
            console.log(`  ⏭️  Skipping (exists): ${path}`)
            stats.skipped++
            continue
        }

        // Download from Supabase
        const downloaded = await downloadFromSupabase(supabase, bucket, path)
        if (!downloaded) {
            stats.failed++
            stats.errors.push(`Download failed: ${path}`)
            continue
        }

        // Upload to R2
        const uploaded = await uploadToR2(r2, r2Key, downloaded.data, downloaded.contentType)
        if (uploaded) {
            console.log(`  ✅ Migrated: ${path}`)
            stats.migrated++
        } else {
            stats.failed++
            stats.errors.push(`Upload failed: ${path}`)
        }
    }

    return stats
}

function getNewUrl(oldUrl: string, bucket: BucketName): string {
    // Extract path from Supabase URL
    const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)`)
    const match = oldUrl.match(pattern)

    if (!match || !match[1]) {
        return oldUrl // Can't parse, return original
    }

    const path = match[1].split("?")[0] // Remove query params
    const publicUrl = R2_CONFIG.publicUrl.replace(/\/$/, "")
    return `${publicUrl}/${bucket}/${path}`
}

async function updateDatabaseUrls(
    supabase: ReturnType<typeof createSupabaseAdmin>,
    bucket: BucketName,
    dryRun: boolean
): Promise<{ updated: number; errors: string[] }> {
    const mapping = DB_MAPPINGS[bucket]
    let updated = 0
    const errors: string[] = []

    console.log(`\n🔄 Updating URLs in ${mapping.table}...`)

    for (const column of mapping.columns) {
        // Fetch rows with Supabase URLs
        const { data: rows, error } = await supabase
            .from(mapping.table)
            .select(`id, ${column}`)
            .like(column, `%supabase.co/storage%`)

        if (error) {
            errors.push(`Failed to query ${mapping.table}.${column}: ${error.message}`)
            continue
        }

        if (!rows || rows.length === 0) {
            console.log(`  No URLs to update in ${column}`)
            continue
        }

        console.log(`  Found ${rows.length} rows with Supabase URLs in ${column}`)

        for (const row of rows) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rowData = row as any
            const rowId = rowData.id as string
            const oldValue = rowData[column]
            let newValue: string | string[]

            if (Array.isArray(oldValue)) {
                // Handle array columns (like gallery, images, proof_urls)
                newValue = oldValue.map((url: string) =>
                    url.includes("supabase.co/storage") ? getNewUrl(url, bucket) : url
                )
            } else if (typeof oldValue === "string") {
                newValue = getNewUrl(oldValue, bucket)
            } else {
                continue
            }

            if (dryRun) {
                console.log(`  [DRY RUN] Would update ${mapping.table}.${column} for id=${rowId}`)
                updated++
            } else {
                const { error: updateError } = await supabase
                    .from(mapping.table)
                    .update({ [column]: newValue })
                    .eq("id", rowId)

                if (updateError) {
                    errors.push(`Failed to update ${mapping.table}.${rowId}: ${updateError.message}`)
                } else {
                    console.log(`  ✅ Updated ${mapping.table}.${column} for id=${rowId}`)
                    updated++
                }
            }
        }
    }

    return { updated, errors }
}

// ============================================
// CLI
// ============================================

async function main() {
    const args = process.argv.slice(2)

    const dryRun = args.includes("--dry-run")
    const updateDb = args.includes("--update-db")
    const bucketIndex = args.indexOf("--bucket")
    const limitIndex = args.indexOf("--limit")

    const specificBucket = bucketIndex !== -1 ? args[bucketIndex + 1] as BucketName : undefined
    const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : undefined

    // Validate config
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error("❌ Missing Supabase configuration")
        process.exit(1)
    }

    if (!R2_CONFIG.accountId || !R2_CONFIG.accessKeyId || !R2_CONFIG.secretAccessKey) {
        console.error("❌ Missing R2 configuration")
        process.exit(1)
    }

    console.log("═".repeat(50))
    console.log("🚀 Supabase → Cloudflare R2 Migration")
    console.log("═".repeat(50))
    console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`)
    console.log(`Buckets: ${specificBucket || "all"}`)
    if (limit) console.log(`Limit: ${limit} files per bucket`)
    console.log(`Update DB URLs: ${updateDb ? "yes" : "no"}`)

    const supabase = createSupabaseAdmin()
    const r2 = createR2Client()

    const bucketsToMigrate = specificBucket ? [specificBucket] : BUCKETS
    const allStats: MigrationStats[] = []

    // Migrate files
    for (const bucket of bucketsToMigrate) {
        const stats = await migrateBucket(supabase, r2, bucket, { dryRun, limit })
        allStats.push(stats)
    }

    // Update database URLs if requested
    if (updateDb) {
        console.log("\n" + "═".repeat(50))
        console.log("🗄️  Updating Database URLs")
        console.log("═".repeat(50))

        for (const bucket of bucketsToMigrate) {
            await updateDatabaseUrls(supabase, bucket, dryRun)
        }
    }

    // Summary
    console.log("\n" + "═".repeat(50))
    console.log("📊 Migration Summary")
    console.log("═".repeat(50))

    let totalMigrated = 0
    let totalSkipped = 0
    let totalFailed = 0

    for (const stats of allStats) {
        console.log(`\n${stats.bucket}:`)
        console.log(`  Total: ${stats.total}, Migrated: ${stats.migrated}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`)
        if (stats.errors.length > 0) {
            console.log(`  Errors: ${stats.errors.join(", ")}`)
        }
        totalMigrated += stats.migrated
        totalSkipped += stats.skipped
        totalFailed += stats.failed
    }

    console.log("\n" + "─".repeat(50))
    console.log(`Total: Migrated ${totalMigrated}, Skipped ${totalSkipped}, Failed ${totalFailed}`)

    if (dryRun) {
        console.log("\n⚠️  This was a DRY RUN. No files were actually migrated.")
        console.log("   Run without --dry-run to perform the migration.")
    }
}

main().catch(console.error)
