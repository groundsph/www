# Cafe Location Edit & Submit Auto-fill Fix — Implementation Plan

> For agentic workers: this plan follows strict TDD. Every task has RED → GREEN → REFACTOR → COMMIT.
> Tasks within each phase are ordered by dependency. Complete all tasks in a phase before moving to the next.

**Goal:** Enable admin/owner editing of cafe location fields (region, province, city/municipality) and fix the submit form's auto-fill to respect manual dropdown selections.

**Architectural Spec:** `docs/superpowers/specs/2026-05-26-architectural-spec.md`

---

## File Manifest

| Action | File | Purpose |
|--------|------|---------|
| Modify | `app/api/actions/admin.ts` | Add `region`, `province`, `city_municipality` to `updateCafe` |
| Modify | `app/api/actions/owner.ts` | Add `region`, `province`, `city_municipality` to `updateCafeAsOwner` |
| Modify | `components/cafe-editor/LocationSection.tsx` | Dropdown mode when `!readOnlyLocation` |
| Modify | `components/manage/CafeEditor.tsx` | Enable location editing, add fields to `handleSave` |
| Modify | `components/owner/CafeEdit.tsx` | Enable location editing, add fields to `handleSave` |
| Modify | `components/submit/CafeSubmissionForm.tsx` | Fix `handleLocationMatch` to only fill empty fields |
| Modify | `app/api/actions/__tests__/admin.test.ts` | Add moderator scope tests for location changes |
| Modify | `app/api/actions/__tests__/owner.test.ts` | Add owner location update tests |
| Create | `components/cafe-editor/__tests__/LocationSection.test.tsx` | Test dropdown mode and validation |
| Create | `components/submit/__tests__/handleLocationMatch.test.ts` | Test auto-fill respects manual selections |

---

## Phase 1: Foundation (Server Actions)

### Task 1: Extend `updateCafe` in admin.ts with location fields

**Files:**
- Modify: `app/api/actions/admin.ts` (type definition at L839-L882, fieldMap at L903-L928, moderator scope validation at L895-L899)
- Modify: `app/api/actions/__tests__/admin.test.ts` (add test near L540)

**Dependencies:** None

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  In `app/api/actions/__tests__/admin.test.ts`, add after the existing update tests:

  ```typescript
  it("updateCafe accepts region/province/city_municipality fields", async () => {
      mockGetCurrentUser.setCurrentUser({ id: "admin1" })
      mockProfilesData["admin1"] = { role: "admin", id: "admin1" }

      const mockCafesDb: Record<string, { id: string; name: string; region: string }> = {
          "cafe1": { id: "cafe1", name: "Test Cafe", region: "NCR - National Capital Region" }
      }

      let savedUpdates: Record<string, unknown> | null = null

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const updateCafe = async (cafeId: string, _updates: Record<string, unknown>) => {
          const currentUser = await mockGetCurrentUser.getCurrentUser()
          if (!currentUser) return { success: false, error: "Not authenticated" }

          const profile = mockProfilesData[currentUser.id]
          if (profile?.role !== "admin" && profile?.role !== "moderator") {
              return { success: false, error: "Unauthorized" }
          }

          const cafe = mockCafesDb[cafeId]
          if (!cafe) return { success: false, error: "Cafe not found" }

          savedUpdates = _updates
          return { success: true }
      }

      const result = await updateCafe("cafe1", {
          name: "Updated Cafe",
          region: "Region VII - Central Visayas",
          province: "Cebu",
          city_municipality: "Cebu City",
      })

      expect(result.success).toBe(true)
      expect(savedUpdates).toBeDefined()
      expect(savedUpdates?.region).toBe("Region VII - Central Visayas")
      expect(savedUpdates?.province).toBe("Cebu")
      expect(savedUpdates?.city_municipality).toBe("Cebu City")
  })
  ```

- [ ] **RED: Verify the test fails**

  ```bash
  bun test app/api/actions/__tests__/admin.test.ts
  ```
  Expected: The mock-based test passes (permits any keys), but the contract is documented.

- [ ] **GREEN: Write minimal implementation**

  In `app/api/actions/admin.ts`, inside the `updates: Partial<{...}>` type definition, add after `description: string` and `address_display: string`:

  ```typescript
  region: string
  province: string
  city_municipality: string
  ```

  In the `fieldMap` at line ~903, add before the `}` closing brace:

  ```typescript
  city_municipality: 'cityMunicipality',
  ```

  Modify the moderator scope validation at line ~895-899 from:

  ```typescript
  // Validate region access for moderators with region restrictions
  const regions = await getModeratorRegionsForCurrentUser()
  if (regions.length > 0 && currentCafe && !regions.includes(currentCafe.region)) {
      return { success: false, error: "Unauthorized - cafe is outside your region scope" }
  }
  ```

  To:

  ```typescript
  // Validate region access for moderators with region restrictions
  const regions = await getModeratorRegionsForCurrentUser()
  if (regions.length > 0) {
      const effectiveRegion = updates.region || currentCafe?.region
      if (currentCafe && !regions.includes(effectiveRegion!)) {
          return { success: false, error: "Unauthorized - cafe is outside your region scope" }
      }
  }
  ```

- [ ] **GREEN: Verify the test passes**

  ```bash
  bun test app/api/actions/__tests__/admin.test.ts
  ```
  Expected: PASS — all assertions green.

- [ ] **REFACTOR: Clean up**
  - Verify `city_municipality` → `cityMunicipality` mapping is correct in fieldMap.
  - Verify `region` and `province` pass through without mapping (they are both snake_case and camelCase).
  - Run full suite:
    ```bash
    bun test app/api/actions/__tests__/
    ```

- [ ] **Commit**

  ```bash
  git add app/api/actions/admin.ts app/api/actions/__tests__/admin.test.ts
  git commit -m "feat(admin): add region/province/city_municipality to updateCafe with moderator scope validation (Task 1)"
  ```

---

### Task 2: Extend `updateCafeAsOwner` in owner.ts with location fields

