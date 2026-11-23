/**
 * An in-memory stand-in for the database, faked at the module boundary.
 *
 * The Menu suggestion queue's batch approval is only worth anything if it is
 * atomic, so the fake has to behave like a store rather than a recorder: it
 * filters rows by the conditions the action builds, and `db.transaction` runs the
 * callback against a copy that is thrown away when the callback throws. That is
 * what lets a test assert "a failure partway through left nothing behind"
 * by looking at the rows.
 *
 * `drizzle-orm`'s `eq`/`and`/`desc`/`count` are replaced with plain tags so the
 * store can evaluate them; everything else in that module is passed through
 * untouched. Not a test file itself, so `bun test` does not collect it.
 */

import { mock } from "bun:test"
import * as realDrizzle from "drizzle-orm"
import { cafeMenuItems, cafes, menuItemSuggestions } from "@/db/schema/tables"

export interface FakeSuggestionRow {
    id: string
    cafeId: string
    userId: string
    type: string
    targetItemId: string | null
    suggestedData: Record<string, unknown>
    status: string
    batchId: string | null
    adminNotes?: string | null
    reviewedBy?: string | null
    reviewedAt?: Date | null
    createdAt: Date
    updatedAt: Date
}

export interface FakeMenuItemRow {
    id: string
    cafeId: string
    name: string
    description: string | null
    category: string
    price: number
    isAvailable: boolean
    isFood: boolean
    isHot: boolean
    isCold: boolean
    isSignature: boolean
    calories: number | null
    isVegan: boolean
    isVegetarian: boolean
    sizeOptions: Array<{ label: string; price: number }> | null
    communitySubmitted: boolean
    sortOrder: number | null
    lastUpdatedBy: string | null
    createdAt: Date
    updatedAt: Date
}

export interface FakeCafeRow {
    id: string
    name: string
    slug: string
    ownerIds: string[]
    priceLevel: string
}

export interface FakeCaller {
    id: string
    role?: string | null
}

export interface FakeStore {
    suggestions: FakeSuggestionRow[]
    menuItems: FakeMenuItemRow[]
    cafes: FakeCafeRow[]
}

export interface RevalidationSnapshot {
    menuItems: number
    approved: number
    pending: number
}

export interface MenuSuggestionMocks {
    store: FakeStore
    control: {
        /** Make the next Menu item insert fail, as a database would. */
        failNextMenuInsert: boolean
        /** Make the next suggestion status update fail, after the items were written. */
        failNextSuggestionUpdate: boolean
        currentUser: FakeCaller | null
        revalidatedPaths: string[]
        /** Store state observed at each `revalidatePath` call. */
        revalidationSnapshots: RevalidationSnapshot[]
    }
    reset: () => void
    seedCafe: (cafe: Partial<FakeCafeRow> & { id: string; name: string }) => FakeCafeRow
    seedSuggestion: (
        suggestion: Partial<FakeSuggestionRow> & { id: string; cafeId: string }
    ) => FakeSuggestionRow
    seedMenuItem: (
        item: Partial<FakeMenuItemRow> & { id: string; cafeId: string; name: string }
    ) => FakeMenuItemRow
}

type Condition =
    | { kind: "eq"; column: unknown; value: unknown }
    | { kind: "and"; parts: Condition[] }

type Order = { kind: "asc" | "desc"; column: unknown }

const eq = (column: unknown, value: unknown): Condition => ({ kind: "eq", column, value })
const and = (...parts: Condition[]): Condition => ({ kind: "and", parts })
const desc = (column: unknown): Order => ({ kind: "desc", column })
const count = () => ({ kind: "count" as const })

function isColumn(value: unknown): value is { name: string; table: unknown } {
    return (
        typeof value === "object" &&
        value !== null &&
        "name" in value &&
        "table" in value &&
        typeof (value as { name: unknown }).name === "string"
    )
}

function isCountTag(value: unknown): boolean {
    return typeof value === "object" && value !== null && (value as { kind?: string }).kind === "count"
}

function snakeToCamel(name: string): string {
    return name.replace(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase())
}

function fieldOf(column: unknown): string {
    return isColumn(column) ? snakeToCamel(column.name) : ""
}

function rowsOf(store: FakeStore, table: unknown): Array<Record<string, unknown>> {
    if (table === menuItemSuggestions) return store.suggestions as unknown as Array<Record<string, unknown>>
    if (table === cafeMenuItems) return store.menuItems as unknown as Array<Record<string, unknown>>
    if (table === cafes) return store.cafes as unknown as Array<Record<string, unknown>>
    return []
}

function matchesCondition(
    row: Record<string, unknown>,
    condition: Condition | undefined
): boolean {
    if (!condition) return true
    if (condition.kind === "and") {
        return condition.parts.every((part) => matchesCondition(row, part))
    }
    return row[fieldOf(condition.column)] === condition.value
}

