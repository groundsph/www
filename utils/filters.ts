import { eq, sql, SQL } from "drizzle-orm"
import type { PgColumn } from "drizzle-orm/pg-core"
import { cafes } from "@/db/schema"

/**
 * The single place that decides which cafes the public is allowed to see.
 *
 * Every read that can reach a visitor — server actions, route handlers, sitemap,
 * RSS, AI tools — must build its `where` from `publicCafeConditions()`. The bug
 * this closes: a public query that simply forgot one of these predicates, which
 * is how a test cafe reached the landing page's check-in prompt.
 *
 * Three separate ideas live here, and they are separate on purpose:
 *
 * - **Test cafes** exist to exercise the product. They are hidden everywhere
 *   except a development build, so neither a preview nor a staging deployment
 *   can leak one. The gate is inverted deliberately: default hidden, one escape.
 * - **Drafts** (`is_published = false`) are work in progress.
 * - **Deactivated** (`is_active = false`) are listings that were switched off.
 *
 * Surfaces that legitimately need the hidden ones (owner preview, admin tooling,
 * the owner's own counters) opt in per condition rather than bypassing the
 * helper, so the opt-out is visible at the call site.
 */

/**
 * True only in a development build. `next dev` sets NODE_ENV=development;
 * `next build`/`next start`, previews and tests do not, so they all hide test
 * cafes.
 */
export function shouldShowTestCafes(): boolean {
    return process.env.NODE_ENV === "development"
}

/** `is_test = false`, or `undefined` when test cafes are visible. */
export function getTestCafeFilter(): SQL | undefined {
    return shouldShowTestCafes() ? undefined : eq(cafes.isTest, false)
}

/**
 * Push the test-cafe predicate onto an existing condition array.
 *
 * Kept as the narrow verb for call sites that have already decided their own
 * visibility rules and only need the test-cafe half. Prefer
 * `publicCafeConditions()` for anything that lists cafes to visitors.
 */
export function omitTestCafes(
    conditions: (SQL | undefined)[]
): (SQL | undefined)[] {
    const filter = getTestCafeFilter()
    if (filter) {
        conditions.push(filter)
    }
    return conditions
}

export interface PublicCafeScope {
    /**
     * Include unpublished and deactivated cafes. Only for surfaces where the
     * owner or an admin is looking at their own work.
     */
    includeDrafts?: boolean
    /**
     * Include test cafes regardless of build. Only for internal tooling that
     * needs to resolve a row by slug while developing. Never for a visitor.
     */
    includeTest?: boolean
}

/**
 * Conditions every public cafe read must spread into its `where`:
 *
 * ```ts
 * .where(and(...publicCafeConditions(), eq(cafes.id, id)))
 * ```
 */
export function publicCafeConditions(
    scope: PublicCafeScope = {}
): (SQL | undefined)[] {
    const conditions: (SQL | undefined)[] = []

    if (!scope.includeTest) {
        const testFilter = getTestCafeFilter()
        if (testFilter) conditions.push(testFilter)
    }

    if (!scope.includeDrafts) {
        conditions.push(eq(cafes.isPublished, true))
        conditions.push(eq(cafes.isActive, true))
    }

    return conditions
}

/**
 * For rows that merely *reference* a cafe (a blog post, an event): exclude the
 * row entirely when the cafe it points at is a test cafe.
 *
 * This is not `publicCafeConditions()`: there is no joined `cafes` row to filter
 * on, and the required behaviour differs — stripping the cafe would leave a
 * published post with a hole in it, so the row itself is hidden instead. Rows
 * with no cafe attached (`NULL`) are unaffected.
 *
 * ```ts
 * .where(and(..., excludeTestCafeReferences(blogPosts.cafeId)))
 * ```
 */
export function excludeTestCafeReferences(
    cafeIdColumn: PgColumn
): SQL | undefined {
    if (shouldShowTestCafes()) return undefined

    return sql`(${cafeIdColumn} is null or ${cafeIdColumn} not in (select ${cafes.id} from ${cafes} where ${cafes.isTest} = true))`
}