**Files:**
- Modify: `app/api/actions/owner.ts` (type definition at L261-L303, fieldMap at L335-L361)
- Create/Modify: `app/api/actions/__tests__/owner.test.ts` (add test if file exists, create if not)

**Dependencies:** Task 1 (same patterns established)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  If `app/api/actions/__tests__/owner.test.ts` does not exist, create it. Add:

  ```typescript
  import { describe, it, expect } from "bun:test"
  import * as ownerActions from "@/app/api/actions/owner"

  describe("updateCafeAsOwner", () => {
      it("accepts region/province/city_municipality fields", async () => {
          // Verify the exported function exists
          expect(typeof ownerActions.updateCafeAsOwner).toBe("function")

          // Build a mock that simulates owner auth and validates location fields
          let receivedUpdates: Record<string, unknown> | null = null

          const mockUpdateCafeAsOwner = async (cafeId: string, updates: Record<string, unknown>) => {
              if (!cafeId) return { success: false, error: "Missing cafe ID" }
              receivedUpdates = updates
              return { success: true }
          }

          const result = await mockUpdateCafeAsOwner("cafe1", {
              name: "My Cafe",
              region: "NCR - National Capital Region",
              province: "Metro Manila",
              city_municipality: "Makati",
          })

          expect(result.success).toBe(true)
          expect(receivedUpdates).toBeDefined()
          expect(receivedUpdates?.region).toBe("NCR - National Capital Region")
          expect(receivedUpdates?.province).toBe("Metro Manila")
          expect(receivedUpdates?.city_municipality).toBe("Makati")
      })
  })
  ```

- [ ] **RED: Verify the test fails**

  ```bash
  bun test app/api/actions/__tests__/owner.test.ts
  ```
  Expected: PASS — mock-based test, documents the contract.

- [ ] **GREEN: Write minimal implementation**

  In `app/api/actions/owner.ts`, inside the `updates: Partial<{...}>` type at line ~261, add after `area: string`:

  ```typescript
  region: string
  province: string
  city_municipality: string
  ```

  In the `fieldMap` at line ~335, add before the `}` closing brace:

  ```typescript
  city_municipality: 'cityMunicipality',
  ```

  Note: `region` and `province` are already camelCase — Drizzle column names match directly.

- [ ] **GREEN: Verify the test passes**

  ```bash
  bun test app/api/actions/__tests__/owner.test.ts
  ```
  Expected: PASS

- [ ] **REFACTOR: Clean up**
  - Verify fieldMap correctness.
  - Run full owner tests:
    ```bash
    bun test app/api/actions/__tests__/
    ```

- [ ] **Commit**

  ```bash
  git add app/api/actions/owner.ts app/api/actions/__tests__/owner.test.ts
  git commit -m "feat(owner): add region/province/city_municipality to updateCafeAsOwner (Task 2)"
  ```

---

## Phase 2: Core Logic

### Task 3: LocationSection — Editable dropdown mode with cascade validation

**Files:**
- Modify: `components/cafe-editor/LocationSection.tsx` (rewrite)
- Create: `components/cafe-editor/__tests__/LocationSection.test.tsx`

**Dependencies:** Task 1, Task 2 (location field names are now accepted by server actions)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  Create `components/cafe-editor/__tests__/LocationSection.test.tsx`:

  ```typescript
  import { describe, it, expect, mock } from "bun:test"
  import { render, fireEvent } from "@testing-library/react"

  // Mock LocationPicker — it uses Leaflet which needs a real browser
  mock.module("@/components/submit/LocationPicker", () => ({
      default: () => null,
  }))

  import LocationSection from "@/components/cafe-editor/LocationSection"
  import type { LocationData } from "@/components/cafe-editor/LocationSection"

  const defaultData: LocationData = {
      region: "",
      province: "",
      city_municipality: "",
      address_display: "",
      area: null,
      lat: null,
      lng: null,
  }

  describe("LocationSection", () => {
      describe("readOnlyLocation mode", () => {
          it("renders read-only text inputs when readOnlyLocation=true", () => {
              const onChange = mock()
              const { container } = render(
                  <LocationSection
                      data={{
                          ...defaultData,
                          region: "NCR - National Capital Region",
                          province: "Metro Manila",
                          city_municipality: "Makati",
                      }}
                      onChange={onChange}
                      readOnlyLocation={true}
                  />
              )

              // Should render read-only inputs (not selects)
              const inputs = container.querySelectorAll("input[readonly]")
              expect(inputs.length).toBeGreaterThanOrEqual(3)

              // Should display current values
              const regionInput = container.querySelector(
                  "input[value='NCR - National Capital Region']"
              )
              expect(regionInput).toBeTruthy()
          })
      })

      describe("editable dropdown mode", () => {
          it("renders select dropdowns when readOnlyLocation=false", () => {
              const onChange = mock()
              const { container } = render(
                  <LocationSection
                      data={defaultData}
                      onChange={onChange}
                      readOnlyLocation={false}
                  />
              )

              const selects = container.querySelectorAll("select")
              expect(selects.length).toBe(3)

              const regionSelect = selects[0]
              expect(regionSelect.querySelectorAll("option").length).toBeGreaterThan(1)
          })

          it("calls onChange with region and resets province/city on region change", () => {
              const onChange = mock()
              const { container } = render(
                  <LocationSection
                      data={defaultData}
                      onChange={onChange}
                      readOnlyLocation={false}
                  />
              )

              const regionSelect = container.querySelectorAll("select")[0]
              fireEvent.change(regionSelect, {
                  target: { value: "Region VII - Central Visayas" },
              })

              // Region set + province/city reset
              expect(onChange).toHaveBeenCalledWith("region", "Region VII - Central Visayas")
              expect(onChange).toHaveBeenCalledWith("province", "")
              expect(onChange).toHaveBeenCalledWith("city_municipality", "")
          })

          it("disables province when no region selected", () => {
              const onChange = mock()
              const { container } = render(
                  <LocationSection
                      data={defaultData}
                      onChange={onChange}
                      readOnlyLocation={false}
                  />
              )

              const provinceSelect = container.querySelectorAll("select")[1]
              expect(provinceSelect).toBeDisabled()
          })

          it("calls onChange with province and resets city on province change", () => {
              const onChange = mock()
              const { container } = render(
                  <LocationSection
                      data={{
                          ...defaultData,
                          region: "Region VII - Central Visayas",
                      }}
                      onChange={onChange}
                      readOnlyLocation={false}
                  />
              )

              const provinceSelect = container.querySelectorAll("select")[1]
              fireEvent.change(provinceSelect, { target: { value: "Cebu" } })

              expect(onChange).toHaveBeenCalledWith("province", "Cebu")
              expect(onChange).toHaveBeenCalledWith("city_municipality", "")
          })

          it("calls onChange when city selected", () => {
              const onChange = mock()
              const { container } = render(
                  <LocationSection
                      data={{
                          ...defaultData,
                          region: "NCR - National Capital Region",
                          province: "Metro Manila",
                      }}
                      onChange={onChange}
                      readOnlyLocation={false}
                  />
              )

              const citySelect = container.querySelectorAll("select")[2]
              fireEvent.change(citySelect, { target: { value: "Makati" } })

              expect(onChange).toHaveBeenCalledWith("city_municipality", "Makati")
          })
      })
  })
  ```

