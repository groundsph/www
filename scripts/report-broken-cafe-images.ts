/**
 * Report cafes whose stored image URLs no longer resolve.
 *
 * Usage:
 *   bun run scripts/report-broken-cafe-images.ts
 *   bun run scripts/report-broken-cafe-images.ts --json
 *
 * Read-only: it never writes to the database or to storage. It exists because
 * "remove cover" used to delete the R2 object while the database kept the URL,
 * so some cafes may still point at files that are already gone.
 *
 * Connection handling comes from the app's own `@/db`, so this script can never
 * disagree with the running app about SSL, pooling or the connection string.
 */
import { db } from "@/db"
import { cafes } from "@/db/schema/tables"
import {
    collectCafeImageUrls,
    summarizeBrokenImages,
    type CheckedCafeImageUrl,
} from "@/utils/storage/cafe-image-audit"

const CONCURRENCY = 5

async function head(url: string): Promise<number | null> {
    try {
        const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) })
        return response.status
    } catch {
        return null
    }
}

async function checkAll(
    urls: { cafeId: string; cafeName: string; url: string }[]
): Promise<CheckedCafeImageUrl[]> {
    const results: CheckedCafeImageUrl[] = []
    const queue = [...urls]

    async function worker() {
        while (queue.length > 0) {
            const entry = queue.shift()
            if (!entry) return
            results.push({ ...entry, status: await head(entry.url) })
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    return results
}

const rows = await db
    .select({
        id: cafes.id,
        name: cafes.name,
        thumbnail: cafes.thumbnail,
        gallery: cafes.gallery,
    })
    .from(cafes)

const urls = collectCafeImageUrls(rows)
console.error(`Checking ${urls.length} image URLs across ${rows.length} cafes…`)

const broken = summarizeBrokenImages(await checkAll(urls))

if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ checkedCount: urls.length, broken }, null, 2))
} else if (broken.length === 0) {
    console.log(`No broken images found (checked ${urls.length} URLs).`)
} else {
    console.log(`${broken.length} cafe(s) have unreachable images:`)
    for (const cafe of broken) {
        console.log(`\n  ${cafe.cafeName} (${cafe.cafeId})`)
        for (const url of cafe.brokenUrls) console.log(`    - ${url}`)
    }
    console.log("\nRepair these in the admin cafe editor (Images tab), or clear the cover.")
}

// The app's pool is lazy and never closed; exit so the script does not hang.
process.exit(0)
