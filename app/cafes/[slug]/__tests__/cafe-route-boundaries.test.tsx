import { describe, it, expect, mock, afterEach } from "bun:test"
import { existsSync } from "node:fs"
import path from "node:path"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { cafes } from "@/db/schema"

/**
 * Seam S6 — the Cafe route segment's boundaries.
 *
 * The response a visitor gets for `/cafes/[slug]` and `/cafes/[slug]/menu` is
 * produced here without a browser: the pages are called, the database is faked
 * at the module boundary (as the action tests already do), and the framework's
 * own `notFound()` is the real one. Next answers a thrown `notFound()` with a
 * 404 and renders the nearest `not-found` boundary, which for this route is
 * `app/cafes/[slug]/not-found.tsx`.
 *
 * What this catches: an unpublished Cafe returning something different from a
 * missing one, and the Cafe's name leaking into either response.
 */

type Row = Record<string, unknown>

const PUBLISHED_CAFE: Row = {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "published-cafe",
    name: "Kalye Roast",
    is_published: true,
    is_active: true,
    is_test: false,
}

const UNPUBLISHED_CAFE: Row = {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "unpublished-cafe",
    name: "Secret Kitchen Roasters",
    is_published: false,
    is_active: true,
    is_test: false,
}

const MISSING_SLUG = "no-such-cafe"

/** Rows the fake database holds, keyed by the table object a query selects from. */
const rowsByTable = new Map<unknown, Row[]>([[cafes, [PUBLISHED_CAFE, UNPUBLISHED_CAFE]]])

interface Equality {
    column: string
    value: unknown
}

interface Chunk {
    value?: unknown
    name?: string
    table?: unknown
    queryChunks?: unknown[]
}

function isColumn(chunk: unknown): chunk is Chunk & { name: string } {
    const c = chunk as Chunk
    return typeof c?.name === "string" && c.table !== undefined
}

function isParam(chunk: unknown): chunk is { value: unknown } {
    // A bound parameter (but not a `StringChunk`, which also carries `value`).
    const c = chunk as Chunk & { encoder?: unknown }
    return typeof c === "object" && c !== null && "value" in c && "encoder" in c
}

function isEqualsOperator(chunk: unknown): boolean {
    const value = (chunk as Chunk | undefined)?.value
    const text = Array.isArray(value) ? value.join("") : value
    return typeof text === "string" && text.trim() === "="
}

/**
 * Read the `column = value` predicates out of the SQL object Drizzle built for
 * the `where` clause. The pages only ever filter on equalities, so evaluating
 * them means "does this row satisfy every predicate" — which is what the
 * database would do. A predicate that is dropped therefore lets a hidden row
 * through, and the leaking-name assertions below fail.
 */
function equalities(node: unknown, found: Equality[] = []): Equality[] {
    const chunks = (node as Chunk | undefined)?.queryChunks
    if (!Array.isArray(chunks)) return found

    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index]
        if (
            isColumn(chunk) &&
            isEqualsOperator(chunks[index + 1]) &&
            isParam(chunks[index + 2])
        ) {
            found.push({ column: chunk.name, value: chunks[index + 2].value })
        } else {
            equalities(chunk, found)
        }
    }

    return found
}

function project(fields: unknown, row: Row): Row {
    if (!fields || typeof fields !== "object") return { ...row }

    const projected: Row = {}
    for (const [alias, column] of Object.entries(fields as Record<string, unknown>)) {
        projected[alias] = isColumn(column) ? row[column.name] : undefined
    }
    return projected
}

class FakeQuery implements PromiseLike<Row[]> {
    private table: unknown = null
    private fields: unknown = null
    private condition: unknown = null

    constructor(fields: unknown) {
        this.fields = fields
    }

    from(table: unknown): this {
        this.table = table
        return this
    }

    leftJoin(): this {
        return this
    }

    where(condition: unknown): this {
        this.condition = condition
        return this
    }

    groupBy(): this {
        return this
    }

    orderBy(): this {
        return this
    }

    limit(): this {
        return this
    }

    private rows(): Row[] {
        const stored = rowsByTable.get(this.table) ?? []
        const predicates = equalities(this.condition)
        const matching = stored.filter(row =>
            predicates.every(predicate => row[predicate.column] === predicate.value)
        )
        return matching.map(row => project(this.fields, row))
    }

    then<TResult1 = Row[], TResult2 = never>(
        onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(this.rows()).then(onfulfilled, onrejected)
    }
}

const fakeDb = {
    select: (fields: unknown) => new FakeQuery(fields),
}

mock.module("@/db", () => ({ db: fakeDb }))