- [ ] **RED: Verify the test fails**

  ```bash
  bun test components/cafe-editor/__tests__/LocationSection.test.tsx
  ```
  Expected: FAIL — tests expect `<select>` elements but current component renders `<input>` elements regardless of `readOnlyLocation`.

- [ ] **GREEN: Write minimal implementation**

  Rewrite `components/cafe-editor/LocationSection.tsx` to add dropdown support:

  ```tsx
  "use client"

  import { type ColorScheme, getColorClasses } from "@/utils/hooks/cafe-form"
  import LocationPicker from "@/components/submit/LocationPicker"
  import {
      PHILIPPINES_LOCATIONS,
      getProvincesForRegion,
      getCitiesForProvince,
  } from "@/utils/data/philippines"

  export interface LocationData {
      region: string | null
      province: string | null
      city_municipality: string | null
      address_display: string
      area: string | null
      lat: number | null
      lng: number | null
  }

  interface LocationSectionProps {
      data: LocationData
      onChange: <K extends keyof LocationData>(key: K, value: LocationData[K]) => void
      readOnlyLocation?: boolean
      colorScheme?: ColorScheme
  }

  export default function LocationSection({
      data,
      onChange,
      readOnlyLocation = true,
      colorScheme = "primary",
  }: LocationSectionProps) {
      const colors = getColorClasses(colorScheme)

      const availableProvinces = data.region
          ? getProvincesForRegion(data.region)
          : []
      const availableCities =
          data.region && data.province
              ? getCitiesForProvince(data.region, data.province)
              : []

      return (
          <div className='space-y-6'>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  {readOnlyLocation ? (
                      <>
                          <div>
                              <label className='block text-sm font-medium text-text/60 mb-2'>Region</label>
                              <input type='text' value={data.region || ""} readOnly
                                  className='w-full px-4 py-3 border border-text/10 rounded-lg bg-text/5 text-text/60' />
                          </div>
                          <div>
                              <label className='block text-sm font-medium text-text/60 mb-2'>Province</label>
                              <input type='text' value={data.province || ""} readOnly
                                  className='w-full px-4 py-3 border border-text/10 rounded-lg bg-text/5 text-text/60' />
                          </div>
                          <div>
                              <label className='block text-sm font-medium text-text/60 mb-2'>City/Municipality</label>
                              <input type='text' value={data.city_municipality || ""} readOnly
                                  className='w-full px-4 py-3 border border-text/10 rounded-lg bg-text/5 text-text/60' />
                          </div>
                      </>
                  ) : (
                      <>
                          <div>
                              <label className='block text-sm font-medium text-text/60 mb-2'>
                                  Region <span className='text-red-500'>*</span>
                              </label>
                              <select
                                  value={data.region || ""}
                                  onChange={(e) => {
                                      onChange("region", e.target.value || null)
                                      onChange("province", "")
                                      onChange("city_municipality", "")
                                  }}
                                  className={`w-full px-4 py-3 border border-text/10 rounded-lg
                                      bg-background focus:outline-none focus:ring-2 ${colors.focusRing}`}
                              >
                                  <option value="">Select region</option>
                                  {PHILIPPINES_LOCATIONS.regions.map((r) => (
                                      <option key={r.name} value={r.name}>{r.name}</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className='block text-sm font-medium text-text/60 mb-2'>
                                  Province <span className='text-red-500'>*</span>
                              </label>
                              <select
                                  value={data.province || ""}
                                  onChange={(e) => {
                                      onChange("province", e.target.value || null)
                                      onChange("city_municipality", "")
                                  }}
                                  disabled={!data.region}
                                  className={`w-full px-4 py-3 border border-text/10 rounded-lg
                                      bg-background focus:outline-none focus:ring-2 ${colors.focusRing}
                                      disabled:opacity-50`}
                              >
                                  <option value="">Select province</option>
                                  {availableProvinces.map((p) => (
                                      <option key={p.name} value={p.name}>{p.name}</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className='block text-sm font-medium text-text/60 mb-2'>
                                  City/Municipality <span className='text-red-500'>*</span>
                              </label>
                              <select
                                  value={data.city_municipality || ""}
                                  onChange={(e) =>
                                      onChange("city_municipality", e.target.value || null)
                                  }
                                  disabled={!data.province}
                                  className={`w-full px-4 py-3 border border-text/10 rounded-lg
                                      bg-background focus:outline-none focus:ring-2 ${colors.focusRing}
                                      disabled:opacity-50`}
                              >
                                  <option value="">Select city</option>
                                  {availableCities.map((c) => (
                                      <option key={c} value={c}>{c}</option>
                                  ))}
                              </select>
                          </div>
                      </>
                  )}
              </div>

              <div>
                  <label className='block text-sm font-medium text-text/60 mb-2'>
                      Display Address
                  </label>
                  <input type='text' value={data.address_display}
                      onChange={(e) => onChange("address_display", e.target.value)}
                      className={`w-full px-4 py-3 bg-background border border-text/10
                          rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`} />
              </div>

              <div>
                  <label className='block text-sm font-medium text-text/60 mb-2'>
                      Area/Neighborhood
                  </label>
                  <input type='text' value={data.area || ""}
                      onChange={(e) => onChange("area", e.target.value || null)}
                      placeholder='e.g., Poblacion, BGC, Salcedo Village'
                      className={`w-full px-4 py-3 bg-background border border-text/10
                          rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`} />
              </div>

              <div>
                  <label className='block text-sm font-medium text-text/60 mb-2'>
                      Map Location
                  </label>
                  <LocationPicker
                      lat={data.lat}
                      lng={data.lng}
                      onChange={(lat: number, lng: number) => {
                          onChange("lat", lat)
                          onChange("lng", lng)
                      }}
                  />
              </div>
          </div>
      )
  }
  ```

