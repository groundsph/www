# External API (`/api/ext/*`) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a full external REST API at `/api/ext/*` using Elysia (mounted inside a Next.js route handler), authenticated via Better Auth API keys, exposing cron jobs, cafe management, subscriptions, users, settings, and analytics endpoints for an external management app.

**Architecture:** Elysia app instance lives in `lib/ext/app.ts`, mounted via a Next.js catch-all route at `app/api/ext/[...path]/route.ts`. API key auth middleware validates the `Authorization: Bearer <key>` header using Better Auth's `auth.api.verifyApiKey()`. Existing cron logic files are reused directly. Admin server actions are wrapped into Elysia route handlers — business logic stays in the actions, Elysia handles HTTP concerns.

**Tech Stack:** Elysia, @elysiajs/eden, Better Auth (apiKey plugin), Drizzle ORM, Zod, Bun, Next.js App Router

---

## Task 1: Add Elysia dependencies to package.json

**Files:**
- Modify: `package.json`

**Step 1: Install elysia and eden**

```bash
bun add elysia @elysiajs/eden
```

Expected: `package.json` dependencies now includes `"elysia"` and `"@elysiajs/eden"`.

**Step 2: Verify install**

```bash
bun install && bun run build 2>&1 | tail -5
```

Expected: Build succeeds (no import errors yet since nothing uses them).

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -chore: add elysia and eden dependencies"
```

---

## Task 2: Create shared types for the ext API

**Files:**
- Create: `lib/ext/types.ts`

**Step 1: Write the types file**

```typescript
import type { User } from "@/lib/auth"

export interface ExtApiContext {
    user: User
    apiKeyId: string
}

export interface ExtApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
    code?: string
}

export interface PaginationParams {
    page?: number
    pageSize?: number
}

export interface PaginatedResponse<T> {
    items: T[]
    total: number
    page: number
    pageSize: number
    hasMore: boolean
}
```

**Step 2: Commit**

```bash
git add lib/ext/types.ts
git commit -"feat(ext): add shared types for external API"
```

---

## Task 3: Create API key auth middleware

**Files:**
- Create: `lib/ext/auth.ts`

**Step 1: Write the auth middleware**

This middleware extracts the Bearer token from the Authorization header and validates it using Better Auth's `auth.api.verifyApiKey()`. It also supports `CRON_SECRET` as a fallback for cron endpoints.

```typescript
import { auth } from "@/lib/auth"
import { db } from "@/db"
import { eq } from "drizzle-orm"
import { user as userTable, apikey } from "@/db/schema/auth"
import { profiles } from "@/db/schema"

interface ApiKeyVerification {
    valid: boolean
    userId?: string
    user?: {
        id: string
        name: string
        email: string
        role: string | null
    }
    error?: string
}

/**
 * Verify an API key from the Authorization header.
 * Returns the associated user if valid, or an error.
 */
export async function verifyApiKeyFromHeader(
    authHeader: string | null
): Promise<ApiKeyVerification> {
    if (!authHeader) {
        return { valid: false, error: "Missing Authorization header" }
    }

    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader

    if (!token) {
        return { valid: false, error: "Empty bearer token" }
    }

    try {
        const result = await auth.api.verifyApiKey({
            body: {
                key: token,
            },
        })

        if (!result.valid || !result.key) {
            return { valid: false, error: "Invalid or expired API key" }
        }

        const keyUserId = (result.key as { userId: string }).userId

        // Fetch user + profile to get role
        const userResult = await db
            .select({
                id: userTable.id,
                name: userTable.name,
                email: userTable.email,
                banned: userTable.banned,
                banExpires: userTable.banExpires,
            })
            .from(userTable)
            .where(eq(userTable.id, keyUserId))
            .limit(1)

        const foundUser = userResult[0]
        if (!foundUser) {
            return { valid: false, error: "User not found" }
        }

        // Check if user is banned
        if (foundUser.banned) {
            const banExpired = foundUser.banExpires
                ? new Date(foundUser.banExpires) < new Date()
                : false
            if (!banExpired) {
                return { valid: false, error: "User is banned" }
            }
        }

        // Get role from profiles
        const profileResult = await db
            .select({ role: profiles.role })
            .from(profiles)
            .where(eq(profiles.id, keyUserId))
            .limit(1)

        return {
            valid: true,
            userId: keyUserId,
            user: {
                id: foundUser.id,
                name: foundUser.name,
                email: foundUser.email,
                role: profileResult[0]?.role ?? null,
            },
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { valid: false, error: message }
    }
}

/**
 * Check if a request is using the legacy CRON_SECRET auth.
 * Returns true if the Authorization header matches CRON_SECRET.
 */
export function isCronSecretAuth(authHeader: string | null): boolean {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) return false

    const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader

    return token === cronSecret
}

/**
 * Require admin or moderator role.
 * Call after verifyApiKeyFromHeader succeeds.
 */
export function requireAdminRole(user: { role: string | null }): boolean {
    return user.role === "admin" || user.role === "moderator"
}
```

**Step 2: Write a test for auth middleware**

```typescript
// lib/ext/__tests__/auth.test.ts
import { describe, it, expect } from "bun:test"
import { isCronSecretAuth } from "../auth"

describe("isCronSecretAuth", () => {
    it("returns false when CRON_SECRET is not set", () => {
        delete process.env.CRON_SECRET
        expect(isCronSecretAuth("Bearer something")).toBe(false)
    })

    it("returns true when token matches CRON_SECRET", () => {
        process.env.CRON_SECRET = "test-secret"
        expect(isCronSecretAuth("Bearer test-secret")).toBe(true)
    })

    it("returns true with plain token (no Bearer prefix)", () => {
        process.env.CRON_SECRET = "test-secret"
        expect(isCronSecretAuth("test-secret")).toBe(true)
    })

    it("returns false when token does not match", () => {
        process.env.CRON_SECRET = "test-secret"
        expect(isCronSecretAuth("Bearer wrong-key")).toBe(false)
    })

    it("returns false for null header", () => {
        process.env.CRON_SECRET = "test-secret"
        expect(isCronSecretAuth(null)).toBe(false)
    })
})
```

**Step 3: Run test**

```bash
bun test lib/ext/__tests__/auth.test.ts
```

Expected: All 5 tests pass.

**Step 4: Commit**

```bash
git add lib/ext/auth.ts lib/ext/__tests__/auth.test.ts
git commit -"feat(ext): add API key auth middleware with CRON_SECRET fallback"
```

---

## Task 4: Create health check plugin

**Files:**
- Create: `lib/ext/plugins/health.ts`

**Step 1: Write the health plugin**

```typescript
import { Elysia } from "elysia"

