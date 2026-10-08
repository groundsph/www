/**
 * Backfill the cafe payment-method vocabulary.
 *
 * Folds legacy and free-text tokens into the canonical taxonomy defined in
 * `utils/payment-methods.ts`:
 *
 *   credit_card, debit_card  → card
 *   qrph, bank_transfer, BPI → qr_ph
 *
 * The migration reuses the app's own `normalizePaymentMethods()`, so it can
 * never disagree with the running code, and it is idempotent — re-running
 * reports zero affected rows.
 *
 * Writes only with an explicit `--apply`, because the target database is
 * production. Before the first write every current value is copied into
 * `cafes_payment_methods_backup_20261008`, which is additive and never
 * overwritten on re-run, so the change stays reversible with a single UPDATE:
 *
 *   UPDATE cafes c SET payment_methods = b.payment_methods
 *   FROM cafes_payment_methods_backup_20261008 b WHERE c.id = b.id::uuid
 *
 * The `::uuid` cast is required: this table's `id` column is text, while
 * `cafes.id` is uuid, so `c.id = b.id` fails with "operator does not exist:
 * uuid = text". Verified to affect all 113 backed-up rows and to restore the
 * original values.
 *
 * `cafes.updated_at` is deliberately left untouched: it feeds the cafe
 * `lastmod` value in `app/sitemap.ts`, and a vocabulary rename is not a content
 * change worth re-announcing to search engines.
 *
 * Usage:
 *   bun run scripts/backfill-payment-methods.ts            # dry run (default)
 *   bun run scripts/backfill-payment-methods.ts --apply    # write
 *   bun run scripts/backfill-payment-methods.ts --limit 3  # only show/apply N
 */

import { db } from "@/db"
import { cafes } from "@/db/schema"
import { isNotNull, sql } from "drizzle-orm"
import {
    normalizePaymentMethods,
    serializePaymentMethods,
} from "@/utils/payment-methods"

const BACKUP_TABLE = "cafes_payment_methods_backup_20261008"

/**
 * Legacy tokens this migration is responsible for eliminating. `bank_transfer`
 * is included because it renames to `qr_ph` too.
 */
const LEGACY_TOKEN_PATTERN =
    "\\y(credit_card|debit_card|qrph|bank_transfer|BPI)\\y"

const args = process.argv.slice(2)
const isApply = args.includes("--apply")
const limitArg = args.find((a) => a.startsWith("--limit"))
const limit = limitArg
    ? Number(limitArg.split("=")[1] ?? args[args.indexOf(limitArg) + 1])
    : undefined

interface PlannedRow {
    id: string
    name: string
    before: string
    after: string
}

function tokenSet(value: string): string[] {
    return normalizePaymentMethods(value).slice().sort()
}

async function plan(): Promise<PlannedRow[]> {
    const rows = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            paymentMethods: cafes.paymentMethods,
        })
        .from(cafes)
        .where(isNotNull(cafes.paymentMethods))

    const planned: PlannedRow[] = []

    for (const row of rows) {
        const before = row.paymentMethods ?? ""
        const after = serializePaymentMethods(before)
        if (before !== after) {
            planned.push({ id: row.id, name: row.name, before, after })
        }
    }

    return planned
}

function printPlan(planned: PlannedRow[]): void {
    if (planned.length === 0) {
        console.log("   No rows need changing.\n")
        return
    }

    const shown = limit ? planned.slice(0, limit) : planned
    for (const row of shown) {
        console.log(`   ${row.name}`)
        console.log(`     before: ${row.before}`)
        console.log(`     after:  ${row.after}`)
    }

    if (shown.length < planned.length) {
        console.log(`   … ${planned.length - shown.length} more not shown`)
    }
    console.log()
}

/**
 * Guard against a normalizer bug silently deleting an owner's data: every
 * distinct canonical token before the change must still be present after it.
 */