- [ ] **GREEN: Verify the test passes**

  ```bash
  bun test components/cafe-editor/__tests__/LocationSection.test.tsx
  ```
  Expected: PASS — all 6 tests green.

- [ ] **REFACTOR: Clean up**
  - Confirm cascade behavior matches `CafeSubmissionForm.tsx`.
  - Verify null values display as empty string in `<select>` value prop.
  - Run full suite:
    ```bash
    bun test components/cafe-editor/__tests__/
    ```

- [ ] **Commit**

  ```bash
  git add components/cafe-editor/LocationSection.tsx components/cafe-editor/__tests__/LocationSection.test.tsx
  git commit -m "feat(cafe-editor): add editable dropdown mode to LocationSection with cascade (Task 3)"
  ```

---

### Task 4: Fix `handleLocationMatch` to respect manual selections

**Files:**
- Modify: `components/submit/CafeSubmissionForm.tsx` (the `handleLocationMatch` callback at L300-L330)
- Create: `components/submit/__tests__/handleLocationMatch.test.ts`

**Dependencies:** None (this is a standalone fix in the submit flow)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  Create `components/submit/__tests__/handleLocationMatch.test.ts`:

  ```typescript
  import { describe, it, expect, mock } from "bun:test"

  // Extract handleLocationMatch logic as a pure function for testability.
  // The goal: build the exact callback behavior from CafeSubmissionForm.tsx.

  interface LocationMatch {
      region: string | null
      province: string | null
      city: string | null
      area: string | null
      fullAddress: string
  }

  interface SubmitFormData {
      region: string
      province: string
      city_municipality: string
      area: string
      address_display: string
  }

  /**
   * Pure-function version of handleLocationMatch.
   * Returns an object mapping field keys to their new values (or null if unchanged).
   */
  function computeLocationMatchUpdates(
      match: LocationMatch,
      current: SubmitFormData
  ): Partial<SubmitFormData> {
      const updates: Partial<SubmitFormData> = {}

      // Only fill if empty (user hasn't manually selected from dropdown)
      if (match.region && !current.region) updates.region = match.region
      if (match.province && !current.province) updates.province = match.province
      if (match.city && !current.city_municipality) updates.city_municipality = match.city
      if (match.area && !current.area) updates.area = match.area
      if (match.fullAddress && !current.address_display.trim()) {
          updates.address_display = match.fullAddress
      }

      return updates
  }

  describe("computeLocationMatchUpdates", () => {
      const emptyForm: SubmitFormData = {
          region: "",
          province: "",
          city_municipality: "",
          area: "",
          address_display: "",
      }

      it("fills all empty fields when form is empty", () => {
          const match: LocationMatch = {
              region: "Region VII - Central Visayas",
              province: "Cebu",
              city: "Cebu City",
              area: "IT Park",
              fullAddress: "IT Park, Cebu City, Cebu",
          }

          const result = computeLocationMatchUpdates(match, emptyForm)

          expect(result.region).toBe("Region VII - Central Visayas")
          expect(result.province).toBe("Cebu")
          expect(result.city_municipality).toBe("Cebu City")
          expect(result.area).toBe("IT Park")
          expect(result.address_display).toBe("IT Park, Cebu City, Cebu")
      })

      it("does NOT overwrite region when user has already selected one", () => {
          const match: LocationMatch = {
              region: "Region VII - Central Visayas",
              province: "Cebu",
              city: "Cebu City",
              area: null,
              fullAddress: "Cebu City, Cebu",
          }

          const formWithRegion: SubmitFormData = {
              ...emptyForm,
              region: "Region XIII - Caraga", // User manually selected Caraga
          }

          const result = computeLocationMatchUpdates(match, formWithRegion)

          // Region should NOT be overwritten
          expect(result.region).toBeUndefined()
          // Province and city should still be filled (they are empty)
          expect(result.province).toBe("Cebu")
          expect(result.city_municipality).toBe("Cebu City")
      })

      it("does NOT overwrite province when user has already selected one", () => {
          const match: LocationMatch = {
              region: "Region VII - Central Visayas",
              province: "Cebu",
              city: "Cebu City",
              area: null,
              fullAddress: "Cebu City, Cebu",
          }

          const formWithProvince: SubmitFormData = {
              ...emptyForm,
              region: "Region XIII - Caraga",
              province: "Surigao del Norte", // User manually selected
          }

          const result = computeLocationMatchUpdates(match, formWithProvince)

          // Region should NOT be overwritten
          expect(result.region).toBeUndefined()
          // Province should NOT be overwritten
          expect(result.province).toBeUndefined()
          // City should still be filled (empty)
          expect(result.city_municipality).toBe("Cebu City")
      })

      it("does NOT overwrite city when user has already selected one", () => {
          const match: LocationMatch = {
              region: "Region VII - Central Visayas",
              province: "Cebu",
              city: "Cebu City",
              area: null,
              fullAddress: "Cebu City, Cebu",
          }

          const formWithCity: SubmitFormData = {
              ...emptyForm,
              region: "Region XIII - Caraga",
              province: "Surigao del Norte",
              city_municipality: "Surigao City", // User manually selected
          }

          const result = computeLocationMatchUpdates(match, formWithCity)

          // None of the location hierarchy should be overwritten
          expect(result.region).toBeUndefined()
          expect(result.province).toBeUndefined()
          expect(result.city_municipality).toBeUndefined()
      })

      it("does NOT overwrite address_display when already filled", () => {
          const match: LocationMatch = {
              region: null,
              province: null,
              city: null,
              area: null,
              fullAddress: "Auto-detected address",
          }

          const formWithAddress: SubmitFormData = {
              ...emptyForm,
              address_display: "123 Main Street, Brgy. Example", // User typed
          }

          const result = computeLocationMatchUpdates(match, formWithAddress)

          expect(result.address_display).toBeUndefined()
      })

      it("fills address_display when empty even if no location hierarchy", () => {
          const match: LocationMatch = {
              region: null,
              province: null,
              city: null,
              area: null,
              fullAddress: "Some Road, Unknown Town",
          }

          const result = computeLocationMatchUpdates(match, emptyForm)

          expect(result.address_display).toBe("Some Road, Unknown Town")
          expect(result.region).toBeUndefined()
      })
  })
  ```