function matchesJoin(
    baseRow: Record<string, unknown>,
    joinedRow: Record<string, unknown>,
    condition: Condition | undefined
): boolean {
    if (!condition) return true
    if (condition.kind === "and") {
        return condition.parts.every((part) => matchesJoin(baseRow, joinedRow, part))
    }
    const left = baseRow[fieldOf(condition.column)]
    const right = isColumn(condition.value)
        ? joinedRow[fieldOf(condition.value)]
        : condition.value
    return left === right
}

interface QueryState {
    table: unknown
    joins: Array<{ table: unknown; condition?: Condition }>
    condition?: Condition
    order?: Order
    take?: number
}

function compare(a: unknown, b: unknown): number {
    if (a === b) return 0
    if (a === null || a === undefined) return 1
    if (b === null || b === undefined) return -1
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
    if (typeof a === "number" && typeof b === "number") return a - b
    return String(a).localeCompare(String(b))
}

function resolveRows(
    store: FakeStore,
    selection: Record<string, unknown> | undefined,
    state: QueryState
): Array<Record<string, unknown>> {
    if (!state.table) return []

    const matched = rowsOf(store, state.table).filter((row) =>
        matchesCondition(row, state.condition)
    )
    const matchedCount = matched.length

    const ordered = state.order
        ? [...matched].sort((a, b) => {
              const direction = state.order?.kind === "desc" ? -1 : 1
              return direction * compare(a[fieldOf(state.order?.column)], b[fieldOf(state.order?.column)])
          })
        : matched

    const limited =
        state.take === undefined ? ordered : ordered.slice(0, state.take)

    return limited.map((row) => {
        if (!selection) return { ...row }

        const projected: Record<string, unknown> = {}
        for (const [alias, value] of Object.entries(selection)) {
            if (isCountTag(value)) {
                projected[alias] = matchedCount
                continue
            }
            if (value === state.table) {
                // `select({ suggestion: table })` nests the whole row under the alias.
                projected[alias] = { ...row }
                continue
            }
            if (isColumn(value)) {
                if (value.table === state.table) {
                    projected[alias] = row[fieldOf(value)]
                } else {
                    const join = state.joins.find((entry) => entry.table === value.table)
                    const joinedRow = join
                        ? rowsOf(store, join.table).find((candidate) =>
                              matchesJoin(row, candidate, join.condition)
                          )
                        : undefined
                    projected[alias] = joinedRow ? joinedRow[fieldOf(value)] : null
                }
                continue
            }
            projected[alias] = null
        }
        return projected
    })
}

function cloneStore(store: FakeStore): FakeStore {
    return {
        suggestions: store.suggestions.map((row) => ({ ...row })),
        menuItems: store.menuItems.map((row) => ({ ...row })),
        cafes: store.cafes.map((row) => ({ ...row })),
    }
}

interface Control {
    sequence: number
    failNextMenuInsert: boolean
    failNextSuggestionUpdate: boolean
    currentUser: FakeCaller | null
    revalidatedPaths: string[]
    revalidationSnapshots: RevalidationSnapshot[]
}