export const healthPlugin = new Elysia({ prefix: "/health" }).get(
    "/",
    () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "grounds-ext-api",
    })
)
```

No auth required for health checks.

**Step 2: Commit**

```bash
git add lib/ext/plugins/health.ts
git commit -"feat(ext): add health check endpoint"
```

---

## Task 5: Create cron plugin (migrate existing cron jobs)

**Files:**
- Create: `lib/ext/plugins/cron.ts`

**Step 1: Write the cron plugin**

Reuses all existing `logic.ts` files from `app/api/cron/daily/`. Supports both API key auth and legacy `CRON_SECRET`.

```typescript
import { Elysia } from "elysia"
import { verifyApiKeyFromHeader, isCronSecretAuth } from "../auth"
import { checkSubscriptions } from "@/app/api/cron/daily/check-subscriptions/logic"
import { updateHiddenGems } from "@/app/api/cron/daily/hidden-gems/logic"
import { runLeaderboardSnapshots } from "@/app/api/cron/daily/leaderboard-snapshots/logic"
import { cleanupSystemLogs } from "@/app/api/cron/daily/system-logs-cleanup/logic"

/**
 * Auth gate for cron endpoints.
 * Accepts either a valid API key or the legacy CRON_SECRET.
 */
async function requireCronAuth(
    authHeader: string | null
): Promise<{ authorized: boolean; error?: string }> {
    if (isCronSecretAuth(authHeader)) {
        console.warn(
            "[ext/cron] CRON_SECRET used for auth. Consider migrating to API keys."
        )
        return { authorized: true }
    }

    const verification = await verifyApiKeyFromHeader(authHeader)
    if (!verification.valid) {
        return { authorized: false, error: verification.error }
    }

    return { authorized: true }
}

export const cronPlugin = new Elysia({ prefix: "/cron" })
    .derive(async ({ request }) => {
        const authHeader = request.headers.get("authorization")
        const auth = await requireCronAuth(authHeader)
        if (!auth.authorized) {
            throw new Error("UNAUTHORIZED")
        }
        return {}
    })
    .onError(({ error, set }) => {
        if (error.message === "UNAUTHORIZED") {
            set.status = 401
            return { error: "Unauthorized", code: "UNAUTHORIZED" }
        }
        set.status = 500
        return {
            error: "Internal server error",
            code: "INTERNAL_ERROR",
        }
    })
    .get("/daily", async () => {
        const results: Record<string, unknown> = {}
        const errors: string[] = []

        try {
            results.subscriptions = await checkSubscriptions()
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            results.subscriptions = { error: msg }
            errors.push(`subscriptions: ${msg}`)
        }

        try {
            results.hiddenGems = await updateHiddenGems()
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            results.hiddenGems = { error: msg }
            errors.push(`hiddenGems: ${msg}`)
        }

        try {
            results.leaderboard = await runLeaderboardSnapshots()
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            results.leaderboard = { error: msg }
            errors.push(`leaderboard: ${msg}`)
        }

        try {
            results.logCleanup = await cleanupSystemLogs()
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            results.logCleanup = { error: msg }
            errors.push(`logCleanup: ${msg}`)
        }

        if (errors.length > 0) {
            return { ok: true, partialSuccess: true, results, errors }
        }

        return { ok: true, results }
    })
    .get("/subscriptions", async () => {
        const result = await checkSubscriptions()
        return { ok: true, result }
    })
    .get("/hidden-gems", async () => {
        const result = await updateHiddenGems()
        return { ok: true, result }
    })
    .get("/leaderboard", async () => {
        const result = await runLeaderboardSnapshots()
        return { ok: true, result }
    })
    .get("/log-cleanup", async () => {
        const result = await cleanupSystemLogs()
        return { ok: true, result }
    })
```

**Step 2: Run existing tests to verify nothing breaks**

```bash
bun test
```

Expected: All existing tests pass.

**Step 3: Commit**

```bash
git add lib/ext/plugins/cron.ts
git commit -"feat(ext): add cron endpoints, reuse existing logic files"
```

---

## Task 6: Create Elysia app + Next.js catch-all route

**Files:**
- Create: `lib/ext/app.ts`
- Create: `app/api/ext/[...path]/route.ts`

**Step 1: Write the Elysia app**

This is the main app that mounts all plugins. Each plugin group will be added as we build them. Start with health + cron.

```typescript
import { Elysia } from "elysia"
import { healthPlugin } from "./plugins/health"
import { cronPlugin } from "./plugins/cron"

export const extApp = new Elysia({ prefix: "/api/ext" })
    .onRequest(({ request }) => {
        const url = new URL(request.url)
        console.log(`[ext] ${request.method} ${url.pathname}`)
    })
    .onAfterHandle(({ request }, response) => {
        const url = new URL(request.url)
        console.log(
            `[ext] ${request.method} ${url.pathname} -> 200`
        )
        return response
    })
    .onError(({ error, set, request }) => {
        const url = new URL(request.url)
        const message =
            error instanceof Error ? error.message : String(error)

        console.error(
            `[ext] ${request.method} ${url.pathname} ERROR: ${message}`
        )

        if (message === "UNAUTHORIZED") {
            set.status = 401
            return { error: "Unauthorized", code: "UNAUTHORIZED" }
        }

        set.status = 500
        return {
            error: "Internal server error",
            code: "INTERNAL_ERROR",
        }
    })
    .use(healthPlugin)
    .use(cronPlugin)

export type ExtApp = typeof extApp
```

**Step 2: Write the Next.js catch-all route handler**

```typescript
import { extApp } from "@/lib/ext/app"
import { NextRequest, NextResponse } from "next/server"

// Convert Next.js request to a standard Request, then pass to Elysia.
// Elysia handles its own routing internally via the prefix.