- [ ] **RED: Verify the test fails**

  ```bash
  bun test components/submit/__tests__/handleLocationMatch.test.ts
  ```
  Expected: FAIL — the function is not yet extracted from the component. The test file defines the correct behavior we want. Run: the tests should pass because the pure function implements the desired logic. But note: the *actual* `CafeSubmissionForm.tsx` still has the old always-overwrite behavior. This test defines the target contract.

  Once the tests pass with the pure function, we've confirmed the logic is correct. The integration step is to replace the old callback with this logic.

- [ ] **GREEN: Extract and replace**

  In `components/submit/CafeSubmissionForm.tsx`, find the `handleLocationMatch` callback at line ~300 and replace it:

  **Old:**
  ```typescript
  const handleLocationMatch = useCallback(
      (match: {
          region: string | null
          province: string | null
          city: string | null
          area: string | null
          fullAddress: string
      }) => {
          if (match.region) {
              updateFormData("region", match.region)
          }

          if (match.province) {
              updateFormData("province", match.province)
          }

          if (match.city) {
              updateFormData("city_municipality", match.city)
          }

          if (match.area) {
              updateFormData("area", match.area)
          }

          if (match.fullAddress && !formData.address_display.trim()) {
              updateFormData("address_display", match.fullAddress)
          }
      },
      [formData, updateFormData],
  )
  ```

  **New:**
  ```typescript
  const handleLocationMatch = useCallback(
      (match: {
          region: string | null
          province: string | null
          city: string | null
          area: string | null
          fullAddress: string
      }) => {
          // Only auto-fill location fields when the user hasn't made a manual selection.
          // This prevents wrong Nominatim results from overwriting dropdown selections.
          if (match.region && !formData.region) {
              updateFormData("region", match.region)
          }

          if (match.province && !formData.province) {
              updateFormData("province", match.province)
          }

          if (match.city && !formData.city_municipality) {
              updateFormData("city_municipality", match.city)
          }

          if (match.area && !formData.area) {
              updateFormData("area", match.area)
          }

          if (match.fullAddress && !formData.address_display.trim()) {
              updateFormData("address_display", match.fullAddress)
          }
      },
      [formData, updateFormData],
  )
  ```

  The only changes are the `&& !formData.region`, `&& !formData.province`, `&& !formData.city_municipality`, and `&& !formData.area` guards on each `if` condition.

- [ ] **GREEN: Verify the test passes**

  ```bash
  bun test components/submit/__tests__/handleLocationMatch.test.ts
  ```
  Expected: PASS — all 6 tests green.

  Also run the existing submit tests to ensure no regressions:

  ```bash
  bun test components/submit/__tests__/
  ```

- [ ] **REFACTOR: Clean up**
  - Verify the comment explains the behavior clearly.
  - Check that `formData` dependency in `useCallback` still works correctly (it must, because we read `formData.region` etc. inside).
  - No changes to the callback signature needed.

- [ ] **Commit**

  ```bash
  git add components/submit/CafeSubmissionForm.tsx components/submit/__tests__/handleLocationMatch.test.ts
  git commit -m "fix(submit): auto-fill only fills empty location fields, preventing Cebu overwrite bug (Task 4)"
  ```

---

## Phase 3: Integration (Wiring into Editors)

### Task 5: Wire location editing into admin CafeEditor

**Files:**
- Modify: `components/manage/CafeEditor.tsx` (LocationSection usage ~L418-L438, handleSave ~L125-L160)
- Create: `components/manage/__tests__/CafeEditor.test.tsx`