// Not part of the boundary under test: the page's other reads and its client
// presentation components only run once a Cafe has resolved.
mock.module("@/app/api/actions/owner", () => ({
    getCafeMenuItems: async () => [],
}))
mock.module("@/app/api/actions/cafe-edit-permission", () => ({
    getCafeEditPermission: async () => ({ canEdit: false, role: null }),
}))
mock.module("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}))

import CafePage, { generateMetadata as cafeMetadata } from "@/app/cafes/[slug]/page"
import MenuPage from "@/app/cafes/[slug]/menu/page"
import CafeNotFound from "@/app/cafes/[slug]/not-found"
import CafeError from "@/app/cafes/[slug]/error"
import RootNotFound from "@/app/not-found"
import { getCafeBySlug } from "@/app/api/actions/cafe"

/** The `NEXT_HTTP_ERROR_FALLBACK;404` error `notFound()` throws. */
function isNotFound(error: unknown): boolean {
    return String((error as { digest?: unknown } | null)?.digest ?? error).includes("NEXT_HTTP_ERROR_FALLBACK;404")
}

interface Response {
    status: number
    body: string
}

/**
 * Ask a Cafe route for a slug and return the response, the way Next does: the
 * page's markup on success, or a 404 rendering this segment's not-found
 * boundary when the page calls `notFound()`.
 */
async function requestCafeRoute(
    route: "cafe" | "menu",
    slug: string
): Promise<Response> {
    const params = Promise.resolve({ slug })
    try {
        const element =
            route === "cafe"
                ? await CafePage({ params })
                : await MenuPage({ params, searchParams: Promise.resolve({}) })
        return { status: 200, body: renderToStaticMarkup(element) }
    } catch (error) {
        if (!isNotFound(error)) throw error
        return { status: 404, body: renderToStaticMarkup(<CafeNotFound />) }
    }
}

afterEach(() => {
    cleanup()
})

describe("Cafe route not-found boundary", () => {
    it("still resolves a published cafe, so the absence assertions are not vacuous", async () => {
        const cafe = await getCafeBySlug(PUBLISHED_CAFE.slug as string)
        expect(cafe?.name).toBe(PUBLISHED_CAFE.name)

        const metadata = await cafeMetadata({
            params: Promise.resolve({ slug: PUBLISHED_CAFE.slug as string }),
        })
        expect(metadata.title).toBe(PUBLISHED_CAFE.name)
    })

    it("answers a cafe that does not exist with a 404 that carries no cafe name", async () => {
        const response = await requestCafeRoute("cafe", MISSING_SLUG)

        expect(response.status).toBe(404)
        expect(response.body).not.toContain(PUBLISHED_CAFE.name)
        expect(response.body).not.toContain(UNPUBLISHED_CAFE.name)
        expect(response.body).not.toContain(UNPUBLISHED_CAFE.slug)
    })

    it("answers an unpublished cafe identically: same status, same output", async () => {
        const missing = await requestCafeRoute("cafe", MISSING_SLUG)
        const unpublished = await requestCafeRoute("cafe", UNPUBLISHED_CAFE.slug as string)

        expect(unpublished.status).toBe(404)
        expect(unpublished.status).toBe(missing.status)
        expect(unpublished.body).toBe(missing.body)
        expect(unpublished.body).not.toContain(UNPUBLISHED_CAFE.name)
        expect(unpublished.body).not.toContain(PUBLISHED_CAFE.name)
    })

    it("keeps an unpublished cafe's name out of its metadata as well", async () => {
        const metadata = await cafeMetadata({
            params: Promise.resolve({ slug: UNPUBLISHED_CAFE.slug as string }),
        })

        expect(String(metadata.title)).not.toContain(UNPUBLISHED_CAFE.name)
        expect(String(metadata.description)).not.toContain(UNPUBLISHED_CAFE.name)
    })

    it("gives the Cafe Menu page the same 404 instead of sending the visitor home", async () => {
        const menu = await requestCafeRoute("menu", UNPUBLISHED_CAFE.slug as string)
        const cafe = await requestCafeRoute("cafe", MISSING_SLUG)

        expect(menu.status).toBe(404)
        expect(menu.body).toBe(cafe.body)
        expect(menu.body).not.toContain(UNPUBLISHED_CAFE.name)

        const missingMenu = await requestCafeRoute("menu", MISSING_SLUG)
        expect(missingMenu.body).toBe(menu.body)
    })

    it("leaves the app-wide not-found response alone for every other route", () => {
        // Other routes still fall through to app/not-found.tsx, which redirects.
        expect(() => RootNotFound()).toThrow(/NEXT_REDIRECT/)
    })

    it("does not add a route-level loading fallback to the Cafe segment", () => {
        const segment = path.join(process.cwd(), "app", "cafes", "[slug]")

        expect(existsSync(path.join(segment, "loading.tsx"))).toBe(false)
        expect(existsSync(path.join(segment, "menu", "loading.tsx"))).toBe(false)
    })
})

describe("Cafe route error boundary", () => {
    it("offers a retry that re-renders the segment", () => {
        const retry = mock(() => {})
        const logged = mock(() => {})
        const originalConsoleError = console.error
        console.error = logged

        try {
            const failure = new Error("menu render failed")
            render(<CafeError error={failure} retry={retry} />)

            expect(screen.getByText(/did not load/i)).toBeTruthy()

            fireEvent.click(screen.getByRole("button", { name: /try again/i }))

            expect(retry).toHaveBeenCalledTimes(1)
            expect(logged).toHaveBeenCalledWith(failure)
        } finally {
            console.error = originalConsoleError
        }
    })
})
