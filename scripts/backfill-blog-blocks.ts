/**
 * Backfill block-based blog bodies.
 *
 * Converts legacy markdown posts into the ordered block model:
 *   content        → text block
 *   images         → image block (1) / gallery block (2+)
 *   tagged cafes   → cafe block (1) / cafe-carousel block (2+)
 *     (including cafes auto-detected from /cafes/<slug> links in the markdown)
 *   crawl_id       → crawl block
 *
 * This mirrors the order the legacy blog viewer rendered sections in.
 *
 * Safely re-runnable: existing block bodies are skipped unless --force.
 * `content` is left untouched (it remains the markdown projection).
 *
 * Usage:
 *   bun run scripts/backfill-blog-blocks.ts --dry-run
 *   bun run scripts/backfill-blog-blocks.ts
 *   bun run scripts/backfill-blog-blocks.ts --force --limit 10
 */

import { db } from "@/db"
import { blogPosts, cafes } from "@/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import {
    legacyContentToBlocks,
    normalizeBlocks,
    type BlogBlock,
} from "@/utils/types/blog-blocks"
import { extractCafeSlugsFromContent } from "@/utils/blog/link-detection"
import { mergeCafeTags } from "@/utils/blog/merge-cafe-tags"

interface Args {
    dryRun: boolean
    force: boolean
    limit?: number
}

function parseArgs(): Args {
    const argv = process.argv.slice(2)
    const limitFlag = argv.findIndex((a) => a === "--limit")
    const limit =
        limitFlag >= 0 && argv[limitFlag + 1]
            ? Number.parseInt(argv[limitFlag + 1], 10)
            : undefined
    return {
        dryRun: argv.includes("--dry-run"),
        force: argv.includes("--force"),
        limit: Number.isFinite(limit) ? limit : undefined,
    }
}

function summarize(blocks: BlogBlock[]): string {
    return blocks
        .map((block) => {
            switch (block.type) {
                case "image":
                    return "image"
                case "gallery":
                    return `gallery(${block.images.length})`
                case "cafe":
                    return "cafe"
                case "cafe-carousel":
                    return `cafe-carousel(${block.cafeIds.length})`
                default:
                    return block.type
            }
        })
        .join(" → ")
}

async function main() {
    const args = parseArgs()
    console.log(
        `🚀 Backfilling blog blocks${args.dryRun ? " (dry run)" : ""}` +
            `${args.force ? " [force]" : ""}`
    )

    const query = db
        .select({
            id: blogPosts.id,
            title: blogPosts.title,
            slug: blogPosts.slug,
            content: blogPosts.content,
            images: blogPosts.images,
            taggedCafeIds: blogPosts.taggedCafeIds,
            crawlId: blogPosts.crawlId,
            blocks: blogPosts.blocks,
        })
        .from(blogPosts)

    const posts = args.limit ? await query.limit(args.limit) : await query

    let converted = 0
    let skipped = 0
    let failed = 0

    for (const post of posts) {
        const existing = normalizeBlocks(post.blocks)
        if (existing.length > 0 && !args.force) {
            skipped++
            continue
        }

        try {
            const detectedSlugs = extractCafeSlugsFromContent(post.content)
            const detectedCafes =
                detectedSlugs.length > 0
                    ? await db
                          .select({ id: cafes.id })
                          .from(cafes)
                          .where(
                              and(
                                  inArray(cafes.slug, detectedSlugs),
                                  eq(cafes.isPublished, true)
                              )
                          )
                    : []

            const cafeIds = mergeCafeTags(
                post.taggedCafeIds ?? [],
                detectedCafes.map((c) => c.id)
            )

            const blocks = legacyContentToBlocks({
                content: post.content,
                images: post.images,
                cafeIds,
                crawlId: post.crawlId,
            })

            if (blocks.length === 0) {
                console.log(`⏭️  skip (empty)  ${post.slug}`)
                skipped++
                continue
            }

            console.log(`✔︎  ${post.slug}\n     ${summarize(blocks)}`)

            if (!args.dryRun) {
                await db
                    .update(blogPosts)
                    .set({ blocks, updatedAt: new Date() })
                    .where(eq(blogPosts.id, post.id))
            }

            converted++
        } catch (error) {
            console.error(`✗  ${post.slug}:`, error)
            failed++
        }
    }

    console.log("\n──────── summary ────────")
    console.log(`total:     ${posts.length}`)
    console.log(`converted: ${converted}`)
    console.log(`skipped:   ${skipped}`)
    console.log(`failed:    ${failed}`)
    if (args.dryRun) console.log("\n(dry run — no rows were written)")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
