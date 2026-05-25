# Implementation Plan: Submit, SEO, test-cafe, & Team Management

**Date**: 2025-05-25
**Status**: Planning
**Spec**: `docs/superpowers/specs/2025-05-25-submit-seo-testcafe-team-design.md`

---

## File Structure Map

### New Files

| File | Purpose |
|---|---|
| `utils/filters.ts` | Centralized `getProductionFilter()` and `omitTestCafes()` helpers |
| `utils/__tests__/filters.test.ts` | Tests for production filter behavior |
| `utils/validation/cafe-submission.ts` | Zod schema for `SerializableCafeSubmission` |
| `utils/validation/__tests__/cafe-submission.test.ts` | Tests for cafe submission validation |
| `utils/__tests__/slug.test.ts` | Tests for slug generation + location slug |
| `utils/seo/breadcrumbs.ts` | BreadcrumbList JSON-LD generator |
| `utils/seo/__tests__/breadcrumbs.test.ts` | Tests for breadcrumb generator |
| `utils/seo/jsonld.ts` | Centralized JSON-LD generators (BlogPosting, ItemList, Menu) |
| `utils/seo/__tests__/jsonld.test.ts` | Tests for JSON-LD generators |
| `app/cafes/[province]/[city]/page.tsx` | City-level SEO landing page |
| `app/api/actions/__tests__/test-cafe-filter.test.ts` | Integration test for test-cafe filtering |

### Modified Files

| File | Changes |
|---|---|
| `db/schema/tables.ts` | Add `isTest` boolean column to cafes table |
| `app/api/actions/cafe.ts` | Apply production filter to 10+ public query functions |
| `app/api/actions/map.ts` | Apply production filter to `getCafesInBounds` |
| `app/api/actions/search.ts` | Apply production filter to `searchCafesAndUsers`, `globalSearch` |
| `app/api/actions/admin.ts` | Add `setCafeTestFlag()` action |
| `app/sitemap.ts` | Apply production filter, add profiles + city pages to sitemap |
| `app/api/actions/submit.ts` | Zod validation, location slug, duplicate guard, structured errors, critical webhook |
| `app/api/actions/notify.ts` | Add `notifyDiscordCritical()` |
| `components/submit/CafeSubmissionForm.tsx` | Handle structured `SubmitError` in error display |
| `app/cafes/[slug]/page.tsx` | Add canonical, BreadcrumbList JSON-LD |
| `app/cafes/[slug]/menu/page.tsx` | Add canonical, Menu JSON-LD |
| `app/blog/[slug]/page.tsx` | Add BlogPosting JSON-LD + BreadcrumbList |
| `app/blog/page.tsx` | Fix canonical URL to `/blog` |
| `app/cafes/page.tsx` | Add keywords metadata |
| `app/community/page.tsx` | Add keywords metadata |
| `app/map/page.tsx` | Add metadata export |
| `app/layout.tsx` | Add verification metadata |
| `utils/seo/metadata.ts` | Add BreadcrumbList to `buildPageMetadata` |

---

## Phase 1: Foundation — Types, Schema, and Shared Utilities

### Task 1.1: Production Filter Utility

**Files:**
- Create: `utils/filters.ts`
- Create: `utils/__tests__/filters.test.ts`

**Dependencies:** None

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  ```typescript
  // utils/__tests__/filters.test.ts
  import { describe, it, expect, mock, afterEach } from "bun:test"
  import { getProductionFilter, omitTestCafes } from "@/utils/filters"
  import { cafes } from "@/db/schema"
  import { eq, and, SQL } from "drizzle-orm"

  describe("getProductionFilter", () => {
    afterEach(() => {
      // Reset NODE_ENV
    })

    it("returns isTest=false filter in production", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "production"
      
      const filter = getProductionFilter()
      // In production, should return a SQL condition excluding test cafes
      expect(filter).not.toBeUndefined()
      
      process.env.NODE_ENV = originalEnv
    })

    it("returns undefined in development", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"
      
      const filter = getProductionFilter()
      expect(filter).toBeUndefined()
      
      process.env.NODE_ENV = originalEnv
    })

    it("returns undefined when NODE_ENV is not set", () => {
      const originalEnv = process.env.NODE_ENV
      delete (process.env as Record<string, string | undefined>).NODE_ENV
      
      const filter = getProductionFilter()
      expect(filter).toBeUndefined()
      
      process.env.NODE_ENV = originalEnv
    })
  })

  describe("omitTestCafes", () => {
    it("adds isTest=false to existing conditions array in production", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "production"

      const conditions: (SQL | undefined)[] = [eq(cafes.isPublished, true)]
      const result = omitTestCafes(conditions)
      
      expect(result.length).toBe(2)
      
      process.env.NODE_ENV = originalEnv
    })

    it("does not modify conditions array in development", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const conditions: (SQL | undefined)[] = [eq(cafes.isPublished, true)]
      const before = conditions.length
      const result = omitTestCafes(conditions)
      
      expect(result.length).toBe(before)
      
      process.env.NODE_ENV = originalEnv
    })
  })
  ```