async function handler(request: NextRequest) {
    // Elysia expects a standard Web Request, NextRequest extends it.
    // Create a new URL with the full path so Elysia can route internally.
    const response = await extApp.handle(request)

    // Elysia returns a standard Response; convert to NextResponse
    return new NextResponse(response.body, {
        status: response.status,
        headers: response.headers,
    })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
```

**Step 3: Test the health endpoint manually**

```bash
bun dev &
sleep 5
curl -s http://localhost:3000/api/ext/health | jq
```

Expected: `{ "status": "ok", "timestamp": "...", "service": "grounds-ext-api" }`

**Step 4: Test a cron endpoint with CRON_SECRET**

```bash
curl -s http://localhost:3000/api/ext/cron/daily \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

Expected: `{ "ok": true, "results": { ... } }` or partial success.

**Step 5: Verify 401 on unauthorized request**

```bash
curl -s http://localhost:3000/api/ext/cron/daily | jq
```

Expected: `{ "error": "Unauthorized", "code": "UNAUTHORIZED" }`

**Step 6: Commit**

```bash
git add lib/ext/app.ts app/api/ext/\[...path\]/route.ts
git commit -"feat(ext): add Elysia app and Next.js catch-all route handler"
```

---

## Task 7: Create cafe read endpoints (list + get)

**Files:**
- Create: `lib/ext/plugins/cafes.ts`

**Step 1: Write the cafes plugin (read endpoints)**

Wraps the existing `getPaginatedCafes` and `getCafeById` logic. These already live in `app/api/actions/admin.ts` and do DB queries — but they use `getCurrentUser()` which depends on Next.js `headers()`. We need to inline the queries or extract shared logic.

Strategy: Create thin wrappers that replicate the DB queries (same as the server actions) but accept the user ID as a parameter instead of reading from cookies.

```typescript
import { Elysia } from "elysia"
import { db } from "@/db"
import {
    cafes,
    cafeRatingStats,
    profiles,
} from "@/db/schema"
import { eq, and, or, desc, asc, ilike, count as drizzleCount, isNull, inArray } from "drizzle-orm"
import { verifyApiKeyFromHeader, requireAdminRole } from "../auth"

// Auth middleware for all cafe routes
function cafeAuthPlugin() {
    return new Elysia().derive(async ({ request, set }) => {
        const authHeader = request.headers.get("authorization")
        const verification = await verifyApiKeyFromHeader(authHeader)

        if (!verification.valid || !verification.user) {
            set.status = 401
            throw new Error("UNAUTHORIZED")
        }

        if (!requireAdminRole(verification.user)) {
            set.status = 403
            throw new Error("FORBIDDEN")
        }

        return { authUser: verification.user }
    }).onError(({ error, set }) => {
        if (error.message === "UNAUTHORIZED") {
            set.status = 401
            return { error: "Unauthorized", code: "UNAUTHORIZED" }
        }
        if (error.message === "FORBIDDEN") {
            set.status = 403
            return { error: "Forbidden — admin or moderator role required", code: "FORBIDDEN" }
        }
        set.status = 500
        return { error: "Internal server error", code: "INTERNAL_ERROR" }
    })
}

export const cafesPlugin = new Elysia({ prefix: "/cafes" })
    .use(cafeAuthPlugin())
    .get("/", async ({ query }) => {
        const page = Math.max(1, parseInt(query.page ?? "1") || 1)
        const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? "25") || 25))
        const search = query.search ?? undefined
        const province = query.province ?? undefined
        const city = query.city ?? undefined
        const sortBy = query.sortBy ?? "name"
        const sortOrder = query.sortOrder ?? "asc"
        const published = query.published !== "false" // default true
        const chainFilter = query.chainFilter ?? "all"

        const conditions = [eq(cafes.isPublished, published)]

        if (province) conditions.push(eq(cafes.province, province))
        if (city) conditions.push(eq(cafes.cityMunicipality, city))

        if (search?.trim()) {
            const term = `%${search.trim()}%`
            conditions.push(
                or(
                    ilike(cafes.name, term),
                    ilike(cafes.addressDisplay, term),
                    ilike(cafes.cityMunicipality, term),
                    ilike(cafes.province, term)
                )!
            )
        }

        if (chainFilter === "chains_only") {
            conditions.push(eq(cafes.isChain, true))
        } else if (chainFilter === "exclude_chains") {
            conditions.push(or(eq(cafes.isChain, false), isNull(cafes.isChain))!)
        }

        const whereClause = and(...conditions)

        const totalResult = await db
            .select({ count: drizzleCount() })
            .from(cafes)
            .where(whereClause)
        const total = totalResult[0]?.count ?? 0

        const sortFn = sortOrder === "asc" ? asc : desc
        let orderByColumn = cafes.name
        if (sortBy === "date") orderByColumn = cafes.createdAt
        else if (sortBy === "city") orderByColumn = cafes.cityMunicipality
        else if (sortBy === "province") orderByColumn = cafes.province

        const offset = (page - 1) * pageSize
        const items = await db
            .select()
            .from(cafes)
            .where(whereClause)
            .orderBy(sortFn(orderByColumn))
            .limit(pageSize)
            .offset(offset)

        return {
            success: true,
            data: {
                items: items.map(c => ({ ...c, createdAt: c.createdAt?.toISOString(), updatedAt: c.updatedAt?.toISOString() })),
                total,
                page,
                pageSize,
                hasMore: offset + pageSize < total,
            },
        }
    })
    .get("/:id", async ({ params, set }) => {
        const result = await db
            .select()
            .from(cafes)
            .where(eq(cafes.id, params.id))
            .limit(1)

        const cafe = result[0]
        if (!cafe) {
            set.status = 404
            return { error: "Cafe not found", code: "NOT_FOUND" }
        }

        const ratings = await db
            .select()
            .from(cafeRatingStats)
            .where(eq(cafeRatingStats.cafeId, params.id))
            .limit(1)

        return {
            success: true,
            data: {
                ...cafe,
                createdAt: cafe.createdAt?.toISOString(),
                updatedAt: cafe.updatedAt?.toISOString(),
                ratings: ratings[0] ?? null,
            },
        }
    })
```

**Step 2: Mount cafesPlugin in app.ts**

```typescript
// lib/ext/app.ts — add after cronPlugin
import { cafesPlugin } from "./plugins/cafes"
// ... existing code ...
    .use(cafesPlugin)
```

**Step 3: Test list endpoint**

```bash
curl -s "http://localhost:3000/api/ext/cafes?page=1&pageSize=5" \
  -H "Authorization: Bearer $API_KEY" | jq '.data.total'
```

Expected: Returns cafe count and first 5 items.

**Step 4: Commit**

```bash
git add lib/ext/plugins/cafes.ts lib/ext/app.ts
git commit -"feat(ext): add cafe list and get endpoints"
```

---

## Task 8: Add cafe write endpoints (update, approve, reject, delete)

**Files:**
- Modify: `lib/ext/plugins/cafes.ts`

**Step 1: Add PATCH /:id, POST /:id/approve, POST /:id/reject, DELETE /:id**

Append to the existing `cafesPlugin` chain after the `get("/:id")` route:

```typescript
    .patch("/:id", async ({ params, body, authUser, set }) => {
        // Validate cafe exists
        const existing = await db
            .select({ id: cafes.id })
            .from(cafes)
            .where(eq(cafes.id, params.id))
            .limit(1)

        if (!existing[0]) {
            set.status = 404
            return { error: "Cafe not found", code: "NOT_FOUND" }
        }

        // Map snake_case body keys to camelCase Drizzle columns
        const fieldMap: Record<string, string> = {
            name: "name",
            description: "description",
            address_display: "addressDisplay",
            area: "area",
            lat: "lat",
            lng: "lng",
            has_wifi: "hasWifi",
            has_smoking: "hasSmoking",
            has_sockets: "hasSockets",
            has_parking: "hasParking",
            has_aircon: "hasAircon",
            is_pet_friendly: "isPetFriendly",
            has_outdoor_seating: "hasOutdoorSeating",
            has_indoor_seating: "hasIndoorSeating",
            has_restroom: "hasRestroom",
            has_bidet: "hasBidet",
            has_non_dairy: "hasNonDairy",
            milk_options: "milkOptions",
            serves_food: "servesFood",
            is_work_friendly: "isWorkFriendly",
            price_level: "priceLevel",
            specialty: "specialty",
            tags: "tags",
            brew_methods: "brewMethods",
            payment_methods: "paymentMethods",
            roaster: "roaster",
            operating_hours: "operatingHours",
            website_url: "websiteUrl",
            phone: "phone",
            email: "email",
            socials: "socials",
            thumbnail: "thumbnail",
            gallery: "gallery",
            slug: "slug",
            is_verified: "isVerified",
            owner_ids: "ownerIds",
            is_hidden_gem: "isHiddenGem",
            finding_hint: "findingHint",
            is_chain: "isChain",
            is_halal_certified: "isHalalCertified",
            straw_type: "strawType",
            straw_type_other: "strawTypeOther",
        }

        const updates: Record<string, unknown> = { updatedAt: new Date() }
        for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
            if (value !== undefined) {
                updates[fieldMap[key] || key] = value
            }
        }

        await db.update(cafes).set(updates).where(eq(cafes.id, params.id))
        return { success: true }
    })
    .post("/:id/approve", async ({ params, set }) => {
        const existing = await db
            .select({ id: cafes.id, isPublished: cafes.isPublished })
            .from(cafes)
            .where(eq(cafes.id, params.id))
            .limit(1)

        if (!existing[0]) {
            set.status = 404
            return { error: "Cafe not found", code: "NOT_FOUND" }
        }

        await db
            .update(cafes)
            .set({ isPublished: true, updatedAt: new Date() })
            .where(eq(cafes.id, params.id))

        return { success: true }
    })
    .post("/:id/reject", async ({ params, body, set }) => {
        const existing = await db
            .select({ id: cafes.id })
            .from(cafes)
            .where(eq(cafes.id, params.id))
            .limit(1)

        if (!existing[0]) {
            set.status = 404
            return { error: "Cafe not found", code: "NOT_FOUND" }
        }

        // body.reason is optional
        const reason = (body as { reason?: string })?.reason

        // For now, just unpublish. Full deletion logic (images, etc.) can be added later.
        await db
            .update(cafes)
            .set({ isPublished: false, updatedAt: new Date() })
            .where(eq(cafes.id, params.id))

        return { success: true, reason: reason ?? null }
    })
    .delete("/:id", async ({ params, set }) => {
        const existing = await db
            .select({ id: cafes.id })
            .from(cafes)
            .where(eq(cafes.id, params.id))
            .limit(1)

        if (!existing[0]) {
            set.status = 404
            return { error: "Cafe not found", code: "NOT_FOUND" }
        }

        await db.delete(cafes).where(eq(cafes.id, params.id))
        return { success: true }
    })
    .post("/bulk-chain", async ({ body, set }) => {
        const { cafeIds, isChain } = body as {
            cafeIds: string[]
            isChain: boolean
        }

        if (!cafeIds?.length) {
            set.status = 400
            return { error: "No cafe IDs provided", code: "BAD_REQUEST" }
        }

        await db
            .update(cafes)
            .set({ isChain, updatedAt: new Date() })
            .where(inArray(cafes.id, cafeIds))

        return { success: true, count: cafeIds.length }
    })
```

**Step 2: Test PATCH endpoint**

```bash
curl -s -X PATCH "http://localhost:3000/api/ext/cafes/<cafe-uuid>" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated via ext API"}' | jq
```

Expected: `{ "success": true }`

**Step 3: Commit**

```bash
git add lib/ext/plugins/cafes.ts
git commit -"feat(ext): add cafe update, approve, reject, delete, bulk-chain endpoints"
```

---

## Task 9: Add cafe filter options endpoint

**Files:**
- Modify: `lib/ext/plugins/cafes.ts`

**Step 1: Add GET /filter-options**

Append to the plugin chain:

```typescript
    .get("/filter-options", async () => {
        const provincesResult = await db
            .selectDistinct({ province: cafes.province })
            .from(cafes)
            .where(eq(cafes.isPublished, true))
            .orderBy(asc(cafes.province))

        const provinces = provincesResult
            .map((p) => p.province)
            .filter(Boolean) as string[]

        const citiesResult = await db
            .selectDistinct({
                province: cafes.province,
                city: cafes.cityMunicipality,
            })
            .from(cafes)
            .where(eq(cafes.isPublished, true))
            .orderBy(asc(cafes.province), asc(cafes.cityMunicipality))

        const citiesMap = new Map<string, string[]>()
        for (const row of citiesResult) {
            if (row.province && row.city) {
                if (!citiesMap.has(row.province))
                    citiesMap.set(row.province, [])
                citiesMap.get(row.province)!.push(row.city)
            }
        }

        const cities = Array.from(citiesMap.entries()).map(
            ([province, cityList]) => ({ province, cities: cityList })
        )

        const publishedCount = await db
            .select({ count: drizzleCount() })
            .from(cafes)
            .where(eq(cafes.isPublished, true))

        const pendingCount = await db
            .select({ count: drizzleCount() })
            .from(cafes)
            .where(eq(cafes.isPublished, false))

        return {
            success: true,
            data: {
                provinces,
                cities,
                totalPublished: publishedCount[0]?.count ?? 0,
                totalPending: pendingCount[0]?.count ?? 0,
            },
        }
    })
```

**Step 2: Commit**

```bash
git add lib/ext/plugins/cafes.ts
git commit -"feat(ext): add cafe filter options endpoint"
```

---

## Task 10: Create subscriptions plugin

**Files:**
- Create: `lib/ext/plugins/subscriptions.ts`

**Step 1: Write the subscriptions plugin**

Exposes manual subscription listing, verification, and rejection. Mirrors `getManualSubscriptions`, `verifyManualPayment`, `rejectManualPayment` from `app/api/actions/admin.ts`.

```typescript
import { Elysia } from "elysia"
import { db } from "@/db"
import { cafes, cafeSubscriptions, profiles, user as userTable } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { verifyApiKeyFromHeader, requireAdminRole } from "../auth"
import { sendSubscriptionApprovedEmail } from "@/utils/email"

function subscriptionAuthPlugin() {
    return new Elysia().derive(async ({ request, set }) => {
        const authHeader = request.headers.get("authorization")
        const verification = await verifyApiKeyFromHeader(authHeader)
        if (!verification.valid || !verification.user) {
            set.status = 401
            throw new Error("UNAUTHORIZED")
        }
        if (!requireAdminRole(verification.user)) {
            set.status = 403
            throw new Error("FORBIDDEN")
        }
        return { authUser: verification.user }
    }).onError(({ error, set }) => {
        if (error.message === "UNAUTHORIZED") {
            set.status = 401
            return { error: "Unauthorized", code: "UNAUTHORIZED" }
        }
        if (error.message === "FORBIDDEN") {
            set.status = 403
            return { error: "Forbidden", code: "FORBIDDEN" }
        }
        set.status = 500
        return { error: "Internal server error", code: "INTERNAL_ERROR" }
    })
}

export const subscriptionsPlugin = new Elysia({ prefix: "/subscriptions" })
    .use(subscriptionAuthPlugin())
    .get("/", async () => {
        const result = await db
            .select({
                id: cafeSubscriptions.id,
                cafeId: cafeSubscriptions.cafeId,
                tier: cafeSubscriptions.tier,
                status: cafeSubscriptions.status,
                helixSubscriptionId: cafeSubscriptions.helixSubscriptionId,
                currentPeriodStart: cafeSubscriptions.currentPeriodStart,
                currentPeriodEnd: cafeSubscriptions.currentPeriodEnd,
                isManualPayment: cafeSubscriptions.isManualPayment,
                paymentVerified: cafeSubscriptions.paymentVerified,
                proofOfPaymentUrl: cafeSubscriptions.proofOfPaymentUrl,
                createdAt: cafeSubscriptions.createdAt,
                updatedAt: cafeSubscriptions.updatedAt,
                cafeName: cafes.name,
                cafeSlug: cafes.slug,
            })
            .from(cafeSubscriptions)
            .leftJoin(cafes, eq(cafeSubscriptions.cafeId, cafes.id))
            .where(eq(cafeSubscriptions.isManualPayment, true))
            .orderBy(desc(cafeSubscriptions.createdAt))

        return {
            success: true,
            data: result.map((s) => ({
                ...s,
                currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
                currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
                createdAt: s.createdAt?.toISOString() ?? null,
                updatedAt: s.updatedAt?.toISOString() ?? null,
            })),
        }
    })
    .post("/:cafeId/:id/verify", async ({ params, set }) => {
        const sub = await db
            .select({
                tier: cafeSubscriptions.tier,
                proofOfPaymentUrl: cafeSubscriptions.proofOfPaymentUrl,
                cafeName: cafes.name,
                cafeSlug: cafes.slug,
                ownerIds: cafes.ownerIds,
            })
            .from(cafeSubscriptions)
            .leftJoin(cafes, eq(cafeSubscriptions.cafeId, cafes.id))
            .where(
                and(
                    eq(cafeSubscriptions.id, params.id),
                    eq(cafeSubscriptions.cafeId, params.cafeId)
                )
            )
            .limit(1)

        if (!sub[0]) {
            set.status = 404
            return { error: "Subscription not found", code: "NOT_FOUND" }
        }

        // Update subscription status
        await db
            .update(cafeSubscriptions)
            .set({
                paymentVerified: true,
                status: "active",
                proofOfPaymentUrl: null,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(cafeSubscriptions.id, params.id),
                    eq(cafeSubscriptions.cafeId, params.cafeId)
                )
            )

        // Update cafe tier
        await db
            .update(cafes)
            .set({
                membershipTier: sub[0].tier,
                isVerified: true,
                updatedAt: new Date(),
            })
            .where(eq(cafes.id, params.cafeId))

        return { success: true }
    })
    .post("/:cafeId/:id/reject", async ({ params, body, set }) => {
        const sub = await db
            .select({ id: cafeSubscriptions.id })
            .from(cafeSubscriptions)
            .where(
                and(
                    eq(cafeSubscriptions.id, params.id),
                    eq(cafeSubscriptions.cafeId, params.cafeId)
                )
            )
            .limit(1)

        if (!sub[0]) {
            set.status = 404
            return { error: "Subscription not found", code: "NOT_FOUND" }
        }

        const reason = (body as { reason?: string })?.reason

        await db
            .update(cafeSubscriptions)
            .set({
                status: "cancelled",
                paymentVerified: false,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(cafeSubscriptions.id, params.id),
                    eq(cafeSubscriptions.cafeId, params.cafeId)
                )
            )

        return { success: true, reason: reason ?? null }
    })
```

**Step 2: Mount in app.ts**

```typescript
import { subscriptionsPlugin } from "./plugins/subscriptions"
// ... in extApp chain:
    .use(subscriptionsPlugin)
```

**Step 3: Commit**

```bash
git add lib/ext/plugins/subscriptions.ts lib/ext/app.ts
git commit -"feat(ext): add subscription management endpoints"
```

---

## Task 11: Create users plugin

**Files:**
- Create: `lib/ext/plugins/users.ts`

**Step 1: Write the users plugin**

Exposes user listing, profile lookup, role updates, and ban/unban.

```typescript
import { Elysia } from "elysia"
import { db } from "@/db"
import { user as userTable } from "@/db/schema/auth"
import { profiles } from "@/db/schema"
import { eq, and, ilike, desc, asc, count as drizzleCount } from "drizzle-orm"
import { verifyApiKeyFromHeader, requireAdminRole } from "../auth"

function userAuthPlugin() {
    return new Elysia().derive(async ({ request, set }) => {
        const authHeader = request.headers.get("authorization")
        const verification = await verifyApiKeyFromHeader(authHeader)
        if (!verification.valid || !verification.user) {
            set.status = 401
            throw new Error("UNAUTHORIZED")
        }
        if (!requireAdminRole(verification.user)) {
            set.status = 403
            throw new Error("FORBIDDEN")
        }
        return { authUser: verification.user }
    }).onError(({ error, set }) => {
        if (error.message === "UNAUTHORIZED") {
            set.status = 401
            return { error: "Unauthorized", code: "UNAUTHORIZED" }
        }
        if (error.message === "FORBIDDEN") {
            set.status = 403
            return { error: "Forbidden", code: "FORBIDDEN" }
        }
        set.status = 500
        return { error: "Internal server error", code: "INTERNAL_ERROR" }
    })
}

export const usersPlugin = new Elysia({ prefix: "/users" })
    .use(userAuthPlugin())
    .get("/", async ({ query }) => {
        const page = Math.max(1, parseInt(query.page ?? "1") || 1)
        const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? "25") || 25))
        const search = query.search ?? undefined
        const role = query.role ?? undefined
        const sort = query.sort ?? "newest"

        const conditions = []
        if (search?.trim()) {
            const term = `%${search.trim()}%`
            conditions.push(ilike(userTable.name, term))
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined

        const totalResult = await db
            .select({ count: drizzleCount() })
            .from(userTable)
            .where(whereClause)
        const total = totalResult[0]?.count ?? 0

        const orderFn = sort === "oldest" ? asc : desc
        const offset = (page - 1) * pageSize

        const users = await db
            .select({
                id: userTable.id,
                name: userTable.name,
                email: userTable.email,
                emailVerified: userTable.emailVerified,
                image: userTable.image,
                role: userTable.role,
                banned: userTable.banned,
                createdAt: userTable.createdAt,
                lastSignInAt: userTable.lastSignInAt,
            })
            .from(userTable)
            .where(whereClause)
            .orderBy(orderFn(userTable.createdAt))
            .limit(pageSize)
            .offset(offset)

        // Get profile data for these users
        const userIds = users.map(u => u.id)
        const profileData = userIds.length > 0
            ? await db
                .select({
                    id: profiles.id,
                    username: profiles.username,
                    displayName: profiles.displayName,
                    role: profiles.role,
                    isSupporter: profiles.isSupporter,
                })
                .from(profiles)
                .where(
                    userIds.length === 1
                        ? eq(profiles.id, userIds[0])
                        : eq(profiles.id, userIds[0]) // fallback; use inArray for multiple
                )
            : []

        // Build role filter result if specified
        let items = users.map(u => {
            const profile = profileData.find(p => p.id === u.id)
            return {
                ...u,
                createdAt: u.createdAt?.toISOString(),
                lastSignInAt: u.lastSignInAt?.toISOString() ?? null,
                profile: profile ?? null,
            }
        })

        if (role) {
            items = items.filter(u => u.role === role || u.profile?.role === role)
        }

        return {
            success: true,
            data: {
                items,
                total,
                page,
                pageSize,
                hasMore: offset + pageSize < total,
            },
        }
    })
    .get("/:id", async ({ params, set }) => {
        const result = await db
            .select({
                id: userTable.id,
                name: userTable.name,
                email: userTable.email,
                emailVerified: userTable.emailVerified,
                image: userTable.image,
                role: userTable.role,
                banned: userTable.banned,
                banReason: userTable.banReason,
                banExpires: userTable.banExpires,
                createdAt: userTable.createdAt,
                updatedAt: userTable.updatedAt,
                lastSignInAt: userTable.lastSignInAt,
            })
            .from(userTable)
            .where(eq(userTable.id, params.id))
            .limit(1)

        const foundUser = result[0]
        if (!foundUser) {
            set.status = 404
            return { error: "User not found", code: "NOT_FOUND" }
        }

        const profile = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, params.id))
            .limit(1)

        return {
            success: true,
            data: {
                ...foundUser,
                createdAt: foundUser.createdAt?.toISOString(),
                updatedAt: foundUser.updatedAt?.toISOString(),
                banExpires: foundUser.banExpires?.toISOString() ?? null,
                lastSignInAt: foundUser.lastSignInAt?.toISOString() ?? null,
                profile: profile[0] ?? null,
            },
        }
    })
    .patch("/:id/role", async ({ params, body, set }) => {
        const { role } = body as { role: string }

        if (!["admin", "moderator", "writer", "user"].includes(role)) {
            set.status = 400
            return { error: "Invalid role", code: "BAD_REQUEST" }
        }

        // Update both user table and profiles table
        await db.update(userTable).set({ role }).where(eq(userTable.id, params.id))
        await db.update(profiles).set({ role }).where(eq(profiles.id, params.id))

        return { success: true }
    })
    .post("/:id/ban", async ({ params, body, set }) => {
        const { reason, expiresAt } = body as {
            reason?: string
            expiresAt?: string
        }

        const existing = await db
            .select({ id: userTable.id })
            .from(userTable)
            .where(eq(userTable.id, params.id))
            .limit(1)

        if (!existing[0]) {
            set.status = 404
            return { error: "User not found", code: "NOT_FOUND" }
        }

        await db
            .update(userTable)
            .set({
                banned: true,
                banReason: reason ?? null,
                banExpires: expiresAt ? new Date(expiresAt) : null,
            })
            .where(eq(userTable.id, params.id))

        return { success: true }
    })
    .post("/:id/unban", async ({ params, set }) => {
        const existing = await db
            .select({ id: userTable.id })
            .from(userTable)
            .where(eq(userTable.id, params.id))
            .limit(1)

        if (!existing[0]) {
            set.status = 404
            return { error: "User not found", code: "NOT_FOUND" }
        }

        await db
            .update(userTable)
            .set({
                banned: false,
                banReason: null,
                banExpires: null,
            })
            .where(eq(userTable.id, params.id))

        return { success: true }
    })
```

**Step 2: Mount in app.ts**

```typescript
import { usersPlugin } from "./plugins/users"
// ... in extApp chain:
    .use(usersPlugin)
```

**Step 3: Commit**

```bash
git add lib/ext/plugins/users.ts lib/ext/app.ts
git commit -"feat(ext): add user management endpoints"
```

---

## Task 12: Create settings plugin

**Files:**
- Create: `lib/ext/plugins/settings.ts`

**Step 1: Write the settings plugin**

Exposes site settings and feature flags read/write.

```typescript
import { Elysia } from "elysia"
import { db } from "@/db"
import { siteSettings } from "@/db/schema"
import { featureFlags } from "@/db/schema"
import { eq } from "drizzle-orm"
import { verifyApiKeyFromHeader, requireAdminRole } from "../auth"

function settingsAuthPlugin() {
    return new Elysia().derive(async ({ request, set }) => {
        const authHeader = request.headers.get("authorization")
        const verification = await verifyApiKeyFromHeader(authHeader)
        if (!verification.valid || !verification.user) {
            set.status = 401
            throw new Error("UNAUTHORIZED")
        }
        if (!requireAdminRole(verification.user)) {
            set.status = 403
            throw new Error("FORBIDDEN")
        }
        return { authUser: verification.user }
    }).onError(({ error, set }) => {
        if (error.message === "UNAUTHORIZED") {
            set.status = 401
            return { error: "Unauthorized", code: "UNAUTHORIZED" }
        }
        if (error.message === "FORBIDDEN") {
            set.status = 403
            return { error: "Forbidden", code: "FORBIDDEN" }
        }
        set.status = 500
        return { error: "Internal server error", code: "INTERNAL_ERROR" }
    })
}

export const settingsPlugin = new Elysia({ prefix: "/settings" })
    .use(settingsAuthPlugin())
    .get("/", async () => {
        const settings = await db
            .select({ key: siteSettings.key, value: siteSettings.value })
            .from(siteSettings)
            .orderBy(siteSettings.key)

        return {
            success: true,
            data: Object.fromEntries(
                settings.map((s) => [s.key, s.value])
            ),
        }
    })
    .get("/:key", async ({ params, set }) => {
        const result = await db
            .select({ key: siteSettings.key, value: siteSettings.value })
            .from(siteSettings)
            .where(eq(siteSettings.key, params.key))
            .limit(1)

        if (!result[0]) {
            set.status = 404
            return { error: "Setting not found", code: "NOT_FOUND" }
        }

        return { success: true, data: result[0] }
    })
    .patch("/:key", async ({ params, body, set }) => {
        const { value } = body as { value: string }

        if (value === undefined) {
            set.status = 400
            return { error: "Missing value", code: "BAD_REQUEST" }
        }

        // Upsert the setting
        const existing = await db
            .select({ key: siteSettings.key })
            .from(siteSettings)
            .where(eq(siteSettings.key, params.key))
            .limit(1)

        if (existing[0]) {
            await db
                .update(siteSettings)
                .set({ value, updatedAt: new Date() })
                .where(eq(siteSettings.key, params.key))
        } else {
            await db.insert(siteSettings).values({
                key: params.key,
                value,
                updatedAt: new Date(),
            })
        }

        return { success: true }
    })

// Feature flags sub-plugin
export const featureFlagsPlugin = new Elysia({ prefix: "/feature-flags" })
    .use(settingsAuthPlugin())
    .get("/", async () => {
        const flags = await db
            .select()
            .from(featureFlags)
            .orderBy(featureFlags.key)

        return {
            success: true,
            data: flags.map((f) => ({
                key: f.key,
                enabled: f.enabled,
            })),
        }
    })
    .patch("/:key", async ({ params, body, set }) => {
        const { enabled } = body as { enabled: boolean }

        if (enabled === undefined) {
            set.status = 400
            return { error: "Missing enabled field", code: "BAD_REQUEST" }
        }

        const existing = await db
            .select({ key: featureFlags.key })
            .from(featureFlags)
            .where(eq(featureFlags.key, params.key))
            .limit(1)

        if (existing[0]) {
            await db
                .update(featureFlags)
                .set({ enabled })
                .where(eq(featureFlags.key, params.key))
        } else {
            await db.insert(featureFlags).values({
                key: params.key,
                enabled,
            })
        }

        return { success: true }
    })
```

**Step 2: Mount in app.ts**

```typescript
import { settingsPlugin, featureFlagsPlugin } from "./plugins/settings"
// ... in extApp chain:
    .use(settingsPlugin)
    .use(featureFlagsPlugin)
```

**Step 3: Commit**

```bash
git add lib/ext/plugins/settings.ts lib/ext/app.ts
git commit -"feat(ext): add settings and feature flags endpoints"
```

---

## Task 13: Create analytics plugin

**Files:**
- Create: `lib/ext/plugins/analytics.ts`

**Step 1: Write the analytics plugin**

Exposes dashboard stats and system logs. The admin stats logic is in `app/api/actions/admin-stats.ts` — we replicate the core queries here.

```typescript
import { Elysia } from "elysia"
import { db } from "@/db"
import { cafes, profiles, reviews, systemLogs } from "@/db/schema"
import { count as drizzleCount, desc, eq, gte } from "drizzle-orm"
import { verifyApiKeyFromHeader, requireAdminRole } from "../auth"

function analyticsAuthPlugin() {
    return new Elysia().derive(async ({ request, set }) => {
        const authHeader = request.headers.get("authorization")
        const verification = await verifyApiKeyFromHeader(authHeader)
        if (!verification.valid || !verification.user) {
            set.status = 401
            throw new Error("UNAUTHORIZED")
        }
        if (!requireAdminRole(verification.user)) {
            set.status = 403
            throw new Error("FORBIDDEN")
        }
        return { authUser: verification.user }
    }).onError(({ error, set }) => {
        if (error.message === "UNAUTHORIZED") {
            set.status = 401
            return { error: "Unauthorized", code: "UNAUTHORIZED" }
        }
        if (error.message === "FORBIDDEN") {
            set.status = 403
            return { error: "Forbidden", code: "FORBIDDEN" }
        }
        set.status = 500
        return { error: "Internal server error", code: "INTERNAL_ERROR" }
    })
}

export const analyticsPlugin = new Elysia({ prefix: "/analytics" })
    .use(analyticsAuthPlugin())
    .get("/dashboard", async () => {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const [
            totalCafes,
            publishedCafes,
            pendingCafes,
            totalUsers,
            totalReviews,
            recentReviews,
        ] = await Promise.all([
            db.select({ count: drizzleCount() }).from(cafes),
            db.select({ count: drizzleCount() }).from(cafes).where(eq(cafes.isPublished, true)),
            db.select({ count: drizzleCount() }).from(cafes).where(eq(cafes.isPublished, false)),
            db.select({ count: drizzleCount() }).from(profiles),
            db.select({ count: drizzleCount() }).from(reviews),
            db.select({ count: drizzleCount() }).from(reviews).where(gte(reviews.createdAt, thirtyDaysAgo)),
        ])

        return {
            success: true,
            data: {
                totalCafes: totalCafes[0]?.count ?? 0,
                publishedCafes: publishedCafes[0]?.count ?? 0,
                pendingCafes: pendingCafes[0]?.count ?? 0,
                totalUsers: totalUsers[0]?.count ?? 0,
                totalReviews: totalReviews[0]?.count ?? 0,
                recentReviews: recentReviews[0]?.count ?? 0,
            },
        }
    })
    .get("/logs", async ({ query }) => {
        const page = Math.max(1, parseInt(query.page ?? "1") || 1)
        const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? "50") || 50))
        const offset = (page - 1) * pageSize

        const totalResult = await db
            .select({ count: drizzleCount() })
            .from(systemLogs)

        const total = totalResult[0]?.count ?? 0

        const logs = await db
            .select()
            .from(systemLogs)
            .orderBy(desc(systemLogs.createdAt))
            .limit(pageSize)
            .offset(offset)

        return {
            success: true,
            data: {
                items: logs.map((l) => ({
                    ...l,
                    createdAt: l.createdAt?.toISOString(),
                })),
                total,
                page,
                pageSize,
                hasMore: offset + pageSize < total,
            },
        }
    })
```

**Step 2: Mount in app.ts**

```typescript
import { analyticsPlugin } from "./plugins/analytics"
// ... in extApp chain:
    .use(analyticsPlugin)
```

**Step 3: Commit**

```bash
git add lib/ext/plugins/analytics.ts lib/ext/app.ts
git commit -"feat(ext): add analytics and system logs endpoints"
```

---

## Task 14: Finalize Elysia app with all plugins + lint

**Files:**
- Modify: `lib/ext/app.ts`

**Step 1: Verify app.ts has all plugins mounted**

Read `lib/ext/app.ts` and confirm all plugins are imported and used:

```typescript
import { Elysia } from "elysia"
import { healthPlugin } from "./plugins/health"
import { cronPlugin } from "./plugins/cron"
import { cafesPlugin } from "./plugins/cafes"
import { subscriptionsPlugin } from "./plugins/subscriptions"
import { usersPlugin } from "./plugins/users"
import { settingsPlugin, featureFlagsPlugin } from "./plugins/settings"
import { analyticsPlugin } from "./plugins/analytics"

export const extApp = new Elysia({ prefix: "/api/ext" })
    .onRequest(({ request }) => {
        const url = new URL(request.url)
        console.log(`[ext] ${request.method} ${url.pathname}`)
    })
    .onAfterHandle(({ request }) => {
        const url = new URL(request.url)
        console.log(`[ext] ${request.method} ${url.pathname} -> 200`)
    })
    .onError(({ error, set, request }) => {
        const url = new URL(request.url)
        const message =
            error instanceof Error ? error.message : String(error)
        console.error(
            `[ext] ${request.method} ${url.pathname} ERROR: ${message}`
        )
        if (message === "UNAUTHORIZED") {
            set.status = 401
            return { error: "Unauthorized", code: "UNAUTHORIZED" }
        }
        if (message === "FORBIDDEN") {
            set.status = 403
            return { error: "Forbidden", code: "FORBIDDEN" }
        }
        set.status = 500
        return { error: "Internal server error", code: "INTERNAL_ERROR" }
    })
    .use(healthPlugin)
    .use(cronPlugin)
    .use(cafesPlugin)
    .use(subscriptionsPlugin)
    .use(usersPlugin)
    .use(settingsPlugin)
    .use(featureFlagsPlugin)
    .use(analyticsPlugin)

export type ExtApp = typeof extApp
```

**Step 2: Run lint**

```bash
bun lint
```

Expected: No errors. Fix any that appear.

**Step 3: Run build**

```bash
bun build
```

Expected: Build succeeds.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -"chore(ext): finalize plugin wiring and fix lint issues"
```

---

## Task 15: Write integration tests + update old cron route

**Files:**
- Create: `lib/ext/__tests__/api.test.ts`
- Modify: `app/api/cron/daily/route.ts`

**Step 1: Write integration test for the ext API**

Test the Elysia app handle directly (no HTTP needed):

```typescript
import { describe, it, expect } from "bun:test"
import { extApp } from "../app"

describe("ext API", () => {
    it("GET /api/ext/health returns ok", async () => {
        const res = await extApp.handle(
            new Request("http://localhost/api/ext/health")
        )
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.status).toBe("ok")
        expect(body.service).toBe("grounds-ext-api")
    })

    it("GET /api/ext/cron/daily returns 401 without auth", async () => {
        const res = await extApp.handle(
            new Request("http://localhost/api/ext/cron/daily")
        )
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body.error).toBe("Unauthorized")
    })

    it("GET /api/ext/cafes returns 401 without auth", async () => {
        const res = await extApp.handle(
            new Request("http://localhost/api/ext/cafes")
        )
        expect(res.status).toBe(401)
    })

    it("GET /api/ext/nonexistent returns 404 or handled error", async () => {
        const res = await extApp.handle(
            new Request("http://localhost/api/ext/nonexistent")
        )
        // Elysia returns 404 for unmatched routes
        expect([404, 500]).toContain(res.status)
    })
})
```

**Step 2: Run tests**

```bash
bun test lib/ext/__tests__/api.test.ts
```

Expected: All 4 tests pass.

**Step 3: Add deprecation comment to old cron route**

Add a comment to `app/api/cron/daily/route.ts`:

```typescript
/**
 * @deprecated Use /api/ext/cron/daily instead.
 * This route is kept for backward compatibility with existing cron schedulers.
 * Both API key auth (via /api/ext) and CRON_SECRET (via this route) are supported.
 * When all schedulers are migrated, remove this route.
 */