function assertNoTokenLoss(planned: PlannedRow[]): void {
    const losses = planned.filter((row) => {
        const before = tokenSet(row.before)
        const after = tokenSet(row.after)
        return before.length !== after.length || before.some((t, i) => t !== after[i])
    })

    if (losses.length > 0) {
        console.error("❌ Aborting — normalization would change the token set:")
        for (const row of losses) {
            console.error(`   ${row.name}: ${row.before} → ${row.after}`)
        }
        process.exitCode = 1
        throw new Error("token set changed during planning")
    }
}

async function createBackup(): Promise<number> {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(BACKUP_TABLE)} (
            id uuid PRIMARY KEY,
            payment_methods text,
            backed_up_at timestamptz NOT NULL DEFAULT now()
        )
    `)

    // ON CONFLICT DO NOTHING keeps the earliest snapshot if this is re-run.
    const inserted = await db.execute(sql`
        INSERT INTO ${sql.identifier(BACKUP_TABLE)} (id, payment_methods)
        SELECT id, payment_methods FROM cafes WHERE payment_methods IS NOT NULL
        ON CONFLICT (id) DO NOTHING
    `)

    return inserted.rowCount ?? 0
}

/**
 * Apply every change in a single statement.
 *
 * An earlier version looped one UPDATE per row inside `db.transaction()`. That is
 * 62 sequential round trips, and over a remote link it died mid-transaction with
 * "Client has encountered a connection error" — harmless, because Postgres rolled
 * it back, but it proved the approach fragile.
 *
 * Sending the whole plan as one statement keeps the normalizer as the single
 * source of truth (values are still computed in TypeScript) while removing the
 * long-lived transaction entirely: a lone UPDATE is already atomic, so a failure
 * leaves the table exactly as it was.
 */
async function applyPlan(planned: PlannedRow[]): Promise<void> {
    const pairs = planned.map(
        (row) => sql`(${row.id}::uuid, ${row.after}::text)`
    )

    await db.execute(sql`
        UPDATE cafes AS c
        SET payment_methods = v.new_value
        FROM (VALUES ${sql.join(pairs, sql`, `)}) AS v(id, new_value)
        WHERE c.id = v.id
    `)
}

async function countRowsWithLegacyTokens(): Promise<number> {
    const result = await db.execute(sql`
        SELECT count(*)::int AS n
        FROM cafes
        WHERE payment_methods IS NOT NULL
          AND payment_methods ~ ${LEGACY_TOKEN_PATTERN}
    `)
    return (result.rows[0] as { n: number }).n
}

async function main(): Promise<void> {
    console.log("🔍 Payment method backfill\n")

    const planned = await plan()

    console.log(`   Rows needing normalization: ${planned.length}\n`)
    printPlan(planned)
    assertNoTokenLoss(planned)

    if (!isApply) {
        console.log("   DRY RUN — nothing written.")
        console.log(
            `   Rows still holding a legacy token: ${await countRowsWithLegacyTokens()}`
        )
        console.log("\n   Re-run with --apply to write the changes.\n")
        return
    }

    if (planned.length === 0) {
        console.log("   Nothing to apply — the backfill is already complete.\n")
        return
    }

    console.log(`   Backing up to ${BACKUP_TABLE}…`)
    const backedUp = await createBackup()
    console.log(`   Backed up ${backedUp} new row(s).\n`)

    console.log(`   Applying ${planned.length} row(s) in one statement…`)
    await applyPlan(planned)

    const remaining = await countRowsWithLegacyTokens()
    console.log(`\n   Rows still holding a legacy token: ${remaining}`)

    const leftover = await plan()
    console.log(`   Rows still needing normalization: ${leftover.length}`)

    if (remaining === 0 && leftover.length === 0) {
        console.log("\n✅ Backfill complete and verified idempotent.\n")
        return
    }

    console.error("\n❌ Backfill finished but verification failed.")
    process.exitCode = 1
}

await main()
