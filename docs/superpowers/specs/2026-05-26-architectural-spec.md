# Architectural Specification: Manage → Cafe Location Edit & Submit Location Bugfix

## 1. Executive Summary

This spec addresses two connected problems: (1) the admin and owner cafe editors cannot modify location fields (region, province, city/municipality) because the server actions and client components were built with hardcoded read-only location constraints, and (2) the cafe submission form's reverse-geocoding auto-fill unconditionally overwrites manually selected dropdown values, causing entries submitted from one province (e.g., Surigao) to be incorrectly recorded as another (e.g., Cebu) when Nominatim returns imprecise data for the given coordinates. The solution enables admin/owner location editing with appropriate validation and fixes the submit form's auto-fill to respect manual user selections.

## 2. Constraints & Non-Negotiables

### Security
- Only admins/moderators (via `getCurrentUser` + role check) or verified cafe owners (via `isOwnerOfCafe`) may modify location details.
- Moderators with region-scoped access (`moderator_regions`) must not be able to move a cafe out of their accessible regions.
- All mutations must be logged via `logSystemAction` and `logContribution` — the existing audit trail pattern must be preserved.

### Data Integrity
- `region`, `province`, `city_municipality` columns in the `cafes` table are already `NOT NULL` (enforced by Drizzle schema). However, existing rows may have been set by valid submissions, so any update must supply non-empty values.
- The `slug` field was generated from the original `name`, `city_municipality`, and `province` at submission time. Changing location does NOT trigger slug regeneration — the slug is a permanent identifier. This is an explicit design decision: changing the slug would break existing bookmarks, search engine indexes, and SEO landing page links.
- The `search_vector` (PostgreSQL tsvector) is currently populated via triggers/migrations and does not depend on location fields being static. No re-indexing is required for location edits.

### Performance
- All location update operations execute within a single DB transaction (existing pattern from `updateCafe`). No new network calls.
- The reverse geocoding flow already has an 800ms debounce; no additional throttling is needed.

### Technology
- Must use the existing Drizzle ORM update pattern (`db.update(cafes).set(...).where(eq(cafes.id, cafeId))`).
- Must use the existing `PHILIPPINES_LOCATIONS` data structure for dropdown validation where applicable.
- Must NOT introduce new dependencies.

## 3. System Boundaries

### In Scope
1. Extending `updateCafe` (admin.ts) to accept and write `region`, `province`, `city_municipality`.
2. Extending `updateCafeAsOwner` (owner.ts) to accept and write `region`, `province`, `city_municipality`.
3. Changing `readOnlyLocation` from `true` to `false` in `CafeEditor.tsx` (admin) and the corresponding owner editor.
4. Modifying `LocationSection` to render dropdown selectors (sourced from `PHILIPPINES_LOCATIONS`) instead of free-text inputs for region/province/city, when `readOnlyLocation` is `false`.
5. Fixing `handleLocationMatch` in `CafeSubmissionForm.tsx` to only auto-fill location fields when they are currently empty.
6. Adding the `reverseGeocodeAndMatch` function as an audit point: logging should capture when auto-fill is skipped because a manual selection exists.

### Out of Scope
1. Retraining or replacing Nominatim — the third-party geocoding service is accepted as-is.
2. Rewriting `matchNominatimToLocation` — the fuzzy matching algorithm is functional for correct coordinates. The root cause is the auto-fill override, not the matcher itself. Minor improvements to the matcher index are optional.
3. Regenerating slugs on location change (rationale in §2 above).
4. Re-indexing `search_vector` or updating city/province SEO landing pages on location change — existing data is sufficient.
5. Migrating existing incorrect location entries in the database — this is a one-time data fix, not an architectural concern.

### Integration Surfaces
| Surface | Direction | Purpose |
|---------|-----------|---------|
| `db.update(cafes).set()` | Write | Persist edited location fields |
| `logSystemAction()` | Write | Audit trail for location changes |
| `logContribution()` | Write | User contribution credit for location edits |
| `reverseGeocodeAndMatch()` | Read (Nominatim API) | Auto-fill location from coordinates |
| `PHILIPPINES_LOCATIONS` | Static data | Dropdown options for region/province/city |

## 4. Component Architecture

### 4.1 New Behavior: Admin CafeEditor Location Editing

**Existing:**
```
CafeEditor (manage/CafeEditor.tsx)
  └─ LocationSection (cafe-editor/LocationSection.tsx)
       readOnlyLocation={true}
       → free-text <input>s, all read-only
  └─ handleSave()
       → updateCafe(cafeId, { ... })  // NO location fields
```