```

**Step 4: Run full test suite**

```bash
bun test
```

Expected: All tests pass, including new ext API tests.

**Step 5: Final commit**

```bash
git add lib/ext/__tests__/api.test.ts app/api/cron/daily/route.ts
git commit -"test(ext): add integration tests and deprecate old cron route"
```

---

## Summary

**Files created:**
- `lib/ext/app.ts` — Elysia app instance, mounts all plugins
- `lib/ext/auth.ts` — API key verification middleware
- `lib/ext/types.ts` — Shared types
- `lib/ext/plugins/health.ts` — Health check
- `lib/ext/plugins/cron.ts` — Cron job endpoints
- `lib/ext/plugins/cafes.ts` — Cafe management CRUD
- `lib/ext/plugins/subscriptions.ts` — Subscription management
- `lib/ext/plugins/users.ts` — User management
- `lib/ext/plugins/settings.ts` — Settings + feature flags
- `lib/ext/plugins/analytics.ts` — Dashboard stats + logs
- `lib/ext/__tests__/auth.test.ts` — Auth middleware tests
- `lib/ext/__tests__/api.test.ts` — Integration tests
- `app/api/ext/[...path]/route.ts` — Next.js catch-all route handler

**Files modified:**
- `package.json` — Added elysia, @elysiajs/eden
- `app/api/cron/daily/route.ts` — Deprecation comment

**Endpoint summary:**
- `GET /api/ext/health` — No auth
- `GET /api/ext/cron/*` — API key or CRON_SECRET auth
- `GET/PATCH/DELETE /api/ext/cafes/*` — API key auth (admin/mod)
- `GET/POST /api/ext/subscriptions/*` — API key auth (admin/mod)
- `GET/PATCH/POST /api/ext/users/*` — API key auth (admin/mod)
- `GET/PATCH /api/ext/settings/*` — API key auth (admin/mod)
- `GET /api/ext/feature-flags` — API key auth (admin/mod)
- `GET /api/ext/analytics/*` — API key auth (admin/mod)