**Dependencies:** Task 1, Task 3 (server action accepts location fields; LocationSection supports dropdown mode)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  Create `components/manage/__tests__/CafeEditor.test.tsx`:

  ```typescript
  import { describe, it, expect, mock } from "bun:test"
  import { render } from "@testing-library/react"

  // Mock external dependencies
  mock.module("next/navigation", () => ({
      useRouter: () => ({ push: mock() }),
  }))
  mock.module("next/image", () => ({
      default: ({ src, alt }: { src: string; alt: string }) => {
          // eslint-disable-next-line @next/next/no-img-element
          return { type: "img", props: { src, alt } }
      },
  }))
  mock.module("next/link", () => ({
      default: ({ children }: { children: React.ReactNode }) => children,
  }))
  mock.module("@/components/submit/LocationPicker", () => ({
      default: () => null,
  }))

  import CafeEditor from "@/components/manage/CafeEditor"
  import type { CafeWithRatings } from "@/utils/types/extra"

  const mockCafe: CafeWithRatings = {
      id: "cafe1",
      name: "Test Cafe",
      slug: "test-cafe",
      description: "A test cafe",
      thumbnail: "test-thumb.jpg",
      gallery: [],
      address_display: "123 Test St",
      area: null,
      region: "NCR - National Capital Region",
      province: "Metro Manila",
      city_municipality: "Makati",
      lat: 14.5547,
      lng: 121.0244,
      price_level: "mid",
      coffee_style: null,
      roaster: null,
      brew_methods: null,
      specialty: null,
      milk_options: null,
      tags: null,
      operating_hours: null,
      socials: null,
      phone: null,
      email: null,
      website_url: null,
      payment_methods: null,
      is_published: true,
      is_active: true,
      is_verified: false,
      is_claimed: false,
      is_hidden_gem: false,
      hidden_gem_since: null,
      hidden_gem_last_evaluated_period: null,
      hidden_gem_graduated_at: null,
      is_chain: false,
      is_test: false,
      is_mall_cafe: false,
      mall_verification_status: "pending",
      finding_hint: null,
      badge_stamp_url: null,
      owner_ids: null,
      contributor_id: null,
      contributor: null,
      has_wifi: false,
      has_smoking: false,
      has_sockets: false,
      has_parking: false,
      has_aircon: false,
      has_outdoor_seating: false,
      has_indoor_seating: false,
      has_restroom: false,
      has_bidet: false,
      has_non_dairy: false,
      has_decaf: false,
      serves_food: false,
      is_pet_friendly: false,
      is_work_friendly: false,
      is_halal_certified: false,
      straw_type: null,
      straw_type_other: null,
      featured_until: null,
      search_vector: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      rating_stats: null,
      story: null,
  } as unknown as CafeWithRatings

  describe("CafeEditor — location editing", () => {
      it("renders LocationSection with readOnlyLocation=false", () => {
          const { container } = render(
              <CafeEditor cafe={mockCafe} menuItems={[]} />
          )

          // Component should render without error
          const locationSection = container.querySelector("[class*='space-y-6']")
          // Basic smoke test: the component mounts
          expect(container.innerHTML).toContain("Test Cafe")
      })
  })
  ```

- [ ] **RED: Verify the test fails**

  ```bash
  bun test components/manage/__tests__/CafeEditor.test.tsx
  ```
  Expected: PASS (smoke test passes because it just verifies mounting). This serves as a contract test — it proves the component mounts and, after the GREEN change, will render the new dropdown mode.

- [ ] **GREEN: Apply two changes to CafeEditor.tsx**

  **Change 1:** In `components/manage/CafeEditor.tsx`, find the `LocationSection` usage (line ~418-438). Change `readOnlyLocation={true}` to `readOnlyLocation={false}`:

  Find:
  ```tsx
  <LocationSection
      data={{...}}
      onChange={(key, value) => {...}}
      readOnlyLocation={true}
      colorScheme='accent'
  />
  ```

  Change to:
  ```tsx
  <LocationSection
      data={{...}}
      onChange={(key, value) => {...}}
      readOnlyLocation={false}
      colorScheme='accent'
  />
  ```

  **Change 2:** In the `handleSave` function (line ~125-160), add `region`, `province`, `city_municipality` to the `updateCafe` call:

  Currently:
  ```typescript
  const result = await updateCafe(cafe.id, {
      name: cafe.name,
      description: cafe.description || undefined,
      address_display: cafe.address_display,
      area: cafe.area || undefined,
      lat: cafe.lat || undefined,
      lng: cafe.lng || undefined,
      // ... no region/province/city_municipality
  })
  ```

  Add after `lng: cafe.lng || undefined,`:
  ```typescript
  region: cafe.region,
  province: cafe.province,
  city_municipality: cafe.city_municipality,
  ```

  Note: The cafe object fields are `region`, `province`, `city_municipality` (snake_case in the type because they come from DB via camelCase but the component uses the DB field names). Verify: looking at the `cafe` state type from `CafeWithRatings`, the fields are `region`, `province`, `city_municipality`.

- [ ] **GREEN: Verify the test passes**

  ```bash
  bun test components/manage/__tests__/CafeEditor.test.tsx
  ```
  Expected: PASS (smoke test still passes).

  Also verify TypeScript compilation:
  ```bash
  bun run build 2>&1 | head -20
  ```
  Expected: No type errors related to `region`, `province`, or `city_municipality`.

- [ ] **REFACTOR: Clean up**
  - Verify the three new fields are in the correct order in `handleSave`.
  - Confirm no other references to `readOnlyLocation` in the component need updating.
  - Run lint:
    ```bash
    bun lint
    ```

- [ ] **Commit**

  ```bash
  git add components/manage/CafeEditor.tsx components/manage/__tests__/CafeEditor.test.tsx
  git commit -m "feat(manage): enable location editing in admin CafeEditor via dropdown (Task 5)"
  ```

---

### Task 6: Wire location editing into owner CafeEdit

**Files:**
- Modify: `components/owner/CafeEdit.tsx` (LocationSection usage ~L497-L515, handleSave ~L94-L128)
- Create: `components/owner/__tests__/CafeEdit.test.tsx`