**Target:**
```
CafeEditor (manage/CafeEditor.tsx)
  └─ LocationSection (cafe-editor/LocationSection.tsx)
       readOnlyLocation={false}
       → <select> dropdowns for region/province/city from PHILIPPINES_LOCATIONS
       → editable <input> for address_display and area
       → LocationPicker for lat/lng
  └─ handleSave()
       → updateCafe(cafeId, { region, province, city_municipality, ... })  // INCLUDES location fields
```

### 4.2 New Behavior: Owner CafeEditor Location Editing

Same as admin above, with the same `readOnlyLocation={false}` change in the owner-facing editor component. The `updateCafeAsOwner` server action must accept the same additional fields.

### 4.3 Submit Form: Auto-fill Respects Manual Selections

**Existing:**
```typescript
const handleLocationMatch = useCallback((match) => {
    if (match.region) updateFormData("region", match.region)      // always overwrites
    if (match.province) updateFormData("province", match.province) // always overwrites
    if (match.city) updateFormData("city_municipality", match.city) // always overwrites
    // ...
}, [formData, updateFormData])
```

**Target:**
```typescript
const handleLocationMatch = useCallback((match) => {
    // Only auto-fill if the user hasn't made a manual selection
    if (match.region && !formData.region) updateFormData("region", match.region)
    if (match.province && !formData.province) updateFormData("province", match.province)
    if (match.city && !formData.city_municipality)
        updateFormData("city_municipality", match.city)
    // address_display and area can still be auto-filled (they are text inputs, not selectors)
    if (match.area && !formData.area) updateFormData("area", match.area)
    if (match.fullAddress && !formData.address_display.trim())
        updateFormData("address_display", match.fullAddress)
}, [formData, updateFormData])
```

This is the primary fix for the "Surigao → Cebu" bug. If a user manually selects "Caraga / Surigao del Norte / Surigao City" from the dropdowns, auto-fill will never overwrite those values — even if the coordinates resolve to "Cebu" via Nominatim.

### 4.4 New Component: LocationSection Enhancements

The existing `LocationSection` renders free-text `<input>` elements. When `readOnlyLocation` is `false`, it should instead render `<select>` dropdowns to ensure data consistency with the `PHILIPPINES_LOCATIONS` hierarchy:

- Region: `<select>` with options from `PHILIPPINES_LOCATIONS.regions`
- Province: `<select>` with options from `getProvincesForRegion(selectedRegion)`
- City/Municipality: `<select>` with options from `getCitiesForProvince(selectedRegion, selectedProvince)`

**Cascade behavior:** When the region dropdown changes, province and city must reset to empty (mirroring the existing behavior in `CafeSubmissionForm.tsx`). The dropdown must prevent empty/null submissions because all three columns are `NOT NULL` in the database schema. Client-side validation before save should enforce that all three are selected.

When `readOnlyLocation` is `true` (current default), it renders read-only text inputs showing the current values — unchanged from today.

### 4.5 Communication Patterns

All component updates use direct prop/state passing (no event bus, no global state). The server actions are Next.js server actions called directly from client components. This pattern matches the existing architecture and requires no new communication infrastructure.

## 5. Data Flow

### 5.1 Admin/Owner Edits Location

```
User edits dropdowns in LocationSection
  → onChange(key, value) updates local cafe state
  → setHasChanges(true) enables Save button
  → User clicks Save
    → handleSave() calls updateCafe() or updateCafeAsOwner()
      → Server validates auth + role/ownership + moderator region scope
        → Region scope check: if moderator has ['Region VII'], cafe must be in Region VII
        → If setting location would move cafe out of moderator scope, reject with error
      → db.update(cafes).set({ region, province, cityMunicipality, updatedAt })
      → logSystemAction('update', 'cafe', cafeId, before, after)
      → logContribution(userId, cafeId, 'UPDATE', { summary, source: 'admin_edit' })
      → Returns { success: true }
    → setHasChanges(false), shows success toast
```

### 5.2 Submit: Auto-fill from Map Coordinates

```
User clicks map / searches / uses GPS
  → lat/lng updated in form state
  → 800ms debounce
  → reverseGeocodeAndMatch(lat, lng)
    → Nominatim reverse geocode fetch
    → matchNominatimToLocation() → { region, province, city, area, fullAddress }
  → handleLocationMatch(match)
    → Checks formData.region: empty? → fill. Non-empty? → skip.
    → Checks formData.province: empty? → fill. Non-empty? → skip.
    → Checks formData.city_municipality: empty? → fill. Non-empty? → skip.
    → Fills address_display if still empty.
    → Fills area if still empty.
  → User sees their manual dropdown selections preserved.
```