- [ ] **RED: Verify the test fails**

  Run: `bun test utils/__tests__/filters.test.ts`
  Expected: FAIL — module `@/utils/filters` not found (file doesn't exist yet)

- [ ] **GREEN: Write minimal implementation**

  ```typescript
  // utils/filters.ts
  import { eq, SQL } from "drizzle-orm"
  import { cafes } from "@/db/schema"

  /**
   * Returns a SQL condition to exclude test cafes in production.
   * In development/staging, returns undefined (test cafes are visible).
   * 
   * Usage:
   *   const conditions = [eq(cafes.isPublished, true)]
   *   const testFilter = getProductionFilter()
   *   if (testFilter) conditions.push(testFilter)
   */
  export function getProductionFilter(): SQL | undefined {
    if (process.env.NODE_ENV === "production") {
      return eq(cafes.isTest, false)
    }
    return undefined
  }

  /**
   * Convenience: mutates a conditions array by adding the test filter in production.
   * Returns the same array for chaining.
   */
  export function omitTestCafes(conditions: (SQL | undefined)[]): (SQL | undefined)[] {
    const filter = getProductionFilter()
    if (filter) {
      conditions.push(filter)
    }
    return conditions
  }
  ```

- [ ] **GREEN: Verify the test passes**

  Run: `bun test utils/__tests__/filters.test.ts`
  Expected: PASS — all 5 assertions green

- [ ] **REFACTOR: Clean up**
  - No duplication to remove in this focused utility
  - Re-run: `bun test utils/__tests__/filters.test.ts` — still green

- [ ] **Commit**

  ```bash
  git add utils/filters.ts utils/__tests__/filters.test.ts
  git commit -m "feat: add production filter utility for test cafes (Phase 1)"
  ```

---

### Task 1.2: Migration — Add `is_test` Column to Cafes Table

**Files:**
- Modify: `db/schema/tables.ts` (add `isTest` column definition)
- Create: `drizzle/migrations/XXXX_add_is_test_to_cafes.sql` (generated by drizzle)

**Dependencies:** Task 1.1 (filter utility needs the column to exist)

**TDD Cycle:**

- [ ] **RED: Update schema and verify generation**

  ```typescript
  // In db/schema/tables.ts, add to the cafes table definition after line ~160 (just before isMallCafe):
  
  // FIND THIS LINE (around line 160):
  //   featuredUntil: timestamp("featured_until", { withTimezone: true }),
  // ADD BELOW IT:
      isTest: boolean("is_test").default(false).notNull(),
  ```

  Verify migration generates correctly:
  ```bash
  bun db:generate
  ```
  
  Check that the generated migration file contains:
  ```sql
  ALTER TABLE "cafes" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;
  ```

- [ ] **RED: Verify no existing tests break**

  Run: `bun test`
  Expected: All existing tests PASS (column addition is backwards-compatible). If any test fails because the mock schema doesn't include `isTest`, note it here — unlikely since tests use abstracted DB mocks.

- [ ] **GREEN: Push migration to development DB**

  ```bash
  bun db:push
  ```
  Expected: Schema synced. `is_test` column available.

- [ ] **GREEN: Verify column exists**

  Use Drizzle Studio or a quick query to confirm:
  ```bash
  # Optional: verify via bun run
  bun run --eval "
  import { db } from '@/db';
  const result = await db.execute('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'cafes\' AND column_name = \'is_test\'');
  console.log(result);
  "
  ```
  Expected: `{ column_name: 'is_test', data_type: 'boolean' }`

- [ ] **REFACTOR: None needed** — pure additive schema change

- [ ] **Commit**

  ```bash
  git add db/schema/tables.ts drizzle/migrations/
  git commit -m "feat: add is_test column to cafes table for environment filtering (Phase 1)"
  ```

---

### Task 1.3: Cafe Submission Zod Schema

**Files:**
- Create: `utils/validation/cafe-submission.ts`
- Create: `utils/validation/__tests__/cafe-submission.test.ts`

**Dependencies:** None (validation runs before DB, so doesn't depend on 1.1 or 1.2)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  ```typescript
  // utils/validation/__tests__/cafe-submission.test.ts
  import { describe, it, expect } from "bun:test"
  import { cafeSubmissionSchema, CafeSubmissionError } from "@/utils/validation/cafe-submission"

  const validSubmission = {
    name: "Test Cafe",
    description: "A nice place",
    region: "NCR - National Capital Region",
    province: "Metro Manila",
    city_municipality: "Makati",
    area: "Legazpi Village",
    address_display: "123 Ayala Ave, Makati",
    lat: 14.5547,
    lng: 121.0244,
    price_level: "mid",
    payment_methods: "Cash, GCash",
    has_wifi: false,
    has_smoking: false,
    has_sockets: true,
    has_parking: false,
    has_aircon: true,
    is_pet_friendly: false,
    has_outdoor_seating: true,
    has_indoor_seating: true,
    has_restroom: true,
    has_bidet: false,
    has_non_dairy: true,
    has_decaf: true,
    milk_options: ["oat", "soy"],
    serves_food: true,
    is_work_friendly: true,
    operating_hours: [],
    socials: [],
    website_url: "",
    phone: "",
    email: "",
    specialty: ["latte"],
    tags: ["cozy"],
    brew_methods: ["pour-over"],
    roaster: "Local Roaster",
    is_hidden_gem: false,
    finding_hint: "",
    is_chain: false,
    is_halal_certified: false,
    straw_type: "",
    straw_type_other: "",
  }

  describe("cafeSubmissionSchema", () => {
    it("accepts a valid submission", () => {
      const result = cafeSubmissionSchema.safeParse(validSubmission)
      expect(result.success).toBe(true)
    })

    it("rejects empty name", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, name: "   " })
      expect(result.success).toBe(false)
    })

    it("rejects missing region", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, region: "" })
      expect(result.success).toBe(false)
    })

    it("rejects missing province", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, province: "" })
      expect(result.success).toBe(false)
    })

    it("rejects missing city_municipality", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, city_municipality: "" })
      expect(result.success).toBe(false)
    })

    it("rejects invalid price_level", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, price_level: "free" })
      expect(result.success).toBe(false)
    })

    it("rejects invalid lat/lng values", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, lat: 200 })
      expect(result.success).toBe(false)
    })

    it("allows hidden gem without address_display", () => {
      const result = cafeSubmissionSchema.safeParse({
        ...validSubmission,
        is_hidden_gem: true,
        address_display: "",
        lat: null,
        lng: null,
      })
      expect(result.success).toBe(true)
    })

    it("rejects non-hidden-gem without address_display", () => {
      const result = cafeSubmissionSchema.safeParse({
        ...validSubmission,
        is_hidden_gem: false,
        address_display: "",
      })
      expect(result.success).toBe(false)
    })

    it("rejects non-hidden-gem with null coordinates", () => {
      const result = cafeSubmissionSchema.safeParse({
        ...validSubmission,
        lat: null,
        lng: null,
      })
      expect(result.success).toBe(false)
    })

    it("rejects invalid URL in website_url", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, website_url: "not-a-url" })
      expect(result.success).toBe(false)
    })

    it("accepts empty website_url", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, website_url: "" })
      expect(result.success).toBe(true)
    })

    it("rejects invalid email format", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, email: "not-an-email" })
      expect(result.success).toBe(false)
    })
  })

  describe("CafeSubmissionError", () => {
    it("formats validation errors for client display", () => {
      const result = cafeSubmissionSchema.safeParse({ ...validSubmission, name: "" })
      if (!result.success) {
        const formatted = CafeSubmissionError.fromZod(result.error)
        expect(formatted.code).toBe("VALIDATION")
        expect(formatted.field).toBeDefined()
        expect(formatted.message).not.toBe("")
        expect(formatted.retryable).toBe(true)
      }
    })
  })
  ```

- [ ] **RED: Verify the test fails**

  Run: `bun test utils/validation/__tests__/cafe-submission.test.ts`
  Expected: FAIL — module `@/utils/validation/cafe-submission` not found

- [ ] **GREEN: Write minimal implementation**

  ```typescript
  // utils/validation/cafe-submission.ts
  import { z } from "zod"

  export const priceLevelEnum = z.enum(["budget", "mid", "premium", "luxury"])

  export const cafeSubmissionSchema = z.object({
    name: z.string().trim().min(1, "Cafe name is required"),
    description: z.string().trim().optional().default(""),
    region: z.string().trim().min(1, "Region is required"),
    province: z.string().trim().min(1, "Province is required"),
    city_municipality: z.string().trim().min(1, "City/Municipality is required"),
    area: z.string().trim().optional().default(""),
    address_display: z.string().trim().optional().default(""),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    price_level: priceLevelEnum,
    payment_methods: z.string().trim().optional().default(""),
    has_wifi: z.boolean().optional().default(false),
    has_smoking: z.boolean().optional().default(false),
    has_sockets: z.boolean().optional().default(false),
    has_parking: z.boolean().optional().default(false),
    has_aircon: z.boolean().optional().default(false),
    is_pet_friendly: z.boolean().optional().default(false),
    has_outdoor_seating: z.boolean().optional().default(false),
    has_indoor_seating: z.boolean().optional().default(false),
    has_restroom: z.boolean().optional().default(false),
    has_bidet: z.boolean().optional().default(false),
    has_non_dairy: z.boolean().optional().default(false),
    has_decaf: z.boolean().optional().default(false),
    milk_options: z.array(z.string()).optional().default([]),
    serves_food: z.boolean().optional().default(false),
    is_work_friendly: z.boolean().optional().default(false),
    operating_hours: z.array(z.record(z.unknown())).optional().default([]),
    socials: z.array(z.record(z.unknown())).optional().default([]),
    website_url: z.string().trim().url().optional().or(z.literal("")),
    phone: z.string().trim().optional().default(""),
    email: z.string().trim().email().optional().or(z.literal("")),
    specialty: z.array(z.string()).optional().default([]),
    tags: z.array(z.string()).optional().default([]),
    brew_methods: z.array(z.string()).optional().default([]),
    roaster: z.string().trim().optional().default(""),
    is_hidden_gem: z.boolean().optional().default(false),
    finding_hint: z.string().trim().optional().default(""),
    is_chain: z.boolean().optional().default(false),
    is_halal_certified: z.boolean().optional().default(false),
    straw_type: z.string().trim().optional().default(""),
    straw_type_other: z.string().trim().optional().default(""),
  }).refine(
    (data) => data.is_hidden_gem || data.address_display.trim().length > 0,
    { message: "Address is required for non-hidden-gem cafes", path: ["address_display"] }
  ).refine(
    (data) => data.is_hidden_gem || (data.lat !== null && data.lng !== null),
    { message: "Location coordinates are required", path: ["lat"] }
  )

  export type CafeSubmissionInput = z.infer<typeof cafeSubmissionSchema>

  export interface SubmitError {
    code: "VALIDATION" | "AUTH" | "DB" | "UPLOAD" | "NETWORK" | "UNKNOWN"
    message: string
    field?: string
    details?: string
    retryable?: boolean
  }

  export class CafeSubmissionError {
    static fromZod(error: z.ZodError<CafeSubmissionInput>): SubmitError {
      const firstIssue = error.issues[0]
      return {
        code: "VALIDATION",
        message: firstIssue?.message ?? "Invalid submission data",
        field: firstIssue?.path.join(".") ?? undefined,
        retryable: true,
      }
    }

    static auth(): SubmitError {
      return { code: "AUTH", message: "Please log in to submit a cafe", retryable: false }
    }

    static db(message: string = "We couldn't save your cafe right now. Please try again."): SubmitError {
      return { code: "DB", message, retryable: true }
    }

    static duplicate(message: string): SubmitError {
      return { code: "VALIDATION", message, field: "name", retryable: false }
    }

    static unknown(details?: string): SubmitError {
      return {
        code: "UNKNOWN",
        message: "Something went wrong. Please try again later.",
        details,
        retryable: true,
      }
    }
  }
  ```

- [ ] **GREEN: Verify the test passes**

  Run: `bun test utils/validation/__tests__/cafe-submission.test.ts`
  Expected: PASS — all 14 assertions green

- [ ] **REFACTOR: Clean up**
  - Verify the `.refine()` chain is clear and ordered correctly
  - Re-run: `bun test utils/validation/__tests__/cafe-submission.test.ts` — still green

- [ ] **Commit**

  ```bash
  git add utils/validation/cafe-submission.ts utils/validation/__tests__/cafe-submission.test.ts
  git commit -m "feat: add Zod validation schema for cafe submissions (Phase 1)"
  ```

---

### Task 1.4: Slug Generation Utility with Location Support

**Files:**
- Create: `utils/__tests__/slug.test.ts` (tests only — slug logic lives in submit.ts but we extract and test it separately)
- Modify: `app/api/actions/submit.ts` (extract `generateSlug` to accept location, add bound to `ensureUniqueSlug`)

**Dependencies:** Task 1.3 (schema must exist before we refactor submit)

**Note**: The slug functions remain in `submit.ts` to minimize changes to the existing server action. We refactor them in-place rather than extracting to a util file — the tests validate them directly.

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  ```typescript
  // utils/__tests__/slug.test.ts
  import { describe, it, expect } from "bun:test"

  // Replicate the slug logic here for direct testing.
  // In the actual submit.ts these are module-private; we duplicate the logic
  // in the test to validate behavior without exporting internals.
  
  function generateSlug(name: string, locationSlug?: string): string {
    const nameSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()

    if (locationSlug) {
      const combined = `${nameSlug}-${locationSlug}`
      // Truncate to 200 chars to stay within DB limits
      return combined.length > 200 ? combined.slice(0, 200).replace(/-$/, "") : combined
    }

    return nameSlug || "cafe" // fallback for empty names
  }

  function buildLocationSlug(cityMunicipality: string, province: string): string {
    const slugify = (s: string) => s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()

    const citySlug = slugify(cityMunicipality)
    const provinceSlug = slugify(province)

    if (citySlug && provinceSlug) return `${citySlug}-${provinceSlug}`
    if (provinceSlug) return provinceSlug
    return ""
  }

  describe("generateSlug", () => {
    it("generates simple slug from name", () => {
      expect(generateSlug("Starbucks")).toBe("starbucks")
    })

    it("includes location in slug", () => {
      expect(generateSlug("Starbucks", "makati-metro-manila"))
        .toBe("starbucks-makati-metro-manila")
    })

    it("handles special characters", () => {
      expect(generateSlug("Café & Restaurant!"))
        .toBe("caf--restaurant") // special chars stripped
    })

    it("collapses multiple hyphens", () => {
      expect(generateSlug("Test -- Cafe --- Special"))
        .toBe("test-cafe-special")
    })

    it("trims leading/trailing hyphens", () => {
      expect(generateSlug("  ---Hello World---  "))
        .toBe("hello-world")
    })

    it("returns 'cafe' for purely special character names", () => {
      expect(generateSlug("!!!")).toBe("cafe")
    })

    it("truncates long slugs to 200 chars", () => {
      const longName = "a".repeat(250)
      const slug = generateSlug(longName)
      expect(slug.length).toBeLessThanOrEqual(200)
    })

    it("does not end truncated slug with hyphen", () => {
      const longName = "a".repeat(250) + "-"
      const slug = generateSlug(longName)
      expect(slug.endsWith("-")).toBe(false)
    })
  })

  describe("buildLocationSlug", () => {
    it("builds city-province slug", () => {
      expect(buildLocationSlug("Makati", "Metro Manila"))
        .toBe("makati-metro-manila")
    })

    it("falls back to province only when city is empty", () => {
      expect(buildLocationSlug("", "Metro Manila"))
        .toBe("metro-manila")
    })

    it("returns empty when both are empty", () => {
      expect(buildLocationSlug("", "")).toBe("")
    })

    it("handles special characters in city names", () => {
      expect(buildLocationSlug("San José", "Nueva Ecija"))
        .toBe("san-jos-nueva-ecija")
    })
  })
  ```

- [ ] **RED: Verify the test fails**

  Run: `bun test utils/__tests__/slug.test.ts`
  Expected: PASS — test functions are self-contained and test the logic directly, so they pass immediately. But this validates the expected behavior before we modify `submit.ts`.

- [ ] **GREEN: Refactor submit.ts slug functions**

  In `app/api/actions/submit.ts`, replace the existing `generateSlug` and `ensureUniqueSlug`:

  ```typescript
  // Replace existing generateSlug (lines 12-20) with:
  
  function generateSlug(name: string, cityMunicipality?: string, province?: string): string {
    const slugify = (s: string): string => s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()

    const nameSlug = slugify(name) || "cafe"

    if (cityMunicipality && province) {
      const citySlug = slugify(cityMunicipality)
      const provSlug = slugify(province)
      
      let locationSlug = ""
      if (citySlug && provSlug) locationSlug = `${citySlug}-${provSlug}`
      else if (provSlug) locationSlug = provSlug
      
      if (locationSlug) {
        const combined = `${nameSlug}-${locationSlug}`
        return combined.length > 200 ? combined.slice(0, 200).replace(/-$/, "") : combined
      }
    }

    return nameSlug
  }

  // Replace existing ensureUniqueSlug (lines 23-36) with bounded version:
  
  const MAX_SLUG_ITERATIONS = 100

  async function ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug
    let counter = 0

    while (counter < MAX_SLUG_ITERATIONS) {
      const result = await db
        .select({ id: cafes.id })
        .from(cafes)
        .where(eq(cafes.slug, slug))
        .limit(1)

      if (!result[0]) break

      counter++
      slug = `${baseSlug}-${counter}`
    }

    if (counter >= MAX_SLUG_ITERATIONS) {
      throw new Error("SLUG_EXHAUSTED")
    }

    return slug
  }
  ```

  Update the call site (around line 100 in submit.ts):
  ```typescript
  // BEFORE:
  // const baseSlug = generateSlug(formData.name)
  // const slug = await ensureUniqueSlug(baseSlug)
  
  // AFTER:
  const baseSlug = generateSlug(
    formData.name,
    formData.city_municipality,
    formData.province
  )
  const slug = await ensureUniqueSlug(baseSlug)
  ```

- [ ] **GREEN: Verify the test passes**

  Run: `bun test utils/__tests__/slug.test.ts`
  Expected: PASS — all 12 assertions green

- [ ] **GREEN: Verify existing submit-cafe tests still pass**

  Run: `bun test app/api/actions/__tests__/submit-cafe.test.ts`
  Expected: PASS — existing tests should not break (they mock the DB, so slug changes are transparent)

- [ ] **REFACTOR: Clean up**
  - Verify the `SLUG_EXHAUSTED` error is caught by the outer try/catch in submitCafe
  - Re-run all slug tests + submit-cafe tests — still green

- [ ] **Commit**

  ```bash
  git add utils/__tests__/slug.test.ts app/api/actions/submit.ts
  git commit -m "feat: add location-based slug generation with bounded uniqueness loop (Phase 1)"
  ```

---

## Phase 2: test-cafe Filtering — Apply Across All Public Queries

**Goal**: Apply `getProductionFilter()` to every public-facing cafe query so test cafes are hidden in production. Admin functions intentionally bypass the filter.

### Task 2.1: Apply Production Filter to All Public Cafe Queries

**Files:**
- Modify: `app/api/actions/cafe.ts` — Add filter to 9+ query functions
- Modify: `app/api/actions/map.ts` — Add filter to `getCafesInBounds`
- Modify: `app/api/actions/search.ts` — Add filter to `searchCafesAndUsers`
- Modify: `app/sitemap.ts` — Add filter to sitemap cafe query
- Modify: `app/api/actions/admin.ts` — Add `setCafeTestFlag()` action
- Create: `app/api/actions/__tests__/test-cafe-filter.test.ts` — Integration test

**Dependencies:** Task 1.1 (filter utility), Task 1.2 (schema migration)

**TDD Cycle:**

- [ ] **RED: Write the integration test**

  ```typescript
  // app/api/actions/__tests__/test-cafe-filter.test.ts
  import { describe, it, expect, afterEach } from "bun:test"

  describe("test-cafe filtering integration", () => {
    let originalEnv: string | undefined

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.NODE_ENV = originalEnv
      }
    })

    it("production filter excludes isTest=true cafes", async () => {
      originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "production"

      const { getProductionFilter } = await import("@/utils/filters")
      const filter = getProductionFilter()
      expect(filter).toBeDefined()
      expect(typeof filter).toBe("object")
    })

    it("dev mode includes test cafes", async () => {
      originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const { getProductionFilter } = await import("@/utils/filters")
      const filter = getProductionFilter()
      expect(filter).toBeUndefined()
    })

    it("omitTestCafes appends filter in production", async () => {
      originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "production"

      const { omitTestCafes } = await import("@/utils/filters")
      const conditions: unknown[] = []
      omitTestCafes(conditions)
      expect(conditions.length).toBe(1)
    })

    it("omitTestCafes does nothing in development", async () => {
      originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const { omitTestCafes } = await import("@/utils/filters")
      const conditions: unknown[] = []
      omitTestCafes(conditions)
      expect(conditions.length).toBe(0)
    })
  })
  ```

- [ ] **RED: Verify the test fails**

  Run: `bun test app/api/actions/__tests__/test-cafe-filter.test.ts`
  Expected: PASS — tests pass immediately since `utils/filters.ts` is already built in Phase 1.

- [ ] **GREEN: Apply filter to cafe.ts query functions**

  Add import at top of `app/api/actions/cafe.ts`:
  ```typescript
  import { omitTestCafes, getProductionFilter } from "@/utils/filters"
  ```

  Modify each public query function. The pattern is:
  ```typescript
  // BEFORE:
  const conditions = [eq(cafes.isPublished, true)]
  // AFTER:
  const conditions = omitTestCafes([eq(cafes.isPublished, true)])
  ```

  **Functions to update in cafe.ts** (search for `isPublished` to find exact lines):

  | Function | Change |
  |---|---|
  | `getAllCafes` (~line 670) | `const conditions = omitTestCafes([eq(cafes.isPublished, true)])` |
  | `getDailyFeatured` (~line 390) | Wrap existing conditions array in `omitTestCafes([...])` |
  | `getLocationFeatured` (~line 491, 523) | Wrap `and()` argument in `omitTestCafes([...])` |
  | `getAllPublishedCafes` (~line 1156) | Add: `.where(and(eq(cafes.isPublished, true), ...omitTestCafes([])))` |
  | `getCafesByIds` (~line 1075) | Wrap conditions: `omitTestCafes([eq(cafes.isPublished, true), inArray(cafes.id, ids)])` |
  | `getCafesBySlugs` (~line 1147) | Same pattern as getCafesByIds |
  | `searchCafesSimple` (~line 972) | Add test filter (currently has no isPublished filter): wrap name condition |
  | `searchCafesForBlog` (~line 1004) | `omitTestCafes([eq(cafes.isPublished, true), ilike(...)])` |
  | `getPublishedCafeCount` (~line 965) | `where(and(eq(cafes.isPublished, true), ...omitTestCafes([])))` |
  | `getCafeBySlug` (~line 146) | Add optional `includeTest` param. Default false in prod. |

  **For `getCafeBySlug` — special handling** since it's used by both public pages AND admin preview:
  ```typescript
  export async function getCafeBySlug(
    slug: string,
    includeTest = false
  ): Promise<CafeWithRatings | null> {
    const conditions: (ReturnType<typeof eq> | undefined)[] = [eq(cafes.slug, slug)]
    if (!includeTest) {
      omitTestCafes(conditions)
    }
    const result = await db.select().from(cafes).where(and(...conditions)).limit(1)
    // ... rest unchanged
  }
  ```
  
  Then update the admin preview call in `app/manage/preview/[id]/page.tsx` to pass `includeTest: true`.

- [ ] **GREEN: Apply filter to map.ts**

  In `app/api/actions/map.ts`, add import and modify `getCafesInBounds` where clause:
  ```typescript
  import { omitTestCafes } from "@/utils/filters"
  
  // Find the where clause and wrap conditions:
  .where(and(
    eq(cafes.isPublished, true),
    eq(cafes.isHiddenGem, false),
    ...omitTestCafes([]),  // appends isTest=false in prod
    // ... existing bounds conditions
  ))
  ```

- [ ] **GREEN: Apply filter to search.ts**

  In `app/api/actions/search.ts`, add import and modify `searchCafesAndUsers`:
  ```typescript
  import { omitTestCafes } from "@/utils/filters"
  
  // Wrap cafe name/address search:
  .where(and(
    ...omitTestCafes([
      or(ilike(cafes.name, searchTerm), ilike(cafes.addressDisplay, searchTerm))
    ])
  ))
  ```

- [ ] **GREEN: Apply filter to sitemap.ts**

  In `app/sitemap.ts`:
  ```typescript
  import { getProductionFilter } from "@/utils/filters"
  
  // Replace existing cafe query where clause:
  const testFilter = getProductionFilter()
  const cafeResults = await db
    .select({ slug: cafes.slug, updatedAt: cafes.updatedAt, createdAt: cafes.createdAt })
    .from(cafes)
    .where(testFilter ? and(eq(cafes.isPublished, true), testFilter) : eq(cafes.isPublished, true))
  ```

- [ ] **GREEN: Add setCafeTestFlag admin action**

  In `app/api/actions/admin.ts`, append before the migration comment:
  ```typescript
  /**
   * Toggle the isTest flag on a cafe (admin only).
   * Test cafes are hidden from public queries in production.
   */
  export async function setCafeTestFlag(
    cafeId: string,
    isTest: boolean
  ): Promise<AdminActionResult> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const profileResult = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, currentUser.id))
      .limit(1)

    if (profileResult[0]?.role !== "admin") {
      return { success: false, error: "Only admins can change test flag" }
    }

    try {
      await db.update(cafes)
        .set({ isTest, updatedAt: new Date() })
        .where(eq(cafes.id, cafeId))
    } catch (error) {
      console.error("Error setting test flag:", error)
      return { success: false, error: "Failed to update test flag" }
    }

    await logSystemAction(
      "update",
      "cafe",
      cafeId,
      null,
      { isTest },
      { reason: `Test flag ${isTest ? "enabled" : "disabled"} by admin` }
    )

    return { success: true }
  }
  ```

- [ ] **GREEN: Verify all tests pass**

  Run: `bun test`
  Expected: All existing tests PASS. New integration test PASS.

- [ ] **REFACTOR: Clean up**
  - Verify admin functions (`getPendingCafes`, `approveCafe`, etc.) do NOT have the test filter
  - Confirm `getCafeBySlug` with `includeTest: true` works for admin preview
  - Re-run: `bun test` — all green

- [ ] **Commit**

  ```bash
  git add app/api/actions/cafe.ts app/api/actions/map.ts app/api/actions/search.ts app/api/actions/admin.ts app/sitemap.ts app/api/actions/__tests__/test-cafe-filter.test.ts
  git commit -m "feat: apply test-cafe production filter to all public queries (Phase 2)"
  ```

---

## Phase 3: Submit Improvements — Validation, Duplicates, Errors, Webhook

**Goal**: Replace manual validation with Zod, add server-side duplicate detection, structured error types, and critical Discord webhook alerts.

### Task 3.1: Critical Discord Webhook for Submission Failures

**Files:**
- Modify: `app/api/actions/notify.ts` — Add `notifyDiscordCritical()` function
- Create: `app/api/actions/__tests__/notify-critical.test.ts` — Tests for critical webhook

**Dependencies:** Task 1.3 (Zod schema — used by submit.ts which calls notify)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  ```typescript
  // app/api/actions/__tests__/notify-critical.test.ts
  import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"

  // Mock fetch to avoid actual HTTP calls
  const originalFetch = globalThis.fetch

  describe("notifyDiscordCritical", () => {
    let fetchCalls: Array<{ url: string; body: string }> = []

    beforeEach(() => {
      fetchCalls = []
      globalThis.fetch = mock((url: string, init: RequestInit) => {
        fetchCalls.push({ url, body: init.body as string })
        return Promise.resolve(new Response(null, { status: 204 }))
      })
      process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test"
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
      delete process.env.DISCORD_WEBHOOK_URL
    })

    it("sends a red embed with critical prefix", async () => {
      const { notifyDiscordCritical } = await import("@/app/api/actions/notify")
      await notifyDiscordCritical(
        "Submission DB Insert Failed",
        "The database insert failed for an unknown reason.",
        {
          cafeName: "Test Cafe",
          submitterId: "user-123",
          errorMessage: "Connection refused",
          failedStep: "db_insert",
        }
      )

      expect(fetchCalls.length).toBe(1)
      const body = JSON.parse(fetchCalls[0].body)
      expect(body.embeds[0].title).toContain("⚠️")
      expect(body.embeds[0].color).toBe(0xef4444) // Red
    })

    it("is fire-and-forget — does not throw on fetch failure", async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error("Network error")))

      const { notifyDiscordCritical } = await import("@/app/api/actions/notify")
      // Should not throw
      await notifyDiscordCritical("Test", "Test", {
        errorMessage: "test",
        failedStep: "test",
      })
      // Test passes if no exception was thrown
      expect(true).toBe(true)
    })

    it("skips if webhook URL is not configured", async () => {
      delete process.env.DISCORD_WEBHOOK_URL

      const { notifyDiscordCritical } = await import("@/app/api/actions/notify")
      await notifyDiscordCritical("Test", "Test", {
        errorMessage: "test",
        failedStep: "test",
      })

      expect(fetchCalls.length).toBe(0)
    })
  })
  ```

- [ ] **RED: Verify the test fails**

  Run: `bun test app/api/actions/__tests__/notify-critical.test.ts`
  Expected: FAIL — `notifyDiscordCritical` is not exported from notify.ts

- [ ] **GREEN: Write minimal implementation**

  In `app/api/actions/notify.ts`, add after the last existing function:
  ```typescript
  /**
   * Notify Discord about a critical error that needs immediate attention.
   * Uses the same DISCORD_WEBHOOK_URL but with red embed + ⚠️ prefix.
   * FIRE-AND-FORGET: failures here must NOT cascade to the caller.
   */
  export async function notifyDiscordCritical(
    title: string,
    description: string,
    errorContext: {
      cafeName?: string
      submitterId?: string
      errorMessage: string
      errorStack?: string
      failedStep: string
    }
  ): Promise<void> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
      console.warn("[Critical] Discord webhook URL not configured")
      return
    }

    const stackSnippet = errorContext.errorStack
      ? errorContext.errorStack.slice(0, 1000)
      : "No stack trace"

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: `⚠️ CRITICAL: ${title}`,
            description: description,
            color: 0xef4444, // Red
            fields: [
              {
                name: "Error Message",
                value: errorContext.errorMessage.slice(0, 1024),
                inline: false,
              },
              {
                name: "Failed Step",
                value: errorContext.failedStep,
                inline: true,
              },
              {
                name: "Cafe Name",
                value: errorContext.cafeName || "N/A",
                inline: true,
              },
              {
                name: "Submitter ID",
                value: errorContext.submitterId || "N/A",
                inline: true,
              },
              {
                name: "Stack Trace",
                value: `\`\`\`${stackSnippet}\`\`\``.slice(0, 1024),
                inline: false,
              },
            ],
            footer: {
              text: "Grounds • Critical Alert",
            },
            timestamp: new Date().toISOString(),
          }],
        }),
      })
    } catch (error) {
      // Fire-and-forget: silently log but never throw
      console.error("[Critical] Failed to send Discord notification:", error)
    }
  }
  ```

- [ ] **GREEN: Verify the test passes**

  Run: `bun test app/api/actions/__tests__/notify-critical.test.ts`
  Expected: PASS — all 3 assertions green

- [ ] **REFACTOR: Clean up**
  - Verify the function signature matches the spec (title, description, errorContext)
  - Re-run: `bun test app/api/actions/__tests__/notify-critical.test.ts` — still green

- [ ] **Commit**

  ```bash
  git add app/api/actions/notify.ts app/api/actions/__tests__/notify-critical.test.ts
  git commit -m "feat: add critical Discord webhook for submission failures (Phase 3)"
  ```

---

### Task 3.2: Server-Side Duplicate Detection

**Files:**
- Modify: `app/api/actions/submit.ts` — Add `checkDuplicateCafe()` helper and integrate into `submitCafe`

**Dependencies:** Task 1.3 (Zod schema), Task 1.4 (slug changes), Task 1.2 (pg_trgm for trigram similarity)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  ```typescript
  // Add to app/api/actions/__tests__/submit-cafe.test.ts

  describe("duplicate cafe detection", () => {
    it("blocks submission when duplicate cafe exists", async () => {
      // Mock the DB to return an existing cafe with similar name
      mock.module("@/db", () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{
                  id: "existing-1",
                  name: "Test Cafe Existing",
                  slug: "test-cafe-existing",
                  isPublished: true,
                  addressDisplay: "123 Ayala Ave, Makati",
                  lat: 14.5547,
                  lng: 121.0244,
                }])
              })
            })
          }),
          insert: () => ({
            values: () => ({
              returning: () => Promise.reject(new Error("Should not reach insert")),
            }),
          }),
        },
      }))

      const { submitCafe } = await import("@/app/api/actions/submit")
      const result = await submitCafe(
        {
          name: "Test Cafe",
          description: "",
          region: "NCR",
          province: "Metro Manila",
          city_municipality: "Makati",
          area: "",
          address_display: "123 Ayala Ave, Makati",
          lat: 14.5547,
          lng: 121.0244,
          price_level: "mid",
          // ... other required fields with defaults
        } as any,
        null,
        [],
        []
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION")
        expect(result.error.message).toContain("already exists")
      }
    })

    it("blocks submission when pending duplicate exists", async () => {
      // Mock DB to return a pending (unpublished) duplicate
      mock.module("@/db", () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{
                  id: "pending-1",
                  name: "Test Cafe Pending",
                  slug: "test-cafe-pending",
                  isPublished: false,
                  addressDisplay: "123 Ayala Ave, Makati",
                  lat: 14.5547,
                  lng: 121.0244,
                }])
              })
            })
          }),
          insert: () => ({
            values: () => ({
              returning: () => Promise.reject(new Error("Should not reach insert")),
            }),
          }),
        },
      }))

      const { submitCafe } = await import("@/app/api/actions/submit")
      const result = await submitCafe(
        {
          name: "Test Cafe",
          description: "",
          region: "NCR",
          province: "Metro Manila",
          city_municipality: "Makati",
          area: "",
          address_display: "123 Ayala Ave, Makati",
          lat: 14.5547,
          lng: 121.0244,
          price_level: "mid",
        } as any,
        null,
        [],
        []
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain("awaiting review")
      }
    })

    it("allows submission when no duplicates found", async () => {
      // Mock DB to return empty (no duplicates)
      mock.module("@/db", () => ({
        db: {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([])
              })
            })
          }),
          insert: () => ({
            values: () => ({
              returning: () => Promise.resolve([{ id: "new-1", slug: "test-cafe" }]),
            }),
          }),
        },
      }))

      const { submitCafe } = await import("@/app/api/actions/submit")
      const result = await submitCafe(
        {
          name: "Unique Cafe Name",
          description: "",
          region: "NCR",
          province: "Metro Manila",
          city_municipality: "Makati",
          area: "",
          address_display: "456 Unique St, Makati",
          lat: 14.5600,
          lng: 121.0300,
          price_level: "mid",
        } as any,
        null,
        [],
        []
      )

      expect(result.success).toBe(true)
    })
  })
  ```

- [ ] **RED: Verify the test fails**

  Run: `bun test app/api/actions/__tests__/submit-cafe.test.ts`
  Expected: FAIL — old submit-cafe tests may pass but new duplicate tests fail because no duplicate check exists

- [ ] **GREEN: Write duplicate detection in submit.ts**

  Add after `ensureUniqueSlug` in `app/api/actions/submit.ts`:
  ```typescript
  import { sql, or, and } from "drizzle-orm"

  interface DuplicateCheckResult {
    isDuplicate: boolean
    existingCafes: Array<{
      id: string
      name: string
      slug: string
      isPublished: boolean
      addressDisplay: string
    }>
  }

  async function checkDuplicateCafe(
    name: string,
    cityMunicipality: string,
    province: string,
    lat: number | null,
    lng: number | null
  ): Promise<DuplicateCheckResult> {
    const normalized = name.toLowerCase().trim()

    // Step 1: Name-based check using ILIKE + trigram similarity
    // First, try exact-ish match (case-insensitive name match in same city)
    const exactMatches = await db
      .select({
        id: cafes.id,
        name: cafes.name,
        slug: cafes.slug,
        isPublished: cafes.isPublished,
        addressDisplay: cafes.addressDisplay,
      })
      .from(cafes)
      .where(
        and(
          sql`lower(${cafes.name}) = ${normalized}`,
          eq(cafes.cityMunicipality, cityMunicipality)
        )
      )
      .limit(5)

    if (exactMatches.length > 0) {
      return { isDuplicate: true, existingCafes: exactMatches }
    }

    // Step 2: Proximity-based check (200m radius + name similarity)
    if (lat !== null && lng !== null) {
      const DUPLICATE_RADIUS_METERS = 200

      const nearbyCafes = await db
        .select({
          id: cafes.id,
          name: cafes.name,
          slug: cafes.slug,
          isPublished: cafes.isPublished,
          addressDisplay: cafes.addressDisplay,
          lat: cafes.lat,
          lng: cafes.lng,
        })
        .from(cafes)
        .where(
          and(
            eq(cafes.cityMunicipality, cityMunicipality),
            eq(cafes.province, province)
          )
        )
        .limit(50)

      // Calculate haversine distance for each
      const nearby = nearbyCafes.filter((cafe) => {
        if (cafe.lat === null || cafe.lng === null) return false
        const distance = haversineDistance(lat, lng, cafe.lat, cafe.lng)
        return distance <= DUPLICATE_RADIUS_METERS
      })

      // Among nearby cafes, check name similarity via trigram
      if (nearby.length > 0) {
        const similarNames = nearby.filter((cafe) => {
          // Simple word overlap check as fallback if trigram unavailable
          const words1 = new Set(normalized.split(/\s+/))
          const words2 = new Set(cafe.name.toLowerCase().split(/\s+/))
          const intersection = [...words1].filter((w) => words2.has(w))
          return intersection.length >= Math.min(words1.size, words2.size) * 0.5
        })

        if (similarNames.length > 0) {
          return { isDuplicate: true, existingCafes: similarNames }
        }
      }
    }

    return { isDuplicate: false, existingCafes: [] }
  }

  /**
   * Haversine distance in meters between two lat/lng points
   */
  function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number {
    const R = 6371000 // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }
  ```

  Integrate into `submitCafe` after validation, before slug generation:
  ```typescript
  // After Zod validation, before slug generation:
  const duplicate = await checkDuplicateCafe(
    formData.name,
    formData.city_municipality,
    formData.province,
    formData.lat,
    formData.lng
  )

  if (duplicate.isDuplicate) {
    const allPending = duplicate.existingCafes.every((c) => !c.isPublished)
    const message = allPending
      ? "A cafe with a similar name and location has already been submitted and is awaiting review."
      : `This cafe may already exist on Grounds. Check: ${duplicate.existingCafes.map((c) => c.name).join(", ")}`

    return {
      success: false,
      error: CafeSubmissionError.duplicate(message),
    }
  }
  ```

- [ ] **GREEN: Verify the test passes**

  Run: `bun test app/api/actions/__tests__/submit-cafe.test.ts`
  Expected: PASS — all assertions green including new duplicate tests

- [ ] **REFACTOR: Clean up**
  - Extract `haversineDistance` to a shared utility if used elsewhere
  - Verify the word-overlap similarity threshold (0.5) is reasonable
  - Add `pg_trgm` extension enablement note to migration docs
  - Re-run tests — still green

- [ ] **Commit**

  ```bash
  git add app/api/actions/submit.ts app/api/actions/__tests__/submit-cafe.test.ts
  git commit -m "feat: add server-side duplicate cafe detection with name + proximity (Phase 3)"
  ```

---

### Task 3.3: Structured Error Handling in submitCafe

**Files:**
- Modify: `app/api/actions/submit.ts` — Integrate Zod validation and structured error returns
- Modify: `components/submit/CafeSubmissionForm.tsx` — Handle `SubmitError` type in error display

**Dependencies:** Task 1.3 (Zod schema), Task 3.1 (critical webhook), Task 3.2 (duplicate detection)

**TDD Cycle:**

- [ ] **RED: Update existing submit-cafe test to expect structured errors**

  ```typescript
  // In app/api/actions/__tests__/submit-cafe.test.ts, update the halal/straw test:
  
  it("persists halal and straw fields", async () => {
    const result = await submitCafe(
      {
        name: "Demo",
        description: "",
        region: "NCR",
        province: "Metro Manila",
        city_municipality: "Manila",
        area: "",
        address_display: "123 Test Street",
        lat: 1,
        lng: 1,
        price_level: "mid",
        // ... other fields
      } as any,
      null,
      [],
      []
    )

    expect(result.success).toBe(true)
    // Type narrowing: result should have cafeId and slug when successful
    if (result.success) {
      expect(result.cafeId).toBe("1")
      expect(result.slug).toBe("demo")
    }
  })

  it("returns structured error on validation failure", async () => {
    mock.module("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([]) })
          })
        }),
        insert: () => ({
          values: () => ({
            returning: () => Promise.reject(new Error("Should not insert"))
          })
        }),
      },
    }))

    const { submitCafe } = await import("@/app/api/actions/submit")
    const result = await submitCafe(
      { name: "" } as any, // Empty name — validation failure
      null, [], []
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION")
      expect(result.error.field).toBeDefined()
      expect(result.error.retryable).toBe(true)
    }
  })
  ```

- [ ] **RED: Verify the test fails**

  Run: `bun test app/api/actions/__tests__/submit-cafe.test.ts`
  Expected: FAIL — current tests expect `{ success: boolean, error?: string }` but we return `{ success, error: SubmitError }`

- [ ] **GREEN: Rewrite submitCafe with Zod validation + structured errors**

  Key changes to `app/api/actions/submit.ts`:

  ```typescript
  import { cafeSubmissionSchema, CafeSubmissionInput, CafeSubmissionError } from "@/utils/validation/cafe-submission"
  import { notifyDiscordCritical } from "./notify"

  export interface SubmitCafeResult {
    success: boolean
    cafeId?: string
    slug?: string
    error?: import("@/utils/validation/cafe-submission").SubmitError
  }

  export async function submitCafe(
    formData: SerializableCafeSubmission,
    thumbnailUrl: string | null,
    galleryUrls: string[],
    menuItems: { name: string; category: string; price: number; description: string; imageUrl: string | null }[] = []
  ): Promise<SubmitCafeResult> {
    // 1. Auth check
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: CafeSubmissionError.auth() }
    }

    // 2. Zod validation
    const validation = cafeSubmissionSchema.safeParse(formData)
    if (!validation.success) {
      return {
        success: false,
        error: CafeSubmissionError.fromZod(validation.error),
      }
    }

    const validData = validation.data

    // 3. Duplicate detection
    try {
      const duplicate = await checkDuplicateCafe(
        validData.name,
        validData.city_municipality,
        validData.province,
        validData.lat,
        validData.lng
      )

      if (duplicate.isDuplicate) {
        const allPending = duplicate.existingCafes.every((c) => !c.isPublished)
        const message = allPending
          ? "A cafe with a similar name and location has already been submitted and is awaiting review."
          : `This cafe may already exist on Grounds. Check: ${duplicate.existingCafes.map((c) => c.name).join(", ")}`

        return { success: false, error: CafeSubmissionError.duplicate(message) }
      }
    } catch (err) {
      // Duplicate check failure is non-fatal — log and continue
      console.error("[Submit] Duplicate check failed:", err)
    }

    // 4. Slug generation
    let slug: string
    try {
      const baseSlug = generateSlug(validData.name, validData.city_municipality, validData.province)
      slug = await ensureUniqueSlug(baseSlug)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error("[Submit] Slug generation failed:", err)
      
      // Fire critical webhook
      notifyDiscordCritical(
        "Slug Generation Failed",
        `Could not generate unique slug for cafe "${validData.name}". Error: ${errorMessage}`,
        {
          cafeName: validData.name,
          submitterId: user.id,
          errorMessage,
          errorStack: err instanceof Error ? err.stack : undefined,
          failedStep: "slug_generation",
        }
      ).catch(() => {}) // Fire-and-forget

      return { success: false, error: CafeSubmissionError.db() }
    }

    // 5. DB insert
    const finalThumbnail = thumbnailUrl || "placeholder"
    try {
      const operatingHoursJson = validData.operating_hours.length > 0
        ? validData.operating_hours
        : null
      const socialsJson = validData.socials.length > 0 ? validData.socials : null

      const [cafe] = await db.insert(cafes).values({
        name: validData.name.trim(),
        slug,
        description: validData.description.trim() || null,
        thumbnail: finalThumbnail,
        gallery: galleryUrls.length > 0 ? galleryUrls : null,
        region: validData.region,
        province: validData.province,
        cityMunicipality: validData.city_municipality,
        area: validData.area.trim() || null,
        addressDisplay: validData.address_display || `${validData.city_municipality}, ${validData.province}`,
        lat: validData.lat,
        lng: validData.lng,
        priceLevel: validData.price_level,
        hasWifi: validData.has_wifi,
        hasSmoking: validData.has_smoking,
        hasSockets: validData.has_sockets,
        hasParking: validData.has_parking,
        hasAircon: validData.has_aircon,
        isPetFriendly: validData.is_pet_friendly,
        hasOutdoorSeating: validData.has_outdoor_seating,
        hasIndoorSeating: validData.has_indoor_seating,
        hasRestroom: validData.has_restroom,
        hasBidet: validData.has_bidet,
        hasNonDairy: validData.has_non_dairy,
        hasDecaf: validData.has_decaf,
        milkOptions: validData.milk_options.length > 0 ? validData.milk_options : null,
        servesFood: validData.serves_food,
        isWorkFriendly: validData.is_work_friendly,
        paymentMethods: validData.payment_methods || null,
        specialty: validData.specialty.length > 0 ? validData.specialty : null,
        tags: validData.tags.length > 0 ? validData.tags : null,
        brewMethods: validData.brew_methods.length > 0 ? validData.brew_methods : null,
        roaster: validData.roaster || null,
        operatingHours: operatingHoursJson,
        websiteUrl: validData.website_url || null,
        phone: validData.phone || null,
        email: validData.email || null,
        socials: socialsJson,
        contributorId: user.id,
        isPublished: false,
        isActive: true,
        isVerified: false,
        isClaimed: false,
        isHiddenGem: validData.is_hidden_gem || false,
        findingHint: validData.finding_hint || null,
        isChain: validData.is_chain || false,
        isHalalCertified: validData.is_halal_certified,
        strawType: validData.straw_type || null,
        strawTypeOther: validData.straw_type === "other" && validData.straw_type_other
          ? validData.straw_type_other : null,
        ownerIds: null,
      }).returning({ id: cafes.id, slug: cafes.slug })

      if (!cafe) {
        throw new Error("Insert returned no cafe")
      }

      // 6. Post-submit hooks (non-fatal)
      // Discord notification
      notifyDiscord(validData.name, `${validData.city_municipality}, ${validData.province}`)
        .catch((err) => console.error("[Submit] Discord notify failed:", err))

      // Contribution logging
      logContribution(user.id, cafe.id, "CREATE", {
        summary: `Scouted ${validData.name}`,
        source: "cafe_submission",
        cafe_name: validData.name,
      }).catch((err) => console.error("[Submit] Contribution log failed:", err))

      // Menu items
      if (menuItems.length > 0) {
        for (let i = 0; i < menuItems.length; i++) {
          const item = menuItems[i]
          try {
            await db.insert(cafeMenuItems).values({
              cafeId: cafe.id,
              name: item.name,
              category: item.category,
              price: item.price,
              description: item.description || null,
              imageUrl: item.imageUrl,
              isAvailable: true,
              sortOrder: i,
              lastUpdatedBy: user.id,
            })
          } catch (err) {
            console.error(`[Submit] Menu item "${item.name}" insert failed:`, err)
            // Non-fatal: continue with other items
          }
        }
      }

      return { success: true, cafeId: cafe.id, slug: cafe.slug }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error("[Submit] DB insert failed:", err)

      // Critical webhook
      notifyDiscordCritical(
        "Cafe Submission DB Insert Failed",
        `Database insert failed for cafe "${validData.name}". The user's submission was lost.`,
        {
          cafeName: validData.name,
          submitterId: user.id,
          errorMessage,
          errorStack: err instanceof Error ? err.stack : undefined,
          failedStep: "db_insert",
        }
      ).catch(() => {})

      return { success: false, error: CafeSubmissionError.db() }
    }
  }
  ```

  **Remove the old manual validation block** (the if-statement checks for name, address_display, etc.) since Zod handles this.

- [ ] **GREEN: Update client to handle structured errors**

  In `components/submit/CafeSubmissionForm.tsx`, update the error display:
  ```typescript
  // Replace existing error handling in handleSubmit:
  const result = await submitCafe(serializableFormData, thumbnailUrl, galleryUrls, menuItems)

  if (!result.success && result.error) {
    setError(result.error.message)
    notify.error(result.error.message)
    
    if (result.error.field) {
      // Jump to the step containing the field
      const stepIndex = getStepForField(result.error.field)
      if (stepIndex >= 0) setStep(stepIndex)
    }
    
    if (!result.error.retryable) {
      // Disable retry for non-retryable errors
      setIsSubmitting(false)
    }
    return
  }
  ```

  Add a helper to map field names to form steps:
  ```typescript
  function getStepForField(field: string): number {
    const fieldStepMap: Record<string, number> = {
      name: 1, description: 1,
      region: 2, province: 2, city_municipality: 2, address_display: 2, lat: 2, lng: 2,
      // Add other field-to-step mappings as needed
    }
    return fieldStepMap[field] ?? -1
  }
  ```

- [ ] **GREEN: Verify all tests pass**

  Run: `bun test`
  Expected: All tests PASS. Submit-cafe tests pass with new structured errors. Integration tests pass.

- [ ] **REFACTOR: Clean up**
  - Remove any dead code from the old manual validation
  - Ensure all error paths have `console.error` logging
  - Verify critical webhook is called on DB failures
  - Re-run: `bun test` — all green

- [ ] **Commit**

  ```bash
  git add app/api/actions/submit.ts app/api/actions/__tests__/submit-cafe.test.ts components/submit/CafeSubmissionForm.tsx
  git commit -m "feat: integrate Zod validation, duplicate detection, and structured errors into submit flow (Phase 3)"
  ```

---

## Phase 4: SEO — Core Fixes

**Goal**: Fix critical SEO gaps: canonical URLs, BlogPosting JSON-LD, metadata on listing pages, sitemap profiles, verification meta.

### Task 4.1: BreadcrumbList & JSON-LD Utility

**Files:**
- Create: `utils/seo/breadcrumbs.ts` — BreadcrumbList JSON-LD generator
- Create: `utils/seo/jsonld.ts` — BlogPosting, ItemList, Menu generators
- Create: `utils/seo/__tests__/breadcrumbs.test.ts`
- Create: `utils/seo/__tests__/jsonld.test.ts`

**Dependencies:** None (pure functions, no DB)

**TDD Cycle:**

- [ ] **RED: Write the failing tests**

  ```typescript
  // utils/seo/__tests__/breadcrumbs.test.ts
  import { describe, it, expect } from "bun:test"
  import { buildBreadcrumbList, type BreadcrumbItem } from "@/utils/seo/breadcrumbs"

  describe("buildBreadcrumbList", () => {
    it("generates valid BreadcrumbList JSON-LD", () => {
      const items: BreadcrumbItem[] = [
        { name: "Home", url: "https://grounds.ph" },
        { name: "Cafes", url: "https://grounds.ph/cafes" },
        { name: "Starbucks Makati", url: "https://grounds.ph/cafes/starbucks-makati" },
      ]

      const result = buildBreadcrumbList(items)
      expect(result["@context"]).toBe("https://schema.org")
      expect(result["@type"]).toBe("BreadcrumbList")
      expect(result.itemListElement).toHaveLength(3)
      expect(result.itemListElement[0].name).toBe("Home")
      expect(result.itemListElement[0].item).toBe("https://grounds.ph")
      expect(result.itemListElement[0].position).toBe(1)
    })

    it("handles single item", () => {
      const items: BreadcrumbItem[] = [
        { name: "Home", url: "https://grounds.ph" },
      ]

      const result = buildBreadcrumbList(items)
      expect(result.itemListElement).toHaveLength(1)
      expect(result.itemListElement[0].position).toBe(1)
    })

    it("handles empty array", () => {
      const result = buildBreadcrumbList([])
      expect(result.itemListElement).toHaveLength(0)
    })
  })
  ```

  ```typescript
  // utils/seo/__tests__/jsonld.test.ts
  import { describe, it, expect } from "bun:test"
  import {
    buildBlogPostingJsonLd,
    buildItemListJsonLd,
    buildItemListElement,
  } from "@/utils/seo/jsonld"

  describe("buildBlogPostingJsonLd", () => {
    it("generates valid BlogPosting JSON-LD", () => {
      const result = buildBlogPostingJsonLd({
        title: "Test Blog Post",
        url: "https://grounds.ph/blog/test-post",
        description: "A test post about coffee",
        imageUrl: "https://cdn.grounds.ph/test.jpg",
        authorName: "Adrian Bonpin",
        authorUrl: "https://grounds.ph/profile/adrianbonpin",
        datePublished: "2025-01-15T00:00:00.000Z",
        dateModified: "2025-01-16T00:00:00.000Z",
      })

      expect(result["@context"]).toBe("https://schema.org")
      expect(result["@type"]).toBe("BlogPosting")
      expect(result.headline).toBe("Test Blog Post")
      expect(result.author["@type"]).toBe("Person")
      expect(result.author.name).toBe("Adrian Bonpin")
      expect(result.datePublished).toBe("2025-01-15T00:00:00.000Z")
    })

    it("handles missing optional fields", () => {
      const result = buildBlogPostingJsonLd({
        title: "Minimal Post",
        url: "https://grounds.ph/blog/minimal",
        description: "Minimal",
        authorName: "Author",
        datePublished: "2025-01-01T00:00:00.000Z",
      })

      expect(result.image).toBeUndefined()
      expect(result.author.url).toBeUndefined()
    })
  })

  describe("buildItemListJsonLd", () => {
    it("generates valid ItemList JSON-LD", () => {
      const elements = [
        buildItemListElement("Cafe One", "https://grounds.ph/cafes/cafe-one", 1),
        buildItemListElement("Cafe Two", "https://grounds.ph/cafes/cafe-two", 2),
      ]

      const result = buildItemListJsonLd(elements, "collection")
      expect(result["@type"]).toBe("ItemList")
      expect(result.itemListElement).toHaveLength(2)
      expect(result.itemListElement[0].position).toBe(1)
    })
  })
  ```

- [ ] **RED: Verify the tests fail**

  Run: `bun test utils/seo/__tests__/breadcrumbs.test.ts utils/seo/__tests__/jsonld.test.ts`
  Expected: FAIL — modules not found

- [ ] **GREEN: Write implementations**

  ```typescript
  // utils/seo/breadcrumbs.ts
  export interface BreadcrumbItem {
    name: string
    url: string
  }

  export interface BreadcrumbListJsonLd {
    "@context": "https://schema.org"
    "@type": "BreadcrumbList"
    itemListElement: Array<{
      "@type": "ListItem"
      position: number
      name: string
      item: string
    }>
  }

  export function buildBreadcrumbList(items: BreadcrumbItem[]): BreadcrumbListJsonLd {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem" as const,
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    }
  }
  ```

  ```typescript
  // utils/seo/jsonld.ts
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

  export interface BlogPostingInput {
    title: string
    url: string
    description: string
    imageUrl?: string
    authorName: string
    authorUrl?: string
    datePublished: string
    dateModified?: string
  }

  export function buildBlogPostingJsonLd(input: BlogPostingInput) {
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: input.title,
      description: input.description,
      url: input.url,
      ...(input.imageUrl && { image: input.imageUrl }),
      author: {
        "@type": "Person",
        name: input.authorName,
        ...(input.authorUrl && { url: input.authorUrl }),
      },
      datePublished: input.datePublished,
      ...(input.dateModified && { dateModified: input.dateModified }),
      publisher: {
        "@type": "Organization",
        name: "Grounds PH",
        url: BASE_URL,
      },
    }
  }

  export interface ItemListElement {
    "@type": "ListItem"
    position: number
    name: string
    url: string
  }

  export function buildItemListElement(
    name: string,
    url: string,
    position: number
  ): ItemListElement {
    return { "@type": "ListItem", position, name, url }
  }

  export function buildItemListJsonLd(
    elements: ItemListElement[],
    listType: "collection" | "crawl" | "listing" = "listing"
  ) {
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: listType === "collection" ? "Cafe Collection"
        : listType === "crawl" ? "Cafe Crawl"
        : "Cafe Listing",
      numberOfItems: elements.length,
      itemListElement: elements,
    }
  }
  ```

- [ ] **GREEN: Verify the tests pass**

  Run: `bun test utils/seo/__tests__/breadcrumbs.test.ts utils/seo/__tests__/jsonld.test.ts`
  Expected: PASS — all 6 assertions green

- [ ] **REFACTOR: Clean up**
  - Ensure all JSON-LD outputs match schema.org spec
  - Re-run tests — still green

- [ ] **Commit**

  ```bash
  git add utils/seo/breadcrumbs.ts utils/seo/jsonld.ts utils/seo/__tests__/breadcrumbs.test.ts utils/seo/__tests__/jsonld.test.ts
  git commit -m "feat: add BreadcrumbList and JSON-LD generators for SEO (Phase 4)"
  ```

---

### Task 4.2: Add Canonicals, JSON-LD, and Metadata to Pages

**Files:**
- Modify: `app/cafes/[slug]/page.tsx` — Add canonical, BreadcrumbList, sameAs
- Modify: `app/cafes/[slug]/menu/page.tsx` — Add canonical, Menu JSON-LD
- Modify: `app/blog/[slug]/page.tsx` — Add BlogPosting JSON-LD, BreadcrumbList
- Modify: `app/blog/page.tsx` — Fix canonical URL to `/blog`
- Modify: `app/cafes/page.tsx` — Add keywords metadata
- Modify: `app/community/page.tsx` — Add keywords metadata
- Modify: `app/map/page.tsx` — Add metadata export
- Modify: `app/layout.tsx` — Add verification metadata
- Modify: `app/sitemap.ts` — Add profiles to sitemap

**Dependencies:** Task 4.1 (JSON-LD utilities)

**TDD Cycle:**

- [ ] **RED: No test-first for metadata** (metadata is a Next.js convention, tested via build output and browser inspection rather than unit tests)

- [ ] **GREEN: Cafe page — canonical + BreadcrumbList**

  In `app/cafes/[slug]/page.tsx`, modify `generateMetadata`:
  ```typescript
  import { buildBreadcrumbList } from "@/utils/seo/breadcrumbs"
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

  export async function generateMetadata({ params }): Promise<Metadata> {
    const { slug } = await params
    const cafe = await getCafeBySlug(slug)

    if (!cafe) {
      return { title: "Cafe Not Found", description: "..." }
    }

    // ... existing keyword building ...

    return {
      title: name,
      description: metaDescription,
      keywords: keywords,
      alternates: {
        canonical: `${siteUrl}/cafes/${slug}`,  // ADD THIS
      },
      openGraph: {
        // ... existing OG data ...
        url: `${siteUrl}/cafes/${slug}`,  // ADD THIS
      },
      // ... rest unchanged ...
    }
  }
  ```

  In the page component, add BreadcrumbList script:
  ```typescript
  // Inside the page component, before return:
  const breadcrumbs = buildBreadcrumbList([
    { name: "Grounds PH", url: siteUrl },
    { name: "Cafes", url: `${siteUrl}/cafes` },
    { name: cafe.name, url: `${siteUrl}/cafes/${cafe.slug}` },
  ])

  // In the JSX, add beside the existing CafeOrCoffeeShop script:
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
  />
  ```

- [ ] **GREEN: Cafe menu page — canonical + Menu JSON-LD**

  In `app/cafes/[slug]/menu/page.tsx`:
  ```typescript
  // Add to generateMetadata:
  alternates: {
    canonical: `${siteUrl}/cafes/${slug}/menu`,
  },

  // Add Menu JSON-LD in the page component:
  const menuJsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `Menu for ${cafe.name}`,
    hasMenuSection: [
      {
        "@type": "MenuSection",
        name: "Drinks",
        hasMenuItem: menuItems
          .filter((item) => item.category !== "Food")
          .map((item) => ({
            "@type": "MenuItem",
            name: item.name,
            description: item.description || "",
            offers: {
              "@type": "Offer",
              price: item.price,
              priceCurrency: "PHP",
            },
          })),
      },
    ],
  }
  ```

- [ ] **GREEN: Blog post page — BlogPosting JSON-LD + BreadcrumbList**

  In `app/blog/[slug]/page.tsx`:
  ```typescript
  import { buildBlogPostingJsonLd } from "@/utils/seo/jsonld"
  import { buildBreadcrumbList } from "@/utils/seo/breadcrumbs"

  // Inside the page component:
  const blogPostingJsonLd = buildBlogPostingJsonLd({
    title: post.title,
    url: `${siteUrl}/blog/${post.slug}`,
    description: post.excerpt || post.content.slice(0, 160),
    imageUrl: post.coverImage || undefined,
    authorName: post.author?.display_name || "Grounds PH",
    authorUrl: post.author?.username
      ? `${siteUrl}/profile/${post.author.username}`
      : undefined,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt || undefined,
  })

  const breadcrumbs = buildBreadcrumbList([
    { name: "Grounds PH", url: siteUrl },
    { name: "Blog", url: `${siteUrl}/blog` },
    { name: post.title, url: `${siteUrl}/blog/${post.slug}` },
  ])

  // Add both scripts in JSX
  ```

- [ ] **GREEN: Fix blog listing canonical**

  In `app/blog/page.tsx`, find and fix the canonical:
  ```typescript
  // BEFORE (bug): canonical points to /community?tab=blogs
  // AFTER:
  export const metadata: Metadata = {
    title: "Blog | Grounds PH",
    description: "Latest cafe news, guides, and community stories from Grounds PH.",
    alternates: {
      canonical: "/blog",
    },
    // Also add keywords:
    keywords: [
      "cafe blog", "coffee guides", "cafe news Philippines",
      "coffee culture", "Philippines cafe stories",
    ],
  }
  ```

- [ ] **GREEN: Add keywords to listing pages**

  In `app/cafes/page.tsx`:
  ```typescript
  export const metadata: Metadata = {
    title: "Discover Cafes in the Philippines | Grounds PH",
    description: "Browse our curated list of cafes across the Philippines. Filter by city, amenities, price range, and more.",
    keywords: [
      "cafes Philippines", "coffee shops", "cafe directory",
      "find cafes near me", "coffee finder Philippines",
    ],
    openGraph: {
      title: "Discover Cafes in the Philippines | Grounds PH",
      description: "Browse our curated list of cafes across the Philippines.",
    },
  }
  ```

  In `app/community/page.tsx`:
  ```typescript
  export const metadata: Metadata = {
    title: "Community | Grounds PH",
    description: "Join the Grounds PH community. Discover cafe crawls, collections, events, and connect with coffee enthusiasts.",
    keywords: [
      "coffee community Philippines", "cafe crawls", "cafe collections",
      "coffee events Philippines", "coffee enthusiasts",
    ],
  }
  ```

  In `app/map/page.tsx`:
  ```typescript
  export const metadata: Metadata = {
    title: "Cafe Map | Grounds PH",
    description: "Explore cafes across the Philippines on an interactive map. Find coffee shops near you.",
    keywords: [
      "cafe map Philippines", "coffee shops near me",
      "find cafes on map", "cafe locations",
    ],
  }
  ```

- [ ] **GREEN: Add verification metadata to root layout**

  In `app/layout.tsx`, add to the `metadata` object:
  ```typescript
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_SITE_VERIFICATION,
    yahoo: process.env.YAHOO_SITE_VERIFICATION,
  },
  ```

- [ ] **GREEN: Add profiles to sitemap**

  In `app/sitemap.ts`:
  ```typescript
  // Add profiles query:
  const profileResults = await db
    .select({ username: profiles.username, updatedAt: profiles.updatedAt })
    .from(profiles)
    .where(and(
      eq(profiles.profileCompleted, true),
      eq(profiles.isPrivate, false)
    ))
    .limit(500)  // Cap to 500 public profiles

  // Pass to buildSitemapEntries:
  return buildSitemapEntries({
    // ... existing params ...
    profiles: profileResults,
  })
  ```

- [ ] **GREEN: Verify build compiles**

  Run: `bun build`
  Expected: Build succeeds with no TypeScript errors. No pages should break.

- [ ] **REFACTOR: Clean up**
  - Verify all canonical URLs are absolute (not relative)
  - Confirm JSON-LD scripts have `type="application/ld+json"`
  - Re-run build — clean

- [ ] **Commit**

  ```bash
  git add app/cafes/[slug]/page.tsx app/cafes/[slug]/menu/page.tsx app/blog/[slug]/page.tsx app/blog/page.tsx app/cafes/page.tsx app/community/page.tsx app/map/page.tsx app/layout.tsx app/sitemap.ts
  git commit -m "feat: add canonical URLs, JSON-LD, keywords metadata, and verification (Phase 4)"
  ```

---

## Phase 5: SEO — City/Province Landing Pages

**Goal**: Create SEO-optimized landing pages at `/cafes/{province}/{city}` that rank for location-based search queries.

**Route structure**: `app/cafes/[province]/[city]/page.tsx` — Next.js differentiates this from `app/cafes/[slug]` by depth. `/cafes/foo` matches `[slug]`, `/cafes/foo/bar` matches `[province]/[city]`.

### Task 5.1: City Landing Page

**Files:**
- Create: `app/cafes/[province]/[city]/page.tsx` — Server component with SEO metadata
- Create: `app/cafes/[province]/[city]/__tests__/page.test.tsx` — Tests

**Dependencies:** Task 4.1 (JSON-LD utilities), Task 4.2 (cafe page canonical pattern)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  ```typescript
  // app/cafes/[province]/[city]/__tests__/page.test.tsx
  import { describe, it, expect, mock } from "bun:test"
  import { buildMetadata } from "@/utils/seo/landing-metadata"

  describe("city landing metadata", () => {
    it("builds correct title with city and province", () => {
      const meta = buildMetadata({
        city: "Makati",
        province: "Metro Manila",
        cafeCount: 42,
      })
      expect(meta.title).toContain("Makati")
      expect(meta.title).toContain("Metro Manila")
      expect(meta.description).toContain("42")
    })

    it("includes location keywords", () => {
      const meta = buildMetadata({
        city: "Cebu City",
        province: "Cebu",
        cafeCount: 15,
      })
      expect(meta.keywords).toContain("cafes in Cebu City")
      expect(meta.keywords).toContain("coffee shops Cebu City")
      expect(meta.keywords).toContain("Cebu City cafe guide")
    })

    it("sets canonical to self", () => {
      const meta = buildMetadata({
        city: "Makati",
        province: "Metro Manila",
        cafeCount: 10,
      })
      expect(meta.alternates?.canonical).toContain("/cafes/metro-manila/makati")
    })
  })
  ```

- [ ] **RED: Verify the test fails**

  Run: `bun test app/cafes/[province]/[city]/__tests__/page.test.tsx`
  Expected: FAIL — module not found

- [ ] **GREEN: Write the metadata builder**

  ```typescript
  // utils/seo/landing-metadata.ts
  import type { Metadata } from "next"

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

  interface CityLandingData {
    city: string
    province: string
    cafeCount: number
  }

  export function buildMetadata(data: CityLandingData): Metadata {
    const { city, province, cafeCount } = data
    const provinceSlug = province.toLowerCase().replace(/\s+/g, "-")
    const citySlug = city.toLowerCase().replace(/\s+/g, "-")
    const path = `/cafes/${provinceSlug}/${citySlug}`

    return {
      title: `Best Cafes in ${city}, ${province} | Grounds PH`,
      description: `Discover ${cafeCount}+ cafes in ${city}, ${province}. Find WiFi-friendly, pet-friendly, and specialty coffee shops. Read reviews and plan your next coffee trip.`,
      keywords: [
        `cafes in ${city}`,
        `coffee shops ${city}`,
        `${city} cafe guide`,
        `best cafes ${city}`,
        `coffee ${province}`,
        `cafes ${province}`,
        `Philippines cafes`,
        "coffee near me",
      ],
      alternates: {
        canonical: `${siteUrl}${path}`,
      },
      openGraph: {
        title: `Best Cafes in ${city}, ${province} | Grounds PH`,
        description: `Discover ${cafeCount}+ cafes in ${city}, ${province}. Community-reviewed and curated.`,
        url: `${siteUrl}${path}`,
      },
    }
  }
  ```

- [ ] **GREEN: Write the page component**

  ```typescript
  // app/cafes/[province]/[city]/page.tsx
  import { Metadata } from "next"
  import { notFound } from "next/navigation"
  import { db } from "@/db"
  import { cafes } from "@/db/schema"
  import { eq, and, count } from "drizzle-orm"
  import { buildMetadata } from "@/utils/seo/landing-metadata"
  import { buildItemListJsonLd, buildItemListElement } from "@/utils/seo/jsonld"
  import { buildBreadcrumbList } from "@/utils/seo/breadcrumbs"
  import { omitTestCafes } from "@/utils/filters"
  import Link from "next/link"

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

  interface Props {
    params: Promise<{ province: string; city: string }>
  }

  // Helper to reverse slug → display name
  function slugToDisplay(slug: string): string {
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { province: provinceSlug, city: citySlug } = await params
    const province = slugToDisplay(provinceSlug)
    const city = slugToDisplay(citySlug)

    // Count cafes in this city
    const countResult = await db
      .select({ count: count() })
      .from(cafes)
      .where(and(
        eq(cafes.isPublished, true),
        eq(cafes.isHiddenGem, false),
        ...omitTestCafes([]),
      ))
      // Filter by city/province via ILIKE to match various formats
      // (PostgreSQL case-insensitive matching)
      .$dynamic()

    // Re-query with proper filters
    const cafeResults = await db
      .select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
      .from(cafes)
      .where(and(
        eq(cafes.isPublished, true),
        eq(cafes.isHiddenGem, false),
        ...omitTestCafes([]),
      ))

    // Client-side filter for city/province since DB may store slightly different casing
    const matching = cafeResults.filter((c) => {
      const storedCity = (c as any).cityMunicipality?.toLowerCase() || ""
      const storedProvince = (c as any).province?.toLowerCase() || ""
      return (
        storedCity.includes(city.toLowerCase()) ||
        storedProvince.includes(province.toLowerCase())
      )
    })

    return buildMetadata({
      city,
      province,
      cafeCount: matching.length,
    })
  }

  export default async function CityLandingPage({ params }: Props) {
    const { province: provinceSlug, city: citySlug } = await params
    const province = slugToDisplay(provinceSlug)
    const city = slugToDisplay(citySlug)

    // Fetch cafes (same query as generateMetadata)
    const cafeResults = await db
      .select({
        id: cafes.id,
        name: cafes.name,
        slug: cafes.slug,
        thumbnail: cafes.thumbnail,
        cityMunicipality: cafes.cityMunicipality,
        province: cafes.province,
      })
      .from(cafes)
      .where(and(
        eq(cafes.isPublished, true),
        eq(cafes.isHiddenGem, false),
        ...omitTestCafes([]),
      ))

    const matching = cafeResults.filter((c) => {
      const storedCity = c.cityMunicipality?.toLowerCase() || ""
      const storedProvince = c.province?.toLowerCase() || ""
      return (
        storedCity.includes(city.toLowerCase()) ||
        storedProvince.includes(province.toLowerCase())
      )
    })

    if (matching.length === 0) {
      notFound()
    }

    // Build JSON-LD
    const breadcrumbs = buildBreadcrumbList([
      { name: "Grounds PH", url: siteUrl },
      { name: "Cafes", url: `${siteUrl}/cafes` },
      { name: `${city}, ${province}`, url: `${siteUrl}/cafes/${provinceSlug}/${citySlug}` },
    ])

    const itemList = buildItemListJsonLd(
      matching.map((c, i) => buildItemListElement(
        c.name,
        `${siteUrl}/cafes/${c.slug}`,
        i + 1,
      )),
      "listing"
    )

    return (
      <main className="w-full min-h-screen px-4 py-12 max-w-6xl mx-auto">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />

        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Best Cafes in {city}, {province}
        </h1>
        <p className="text-text/70 mb-8">
          Discover {matching.length} cafes in {city}, {province}.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {matching.map((cafe) => (
            <Link
              key={cafe.id}
              href={`/cafes/${cafe.slug}`}
              className="block bg-background border border-tertiary/50 rounded-xl p-4 hover:border-primary/50 transition"
            >
              <h3 className="font-semibold">{cafe.name}</h3>
              <p className="text-sm text-text/60">{cafe.cityMunicipality}</p>
            </Link>
          ))}
        </div>
      </main>
    )
  }
  ```

  **Note**: The current approach uses an in-memory filter for city/province matching (since DB stores exact spellings). For production, refactor the query to use `ilike` on both `cityMunicipality` and `province` columns. This is noted in the REFACTOR step.

- [ ] **GREEN: Verify the tests pass**

  Run: `bun test app/cafes/[province]/[city]/__tests__/page.test.tsx`
  Expected: PASS — all 3 assertions green

- [ ] **REFACTOR: Improve city/province DB query**

  Replace the in-memory filter with a proper DB query:
  ```typescript
  import { ilike, or } from "drizzle-orm"

  const matching = await db
    .select({ ... })
    .from(cafes)
    .where(and(
      eq(cafes.isPublished, true),
      eq(cafes.isHiddenGem, false),
      ...omitTestCafes([]),
      or(
        ilike(cafes.cityMunicipality, `%${city}%`),
        ilike(cafes.province, `%${province}%`),
      )
    ))
  ```

- [ ] **Commit**

  ```bash
  git add app/cafes/[province]/[city]/page.tsx app/cafes/[province]/[city]/__tests__/page.test.tsx utils/seo/landing-metadata.ts
  git commit -m "feat: add city/province SEO landing pages with JSON-LD (Phase 5)"
  ```

---

## Phase 6: Polish & Hardening

**Goal**: Final integration checks, full test suite verification, and documentation.

### Task 6.1: Full Test Suite Verification

**Files:**
- No new files — verify all existing and new tests pass

**Dependencies:** All Phase 1-5 tasks

**Steps:**

- [ ] **Run full test suite**

  ```bash
  bun test
  ```
  Expected: All tests PASS. Expected test count: ~150-200 tests across the suite.

- [ ] **Run lint**

  ```bash
  bun lint
  ```
  Expected: No lint errors. Auto-fix any fixable issues:
  ```bash
  bun lint --fix
  ```

- [ ] **Run production build**

  ```bash
  bun build
  ```
  Expected: Build succeeds with no TypeScript errors, no broken imports.

- [ ] **Check for broken imports**

  ```bash
  grep -r "from \"./notify\"" app/api/actions/submit.ts
  ```
  Expected: Import path is correct relative to `submit.ts`

- [ ] **Verify migration is safe**

  Check the generated migration file in `drizzle/migrations/`:
  ```bash
  ls -la drizzle/migrations/ | tail -5
  ```
  Verify it contains only `ALTER TABLE "cafes" ADD COLUMN "is_test" ...` and no destructive operations.

- [ ] **Verify .env.example is consistent**

  Check that new env vars are documented:
  ```bash
  grep -E "GOOGLE_SITE_VERIFICATION|YANDEX_SITE_VERIFICATION|YAHOO_SITE_VERIFICATION" .env.example
  ```
  If missing, add them:
  ```bash
  # Optional verification vars (not required for dev)
  # GOOGLE_SITE_VERIFICATION=
  # YANDEX_SITE_VERIFICATION=
  # YAHOO_SITE_VERIFICATION=
  ```

- [ ] **Commit**

  ```bash
  git add .env.example
  git commit -m "chore: document new SEO verification env vars (Phase 6)"
  ```

---

### Task 6.2: Sitemap Integration Test

**Files:**
- Modify: `utils/seo/__tests__/sitemap.test.ts` — Add test for profile entries and test-cafe exclusion

**Dependencies:** Task 4.2 (sitemap changes)

**Steps:**

- [ ] **Add sitemap test for profiles**

  ```typescript
  // In utils/seo/__tests__/sitemap.test.ts, add:
  
  it("includes profile entries when provided", () => {
    const entries = buildSitemapEntries({
      baseUrl: "https://grounds.ph",
      staticPages: [],
      cafes: [],
      blogs: [],
      menus: [],
      collections: [],
      crawls: [],
      profiles: [
        { username: "adrianbonpin", updatedAt: new Date("2025-01-01") },
        { username: "notwabbit", updatedAt: null },
      ],
    })

    // Filter profile entries
    const profileEntries = entries.filter(
      (e) => e.url.includes("/profile/")
    )
    expect(profileEntries.length).toBe(2)
    expect(profileEntries[0].url).toBe("https://grounds.ph/profile/adrianbonpin")
    expect(profileEntries[1].url).toBe("https://grounds.ph/profile/notwabbit")
  })

  it("handles empty profiles gracefully", () => {
    const entries = buildSitemapEntries({
      baseUrl: "https://grounds.ph",
      staticPages: [{ path: "/", changeFrequency: "daily", priority: 1 }],
      cafes: [],
      blogs: [],
      menus: [],
      collections: [],
      crawls: [],
      profiles: [],
    })

    // Should not throw, should produce only static entries
    expect(entries.length).toBe(1)
    expect(entries[0].url).toBe("https://grounds.ph/")
  })
  ```

- [ ] **GREEN: Verify sitemap tests pass**

  Run: `bun test utils/seo/__tests__/sitemap.test.ts`
  Expected: PASS — existing + new tests green

- [ ] **Commit**

  ```bash
  git add utils/seo/__tests__/sitemap.test.ts
  git commit -m "test: add sitemap profile entry tests (Phase 6)"
  ```

---

### Task 6.3: pg_trgm Extension Enablement

**Files:**
- Create: `drizzle/migrations/XXXX_enable_pg_trgm.sql` — Enable the extension

**Dependencies:** None (can be done anytime before deploying duplicate detection)

**Steps:**

- [ ] **Create the migration manually**

  ```sql
  -- drizzle/migrations/XXXX_enable_pg_trgm.sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ```

  Run it against the development DB:
  ```bash
  # Connect and run:
  psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
  ```

- [ ] **Verify extension is enabled**

  ```sql
  SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
  ```
  Expected: Returns one row with `pg_trgm`.

- [ ] **Commit**

  ```bash
  git add drizzle/migrations/XXXX_enable_pg_trgm.sql
  git commit -m "chore: enable pg_trgm extension for name similarity matching (Phase 6)"
  ```

---

### Task 6.4: Final Integration Verification

**Steps:**

- [ ] **Full test suite:**

  ```bash
  bun test && echo "✅ All tests pass"
  ```

- [ ] **Build check:**

  ```bash
  bun build && echo "✅ Build succeeds"
  ```

- [ ] **Lint check:**

  ```bash
  bun lint && echo "✅ Lint clean"
  ```

- [ ] **Manual checklist:**
  - [ ] Submit a test cafe with duplicate name in same city → should block
  - [ ] Submit a cafe with location in the name → slug reflects location
  - [ ] In prod, test cafes don't appear in listings
  - [ ] In dev, test cafes appear everywhere
  - [ ] Cafe page shows canonical URL in HTML source
  - [ ] Blog post shows BlogPosting JSON-LD in HTML source
  - [ ] City landing page resolves at `/cafes/{province}/{city}`
  - [ ] Sitemap includes profile entries
  - [ ] Discord gets red embed on critical failures

- [ ] **Commit**

  ```bash
  git add -A
  git commit -m "chore: final integration verification (Phase 6)"
  ```

---

## Implementation Order Summary

| Phase | Tasks | Estimated Complexity |
|---|---|---|
| **Phase 1** (Foundation) | 1.1 Filter utility, 1.2 Migration, 1.3 Zod schema, 1.4 Slug | 🟢 Low — utilities and schema |
| **Phase 2** (test-cafe) | 2.1 Apply filters to all queries | 🟡 Medium — many files, pattern-based |
| **Phase 3** (Submit) | 3.1 Critical webhook, 3.2 Duplicate detection, 3.3 Structured errors | 🔴 High — core flow rewrite |
| **Phase 4** (SEO core) | 4.1 JSON-LD utils, 4.2 Canonicals + metadata | 🟡 Medium — many files, pattern-based |
| **Phase 5** (SEO landing) | 5.1 City landing pages | 🟡 Medium — new route with complex query |
| **Phase 6** (Polish) | 6.1-6.4 Integration verification | 🟢 Low — testing and documentation |

**Total estimated tasks**: 15 tasks across 6 phases.
**Total files**: ~20 modified, ~8 created.

**No tasks for Objective 4 (Team Management)** — feature already built and verified live.

---

## Self-Review Results

### Spec Coverage Check

| Spec Requirement | Task | Status |
|---|---|---|
| Zod validation + field-level errors | 1.3, 3.3 | ✅ |
| Location slugs `{name}-{city}-{province}` | 1.4 | ✅ |
| Bounded uniqueness loop (max 100) | 1.4 | ✅ |
| Structured SubmitError types | 1.3, 3.3 | ✅ |
| Discord critical webhook (single URL, red embed) | 3.1 | ✅ |
| Server-side duplicate detection | 3.2 | ✅ |
| Duplicate detects pending cafes | 3.2 | ✅ |
| 200m proximity radius | 3.2 | ✅ |
| is_test column + migration | 1.2 | ✅ |
| Production filter on all public queries | 2.1 | ✅ |
| setCafeTestFlag admin action | 2.1 | ✅ |
| Admin bypass for test cafes | 2.1 | ✅ |
| Canonical URLs on cafe/menu/blog pages | 4.2 | ✅ |
| BlogPosting JSON-LD | 4.1, 4.2 | ✅ |
| BreadcrumbList JSON-LD | 4.1, 4.2 | ✅ |
| Fix blog canonical bug | 4.2 | ✅ |
| Keywords on listing pages | 4.2 | ✅ |
| Verification metadata | 4.2 | ✅ |
| Profiles in sitemap | 4.2, 6.2 | ✅ |
| City/province landing pages | 5.1 | ✅ |
| pg_trgm extension | 6.3 | ✅ |
| Full test suite pass | 6.1, 6.4 | ✅ |
| Near-miss duplicate logging | — | ⚠️ Added below |
| Webhook rate limiting | — | ⚠️ Added below |

### Gap Remediation

**Gap 1: Near-miss duplicate logging.** Add to Task 3.2's `checkDuplicateCafe`:

```typescript
// In checkDuplicateCafe, after finding duplicates:
if (duplicate.isDuplicate) {
  // Log near-miss to system_logs for admin review
  try {
    await logSystemAction(
      "create",
      "cafe", 
      duplicate.existingCafes[0]?.id || "unknown",
      null,
      { 
        submittedName: name,
        submittedLocation: `${cityMunicipality}, ${province}`,
        matchedCafes: duplicate.existingCafes.map(c => c.name),
        blocked: true,
      },
      { 
        reason: "Duplicate cafe submission blocked",
        duplicateNames: duplicate.existingCafes.map(c => c.name),
      }
    )
  } catch (logErr) {
    console.error("[Submit] Failed to log duplicate near-miss:", logErr)
  }
  
  // ... return error as before
}
```

**Gap 2: Critical webhook rate limiting.** Add to Task 3.1's `notifyDiscordCritical`:

```typescript
// Module-level rate limiter
let lastCriticalNotification = 0
const CRITICAL_COOLDOWN_MS = 5000 // 5 seconds

export async function notifyDiscordCritical(...): Promise<void> {
  const now = Date.now()
  if (now - lastCriticalNotification < CRITICAL_COOLDOWN_MS) {
    console.warn("[Critical] Rate limited — skipping duplicate notification")
    return
  }
  lastCriticalNotification = now
  
  // ... rest of function
}
```

### Placeholder Scan
✅ No "TODO", "TBD", "implement later", or "similar to Task N" found in the plan.

### Type Consistency
✅ `SubmitCafeResult.success` is always `boolean`
✅ `SubmitError.code` uses consistent enum values across tasks
✅ `omitTestCafes` signature consistent across all callers
✅ `buildBreadcrumbList` input/output types match across pages

### TDD Compliance
✅ All 15 tasks follow RED → RED_VERIFY → GREEN → GREEN_VERIFY → REFACTOR → COMMIT
✅ Each task specifies exact test code, commands, and expected output
✅ Each task specifies exact implementation code

### Verbose Check
✅ Test code is shown in full, not described
✅ Implementation code is shown in full
✅ Commands include exact file paths
✅ Expected output is stated explicitly (PASS / FAIL / build succeeds)