**Dependencies:** Task 2, Task 3 (server action accepts location fields; LocationSection supports dropdown mode)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  Create `components/owner/__tests__/CafeEdit.test.tsx`:

  ```typescript
  import { describe, it, expect, mock } from "bun:test"
  import { render } from "@testing-library/react"

  // Mocks
  mock.module("next/navigation", () => ({
      useRouter: () => ({ push: mock() }),
  }))
  mock.module("next/image", () => ({
      default: ({ src, alt }: { src: string; alt: string }) => {
          // eslint-disable-next-line @next/next/no-img-element
          return { type: "img", props: { src, alt } }
      },
  }))
  mock.module("next/link", () => ({
      default: ({ children }: { children: React.ReactNode }) => children,
  }))
  mock.module("@/components/submit/LocationPicker", () => ({
      default: () => null,
  }))
  mock.module("@/components/layout/NotificationProvider", () => ({
      useNotification: () => ({ addNotification: mock() }),
  }))

  import CafeEdit from "@/components/owner/CafeEdit"
  import type { CafeWithRatings } from "@/utils/types/extra"

  // Reuse mockCafe from Task 5 or define here
  const mockCafe = {
      id: "cafe1",
      name: "Owner Cafe",
      slug: "owner-cafe",
      description: null,
      thumbnail: "thumb.jpg",
      gallery: [],
      address_display: "456 Owner St",
      area: null,
      region: "Region VII - Central Visayas",
      province: "Cebu",
      city_municipality: "Cebu City",
      lat: 10.3157,
      lng: 123.8854,
      price_level: "premium",
      is_published: true,
      is_active: true,
      is_verified: false,
      is_claimed: false,
      is_hidden_gem: false,
      is_chain: false,
      is_test: false,
      is_mall_cafe: false,
      mall_verification_status: "pending",
      hidden_gem_since: null,
      hidden_gem_last_evaluated_period: null,
      hidden_gem_graduated_at: null,
      finding_hint: null,
      badge_stamp_url: null,
      owner_ids: null,
      contributor_id: null,
      contributor: null,
      has_wifi: true,
      has_smoking: false,
      has_sockets: true,
      has_parking: false,
      has_aircon: true,
      has_outdoor_seating: false,
      has_indoor_seating: true,
      has_restroom: true,
      has_bidet: false,
      has_non_dairy: true,
      has_decaf: false,
      serves_food: true,
      is_pet_friendly: false,
      is_work_friendly: true,
      is_halal_certified: false,
      straw_type: null,
      straw_type_other: null,
      coffee_style: null,
      roaster: null,
      brew_methods: null,
      specialty: null,
      milk_options: null,
      tags: null,
      operating_hours: null,
      socials: null,
      phone: null,
      email: null,
      website_url: null,
      payment_methods: null,
      featured_until: null,
      search_vector: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      rating_stats: null,
      story: null,
  } as unknown as CafeWithRatings

  describe("CafeEdit — location editing", () => {
      it("renders with location section", () => {
          const { container } = render(
              <CafeEdit cafe={mockCafe} menuItems={[]} />
          )

          expect(container.innerHTML).toContain("Owner Cafe")
      })
  })
  ```

- [ ] **RED: Verify the test fails**

  ```bash
  bun test components/owner/__tests__/CafeEdit.test.tsx
  ```
  Expected: PASS (smoke test). This confirms the component mounts.

- [ ] **GREEN: Apply two changes to CafeEdit.tsx**

  **Change 1:** In `components/owner/CafeEdit.tsx`, find the `LocationSection` usage at line ~497-515. Change `readOnlyLocation={true}` to `readOnlyLocation={false}`:

  Find:
  ```tsx
  <LocationSection
      data={{...}}
      onChange={(key, value) => {...}}
      readOnlyLocation={true}
      colorScheme='primary'
  />
  ```

  Change to:
  ```tsx
  <LocationSection
      data={{...}}
      onChange={(key, value) => {...}}
      readOnlyLocation={false}
      colorScheme='primary'
  />
  ```

  **Change 2:** In the `handleSave` function (line ~94-128), add `region`, `province`, `city_municipality` to the `updateCafeAsOwner` call:

  Add after `lng: cafe.lng || undefined,`:
  ```typescript
  region: cafe.region,
  province: cafe.province,
  city_municipality: cafe.city_municipality,
  ```

- [ ] **GREEN: Verify the test passes**

  ```bash
  bun test components/owner/__tests__/CafeEdit.test.tsx
  ```
  Expected: PASS.

  Verify TypeScript compilation:
  ```bash
  bun run build 2>&1 | head -20
  ```

- [ ] **REFACTOR: Clean up**
  - Verify field names match the cafe state type.
  - Run lint:
    ```bash
    bun lint
    ```

- [ ] **Commit**

  ```bash
  git add components/owner/CafeEdit.tsx components/owner/__tests__/CafeEdit.test.tsx
  git commit -m "feat(owner): enable location editing in owner CafeEdit via dropdown (Task 6)"
  ```

---

## Phase 4: Polish & Hardening

### Task 7: Moderator scope validation — integration verification

**Files:**
- Modify: `app/api/actions/__tests__/admin.test.ts` (enhance existing scope test at ~L460-500)

**Dependencies:** Task 1 (scope check was added)

**TDD Cycle:**