### 5.3 State Ownership

| Data | Owner | Lifecycle |
|------|-------|-----------|
| `formData.region/province/city_municipality` (submit) | Client (React state in CafeSubmissionForm) | Cleared on form reset / success |
| `cafe.region/province/cityMunicipality` (edit) | Client (React state in CafeEditor) | Initialized from server, persisted on Save |
| DB location columns | PostgreSQL (`cafes` table) | Persistent until next update |
| Auto-fill result | Transient (server action response) | Garbage collected after `handleLocationMatch` |

### 5.4 Caching Strategy

No new caching needed. The reverse geocode result is not cached (each coordinate pair is a unique Nominatim request). The `PHILIPPINES_LOCATIONS` data is a static TypeScript export — it's tree-shaken and bundled with the client component, so no network fetch is required for dropdown options.

## 6. Security & Error Handling

### Authentication/Authorization
- `updateCafe`: Requires `getCurrentUser()` + role check (`admin` or `moderator`). Unchanged from current.
- `updateCafeAsOwner`: Requires `getCurrentUser()` + `isOwnerOfCafe(cafeId)`. Unchanged from current.
- Moderator region scope: The existing check compares `regions` array from `getModeratorRegionsForCurrentUser()` against `currentCafe.region`. The location edit must re-validate against the *new* region (if changed). If the updated `region` field is outside the moderator's scope, the update must be rejected.

### Input Validation
- No new Zod schema for admin updates (the existing `Partial<{...}>` type provides TypeScript-level validation). Location fields are strings - no SQL injection risk with Drizzle ORM.
- The submit flow's Zod schema already requires non-empty `region`, `province`, `city_municipality`. No schema change needed.

### Error Handling Philosophy
- Fail-closed: If the update fails (DB error, auth failure), the transaction is rolled back and the client receives `{ success: false, error: "..." }`.
- No retry: Failed updates are returned to the user for manual retry. The existing `isProcessing`/`isSubmitting` patterns handle UI blocking.
- Moderator scope violation: Returns a clear error message like "Cannot move cafe outside your moderator region scope."

### Logging & Monitoring
- Existing `logSystemAction` already captures `beforeValue` and `afterValue` for the update — this will naturally include location field diffs.
- `logContribution` will include `changed_fields: ['region', 'province', 'city_municipality']` in the summary when location fields are modified.

## 7. Migration & Rollback

### Database
No database migration is needed. The `region`, `province`, `cityMunicipality` columns already exist in the `cafes` table. This work only changes application-level read/write access to those columns.

### Backward Compatibility
- Submissions created before this change are unaffected. Their existing location data remains valid.
- The `updateCafe` function signature changes (adds optional fields), but since all existing callers pass a subset of fields, this is backward-compatible at the type level.
- The `handleLocationMatch` behavior change (fill-if-empty vs always-overwrite) only affects future submissions. Submitted cafes are unaffected.

### Rollback Strategy
1. Revert `readOnlyLocation` back to `true` in CafeEditor and owner editor.
2. Revert `updateCafe` and `updateCafeAsOwner` type definitions (remove location fields).
3. Revert `handleLocationMatch` to unconditional overwrite.
4. No database state needs reversal — only application code is changed.

## 8. Open Questions

1. **Moderator scope edge case**: When a moderator edits a cafe's location from Region A to Region A (same region), the existing check passes. But if they change it to Region B while scoped to Region A, should we block? **Decision (made in Q&A):** Block — moderator scope validation must check against the *new* region value, not the current one.

2. **Owner edit validation**: Should an owner be able to set location values that don't exist in `PHILIPPINES_LOCATIONS`? The dropdown approach constrains this, but what if PSGC data is outdated? **Decision:** Dropdowns constrain to valid values. If a new city/province/region needs to be added, that's a separate data update process.

3. **Slug sync on location change**: The `generateSlug` function embeds `cityMunicipality-province` into the slug. If an admin corrects a cafe's location, the slug will reflect the old location. Should we re-generate? **Decision (specified in §2):** No — slugs are permanent identifiers. Changing them breaks links and SEO.

4. **Bulk location corrections**: If many cafes have incorrect locations (e.g., from the "Cebu bug"), should there be a bulk tool? **Decision:** Out of scope for this spec. Handle as one-time data fix via direct DB queries with human review.
