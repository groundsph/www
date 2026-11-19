import { describe, it, expect, afterEach } from "bun:test"
import { and } from "drizzle-orm"
import { db } from "@/db"
import { cafes } from "@/db/schema"
import { publicCafeConditions } from "@/utils/filters"

/**
 * The unit tests in `utils/__tests__/filters.test.ts` cover the helper's own
 * behaviour. This file covers the thing that actually broke: whether a query
 * built the intended way ends up carrying the predicates in its SQL.
 *
 * It renders the `where` clause Drizzle would send, so a predicate that is
 * silently dropped (a spread forgotten, a condition overwritten) fails here
 * rather than on the landing page.
 */

const originalNodeEnv = process.env.NODE_ENV

function setNodeEnv(value: string | undefined) {
    if (value === undefined) {
        delete (process.env as Record<string, string | undefined>).NODE_ENV
    } else {
        process.env.NODE_ENV = value
    }
}

afterEach(() => {
    setNodeEnv(originalNodeEnv)
})

function renderWhere(includeDrafts = false, includeTest = false): string {
    const query = db
        .select({ id: cafes.id })
        .from(cafes)
        .where(
            and(...publicCafeConditions({ includeDrafts, includeTest }))
        )

    return query.toSQL().sql
}

describe("public cafe reads", () => {
    it("filter test cafes, drafts and deactivated listings in production", () => {
        setNodeEnv("production")
        const sql = renderWhere()

        expect(sql).toContain("is_test")
        expect(sql).toContain("is_published")
        expect(sql).toContain("is_active")
    })

    it("still filter test cafes under the test runner", () => {
        setNodeEnv("test")
        expect(renderWhere()).toContain("is_test")
    })

    it("stop filtering test cafes only in a development build", () => {
        setNodeEnv("development")
        const sql = renderWhere()

        expect(sql).not.toContain("is_test")
        expect(sql).toContain("is_published")
    })

    it("keep the test-cafe predicate when only drafts are relaxed", () => {
        setNodeEnv("production")
        const sql = renderWhere(true)

        expect(sql).not.toContain("is_published")
        expect(sql).toContain("is_test")
    })

    it("keep draft filtering when only test cafes are relaxed", () => {
        setNodeEnv("production")
        const sql = renderWhere(false, true)

        expect(sql).toContain("is_published")
        expect(sql).toContain("is_active")
        expect(sql).not.toContain("is_test")
    })
})