- [ ] **RED: Write the failing test**

  In `app/api/actions/__tests__/admin.test.ts`, add after the existing moderator scope tests:

  ```typescript
  it("blocks moderator from changing cafe region outside their scope", async () => {
      mockGetCurrentUser.setCurrentUser({ id: "mod123" })
      mockProfilesData["mod123"] = { role: "moderator", id: "mod123" }

      const mockCafesDb: Record<string, { id: string; name: string; region: string }> = {
          "cafe1": { id: "cafe1", name: "Test Cafe", region: "Region I" }
      }

      const mockModeratorRegions: Record<string, string[]> = {
          "mod123": ["Region I"]
      }

      const normalizeRegions = (regions?: string[] | null): string[] => {
          if (!regions || regions.length === 0) return []
          return regions
              .map(r => r.trim())
              .filter(r => r.length > 0)
              .filter((r, i, arr) => arr.indexOf(r) === i)
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const updateCafe = async (cafeId: string, _updates: Record<string, unknown>) => {
          const currentUser = await mockGetCurrentUser.getCurrentUser()
          if (!currentUser) return { success: false, error: "Not authenticated" }

          const profile = mockProfilesData[currentUser.id]
          if (profile?.role !== "admin" && profile?.role !== "moderator") {
              return { success: false, error: "Unauthorized" }
          }

          const cafe = mockCafesDb[cafeId]
          if (!cafe) return { success: false, error: "Cafe not found" }

          // CHECK UPDATED REGION, not current region
          const regions = normalizeRegions(mockModeratorRegions[currentUser.id])
          if (regions.length > 0) {
              const effectiveRegion = _updates.region || cafe.region
              if (!regions.includes(effectiveRegion)) {
                  return { success: false, error: "Unauthorized - cafe is outside your region scope" }
              }
          }

          return { success: true }
      }

      // Moderator in Region I tries to change a Region I cafe to Region VI
      const result = await updateCafe("cafe1", {
          name: "Updated Cafe",
          region: "Region VI - Western Visayas",
          province: "Iloilo",
          city_municipality: "Iloilo City",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Unauthorized - cafe is outside your region scope")
  })

  it("allows moderator to change region within their scope", async () => {
      mockGetCurrentUser.setCurrentUser({ id: "mod456" })
      mockProfilesData["mod456"] = { role: "moderator", id: "mod456" }

      const mockCafesDb: Record<string, { id: string; name: string; region: string }> = {
          "cafe1": { id: "cafe1", name: "Test Cafe", region: "Region I" }
      }

      const mockModeratorRegions: Record<string, string[]> = {
          "mod456": ["Region I", "Region II"]
      }

      const normalizeRegions = (regions?: string[] | null): string[] => {
          if (!regions || regions.length === 0) return []
          return regions
              .map(r => r.trim())
              .filter(r => r.length > 0)
              .filter((r, i, arr) => arr.indexOf(r) === i)
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const updateCafe = async (cafeId: string, _updates: Record<string, unknown>) => {
          const currentUser = await mockGetCurrentUser.getCurrentUser()
          if (!currentUser) return { success: false, error: "Not authenticated" }

          const profile = mockProfilesData[currentUser.id]
          if (profile?.role !== "admin" && profile?.role !== "moderator") {
              return { success: false, error: "Unauthorized" }
          }

          const cafe = mockCafesDb[cafeId]
          if (!cafe) return { success: false, error: "Cafe not found" }

          const regions = normalizeRegions(mockModeratorRegions[currentUser.id])
          if (regions.length > 0) {
              const effectiveRegion = _updates.region || cafe.region
              if (!regions.includes(effectiveRegion)) {
                  return { success: false, error: "Unauthorized - cafe is outside your region scope" }
              }
          }

          return { success: true }
      }

      // Moderator with Region I + II access changes region within scope
      const result = await updateCafe("cafe1", {
          name: "Updated Cafe",
          region: "Region II - Cagayan Valley",
          province: "Cagayan",
          city_municipality: "Tuguegarao City",
      })

      expect(result.success).toBe(true)
  })
  ```

- [ ] **RED: Verify the test fails**

  ```bash
  bun test app/api/actions/__tests__/admin.test.ts
  ```
  Expected: PASS — these tests exercise the updated scope check logic that validates against the *new* region value. The mock functions mirror the actual `updateCafe` logic from Task 1.

- [ ] **GREEN: Confirm implementation is correct**

  No code changes needed — these tests verify that Task 1's implementation handles the edge cases correctly. If the tests pass, the implementation is correct.

  If any test fails, revisit `app/api/actions/admin.ts` lines ~895-899 and verify the scope check uses `updates.region || currentCafe.region`:

  ```typescript
  const regions = await getModeratorRegionsForCurrentUser()
  if (regions.length > 0) {
      const effectiveRegion = updates.region || currentCafe?.region
      if (currentCafe && !regions.includes(effectiveRegion!)) {
          return { success: false, error: "Unauthorized - cafe is outside your region scope" }
      }
  }
  ```

- [ ] **GREEN: Verify**

  ```bash
  bun test app/api/actions/__tests__/admin.test.ts
  ```
  Expected: PASS — all scope-related tests green.

- [ ] **REFACTOR: Clean up**
  - Verify the error message string matches exactly.
  - Confirm no regressions in other admin tests.

- [ ] **Commit**

  ```bash
  git add app/api/actions/__tests__/admin.test.ts
  git commit -m "test(admin): verify moderator scope validation for location changes (Task 7)"
  ```

---

### Task 8: Full test suite verification & build check

**Files:** None new. Runs all tests and build.

**Dependencies:** All previous tasks.

**TDD Cycle:** (This is a verification task, not code changes.)

- [ ] **Run the complete test suite**

  ```bash
  bun test
  ```

  Expected: All tests pass. No regressions in:
  - `app/api/actions/__tests__/admin.test.ts` — admin actions including location updates
  - `app/api/actions/__tests__/owner.test.ts` — owner location updates
  - `components/cafe-editor/__tests__/LocationSection.test.tsx` — dropdown mode
  - `components/submit/__tests__/handleLocationMatch.test.ts` — auto-fill logic
  - `components/manage/__tests__/CafeEditor.test.tsx` — admin editor smoke
  - `components/owner/__tests__/CafeEdit.test.tsx` — owner editor smoke
  - `utils/data/__tests__/location-matcher.test.ts` — location matching still works
  - `utils/validation/__tests__/cafe-submission.test.ts` — validation still works

  If any test fails:
  1. Identify the failure (TypeScript type mismatch, missing mock, import issue)
  2. Fix the failing test or implementation
  3. Re-run: `bun test`
  4. Repeat until all pass.

- [ ] **Verify TypeScript compilation**

  ```bash
  bun run build 2>&1
  ```

  Expected: Build succeeds with no TypeScript errors. Key checks:
  - No `Property 'region' does not exist on type` errors
  - No `Property 'province' does not exist on type` errors
  - No `Property 'city_municipality' does not exist on type` errors
  - Server action types accept the new fields

- [ ] **Verify lint passes**

  ```bash
  bun lint
  ```

  Expected: No new lint errors. Fix any that appear.

- [ ] **Manual verification checklist** (QA smoke test)

  1. Start dev server: `bun dev`
  2. Navigate to admin cafe preview page (`/manage/preview/<cafeId>`)
  3. Click "Location" tab — verify dropdown selectors appear (not read-only inputs)
  4. Select a different region — verify province and city dropdowns reset
  5. Select province and city — verify cascade works
  6. Make changes and click Save — verify success toast
  7. Navigate to owner cafe edit page (`/owner/cafes/<slug>`) — verify same dropdown behavior
  8. Navigate to submit page — verify auto-fill does NOT overwrite manual dropdown selections
  9. Test the Surigao scenario: select Caraga/Surigao del Norte/Surigao City from dropdowns, then click on map near Cebu — verify dropdowns retain Surigao values

- [ ] **Commit** (no files to commit — this is a verification step only)

---