function makeDb(store: FakeStore, control: Control) {
    const select = (selection?: Record<string, unknown>) => {
        const build = (state: QueryState) => ({
            from(table: unknown) {
                return build({ ...state, table })
            },
            leftJoin(table: unknown, condition?: Condition) {
                return build({
                    ...state,
                    joins: [...state.joins, { table, condition }],
                })
            },
            where(condition: Condition) {
                return build({ ...state, condition })
            },
            orderBy(order: Order | unknown) {
                return build({
                    ...state,
                    order: isColumn(order) ? { kind: "asc", column: order } : (order as Order),
                })
            },
            limit(take: number) {
                return build({ ...state, take })
            },
            for() {
                return build(state)
            },
            then<Result>(
                onFulfilled: (rows: Array<Record<string, unknown>>) => Result,
                onRejected?: (error: unknown) => Result
            ) {
                return Promise.resolve(resolveRows(store, selection, state)).then(
                    onFulfilled,
                    onRejected
                )
            },
        })

        return build({ table: null, joins: [] })
    }

    const insert = (table: unknown) => ({
        values(values: unknown) {
            const rows = (Array.isArray(values) ? values : [values]) as Array<
                Record<string, unknown>
            >

            if (table === cafeMenuItems && control.failNextMenuInsert) {
                control.failNextMenuInsert = false
                return Promise.reject(new Error("menu items insert failed"))
            }

            if (table === cafeMenuItems) {
                for (const row of rows) {
                    store.menuItems.push({
                        isAvailable: true,
                        ...row,
                        id: `item-${++control.sequence}`,
                    } as unknown as FakeMenuItemRow)
                }
            } else if (table === menuItemSuggestions) {
                for (const row of rows) {
                    store.suggestions.push({
                        ...row,
                        id: `sugg-${++control.sequence}`,
                    } as unknown as FakeSuggestionRow)
                }
            }

            return Object.assign(Promise.resolve(undefined), {
                returning: () =>
                    Promise.resolve(rows.map((_, index) => ({ id: `new-${index}` }))),
            })
        },
    })

    const update = (table: unknown) => ({
        set(patch: Record<string, unknown>) {
            return {
                where(condition: Condition) {
                    if (table === menuItemSuggestions && control.failNextSuggestionUpdate) {
                        control.failNextSuggestionUpdate = false
                        return Promise.reject(new Error("suggestion status update failed"))
                    }

                    for (const row of rowsOf(store, table)) {
                        if (matchesCondition(row, condition)) Object.assign(row, patch)
                    }

                    return Promise.resolve(undefined)
                },
            }
        },
    })

    return {
        select,
        insert,
        update,
        async transaction<Result>(callback: (tx: unknown) => Promise<Result>): Promise<Result> {
            const draft = cloneStore(store)
            const result = await callback(makeDb(draft, control))
            store.suggestions = draft.suggestions
            store.menuItems = draft.menuItems
            store.cafes = draft.cafes
            return result
        },
        query: {
            cafes: {
                findFirst: async (config?: { where?: Condition }) =>
                    store.cafes.find((cafe) =>
                        matchesCondition(
                            cafe as unknown as Record<string, unknown>,
                            config?.where
                        )
                    ),
            },
        },
    }
}

export function installMenuSuggestionMocks(): MenuSuggestionMocks {
    const store: FakeStore = { suggestions: [], menuItems: [], cafes: [] }
    const control: Control = {
        sequence: 0,
        failNextMenuInsert: false,
        failNextSuggestionUpdate: false,
        currentUser: null,
        revalidatedPaths: [],
        revalidationSnapshots: [],
    }

    const db = makeDb(store, control)

    mock.module("drizzle-orm", () => ({
        ...realDrizzle,
        eq,
        and,
        desc,
        count,
    }))

    mock.module("@/lib/auth", () => ({
        getCurrentUser: () => Promise.resolve(control.currentUser),
    }))

    mock.module("next/cache", () => ({
        revalidatePath: (path: string) => {
            control.revalidatedPaths.push(path)
            control.revalidationSnapshots.push({
                menuItems: store.menuItems.length,
                approved: store.suggestions.filter((row) => row.status === "approved")
                    .length,
                pending: store.suggestions.filter((row) => row.status === "pending").length,
            })
        },
    }))

    mock.module("@/db", () => ({ db }))

    const reset = () => {
        store.suggestions = []
        store.menuItems = []
        store.cafes = []
        control.sequence = 0
        control.failNextMenuInsert = false
        control.failNextSuggestionUpdate = false
        control.currentUser = null
        control.revalidatedPaths.length = 0
        control.revalidationSnapshots.length = 0
    }

    const seedCafe = (cafe: Partial<FakeCafeRow> & { id: string; name: string }) => {
        const row: FakeCafeRow = {
            slug: cafe.id,
            ownerIds: [],
            priceLevel: "budget",
            ...cafe,
        }
        store.cafes.push(row)
        return row
    }

    const seedSuggestion = (
        suggestion: Partial<FakeSuggestionRow> & { id: string; cafeId: string }
    ) => {
        const row: FakeSuggestionRow = {
            userId: "contributor-1",
            type: "add",
            targetItemId: null,
            suggestedData: { name: "Item", category: "Drinks", price: 100 },
            status: "pending",
            batchId: null,
            createdAt: new Date("2026-11-01T08:00:00Z"),
            updatedAt: new Date("2026-11-01T08:00:00Z"),
            ...suggestion,
        }
        store.suggestions.push(row)
        return row
    }

    const seedMenuItem = (
        item: Partial<FakeMenuItemRow> & { id: string; cafeId: string; name: string }
    ) => {
        const row: FakeMenuItemRow = {
            description: null,
            category: "Drinks",
            price: 100,
            isAvailable: true,
            isFood: false,
            isHot: false,
            isCold: false,
            isSignature: false,
            calories: null,
            isVegan: false,
            isVegetarian: false,
            sizeOptions: null,
            communitySubmitted: false,
            sortOrder: 0,
            lastUpdatedBy: null,
            createdAt: new Date("2026-11-01T08:00:00Z"),
            updatedAt: new Date("2026-11-01T08:00:00Z"),
            ...item,
        }
        store.menuItems.push(row)
        return row
    }

    return { store, control, reset, seedCafe, seedSuggestion, seedMenuItem }
}
