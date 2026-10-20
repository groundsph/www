/**
 * Baseline drizzle's migration bookkeeping for a database that was provisioned
 * with `bun db:push`.
 *
 * Why this exists: `drizzle.__drizzle_migrations` is empty on a database whose
 * schema was created by `db:push`, so `drizzle-kit migrate` believes none of the
 * migration files have been applied and tries to replay all of them — starting
 * with CREATE TABLE statements for tables that already exist. That is how a
 * live database gets wrecked.
 *
 * This script records the existing migrations as applied, using exactly the
 * values the migrator would have written:
 *   hash       = sha256(exact bytes of the .sql file)
 *   created_at = the migration's `when` from meta/_journal.json
 * (see node_modules/drizzle-orm/migrator.js and pg-core/dialect.js)
 *
 * Read the dry run first, then pass --apply. Writes only inside a transaction,
 * and only rows that are missing. Bookkeeping only: the schema is not touched,
 * and reversing it is `DELETE FROM drizzle.__drizzle_migrations`.
 *
 * Usage:
 *   bun run scripts/baseline-migrations.ts
 *   bun run scripts/baseline-migrations.ts --apply
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { db } from "@/db"
import { sql } from "drizzle-orm"

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle", "migrations")
const SCHEMA = "drizzle"
const TABLE = "__drizzle_migrations"
const apply = process.argv.includes("--apply")

interface JournalEntry {
    tag: string
    when: number
}

const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")
) as { entries: JournalEntry[] }

/** Matches drizzle's hashing: sha256 over the file's exact contents. */
function hashOf(tag: string): string {
    const contents = fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), "utf8")
    return crypto.createHash("sha256").update(contents).digest("hex")
}

const rows = journal.entries.map((entry) => ({
    tag: entry.tag,
    when: entry.when,
    hash: hashOf(entry.tag),
}))

const existing = await db.execute<{ hash: string; created_at: string }>(
    sql.raw(`select hash, created_at from ${SCHEMA}.${TABLE}`)
)

const known = new Set(existing.rows.map((row) => Number(row.created_at)))
const missing = rows.filter((row) => !known.has(row.when))

console.log(`${rows.length} migration files in the journal, ${existing.rows.length} already tracked`)
console.log(`${missing.length} to record${apply ? "" : " (dry run — pass --apply to write)"}`)

for (const row of missing) {
    console.log(`  + ${row.tag}  when=${row.when}  hash=${row.hash.slice(0, 12)}…`)
}

if (missing.length === 0) {
    console.log("\nNothing to do: the tracking table already covers every migration.")
    process.exit(0)
}

if (!apply) {
    console.log("\nRe-run with --apply to record them.")
    process.exit(0)
}

await db.transaction(async (tx) => {
    for (const row of missing) {
        await tx.execute(
            sql`insert into ${sql.identifier(SCHEMA)}.${sql.identifier(TABLE)} ("hash", "created_at")
                values (${row.hash}, ${row.when})`
        )
    }
})

const after = await db.execute<{ count: string }>(
    sql.raw(`select count(*)::text as count from ${SCHEMA}.${TABLE}`)
)
console.log(`\nDone. ${after.rows[0].count} migrations are now tracked.`)
console.log("Verify with: bun db:migrate   (should report nothing to apply)")
process.exit(0)
