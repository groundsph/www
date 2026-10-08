# Payment Method Filter — Implementation Record

**Status:** implemented and verified on branch `feat/payment-method-filter`. Not committed or merged.

Follows the taxonomy work in `2026-10-08-payment-methods-taxonomy.md`, which made
`cafes.payment_methods` a canonical comma-separated token list and eliminated the
`credit_card` / `debit_card` / `qrph` / `bank_transfer` / `BPI` variants.

**Goal:** let people filter the cafe list by payment method, now that the vocabulary
is clean enough to make that meaningful.

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Which methods get chips | `card`, `gcash`, `qr_ph`, `google_pay`, `apple_pay` | Narrower than the stored vocabulary on purpose — see below |
| Multi-select semantics | OR — "takes any of the selected" | Matches the existing vibes filter, documented in `CafeFilters.tags` as "any matching". AND would let two chips return nothing, which reads as a broken filter |
| Placement | Inside the existing Filters panel | Consistent with Amenities and Vibes; no permanent weight in the controls area |
| Exact vs substring matching | Exact token | `LIKE '%card%'` would also match unrelated custom free-text values |

### Why no `cash` chip

It is on 104 of the 110 cafes that record a payment method, so filtering by it
narrows almost nothing.

### Why no `maya` chip

This was a deliberate, evidence-based call rather than an oversight. The starting
proposal was that Maya is redundant because it "just uses InstaPay/QR Ph". Maya does
ride those rails, but so does GCash, and the rails are not what a customer taps.
Owner-entered data shows the brand-specific case dominates:

| Token | Cafes | Also `qr_ph` | **Only this, no `qr_ph`** |
|---|---|---|---|
| `qr_ph` | 37 | — | — |
| `maya` | 54 | 22 | **32** |
| `gcash` | 104 | 32 | **72** |

32 of 54 Maya cafes (59%) do not list `qr_ph`, so Maya is not subsumed — it covers
*more* cafes than the chip that supposedly subsumes it. The same is true of GCash
(72 cafes with no `qr_ph`), so dropping Maya while keeping GCash would be arbitrary
on both grounds.

**Maya remains a valid stored value.** It is still selectable in the owner, admin and
public editors and still renders on those 54 cafe pages. Only the filter chip is
withheld. Removing it from the taxonomy would strand 54 rows of real information and
is explicitly out of scope here.

---

## Implementation

| File | Change |
|---|---|
| `utils/payment-methods.ts` | `FILTERABLE_PAYMENT_METHODS` and `parsePaymentMethodFilter()` |
| `utils/types/extra.ts` | `CafeFilters.payment_methods?: string[]` |
| `app/api/actions/cafe.ts` | Exact-token `OR` condition in `getAllCafes` |
| `components/cafe/CafesPageClient.tsx` | Payment chip row, plus the four filter touch points |

`parsePaymentMethodFilter()` normalizes and whitelists client-supplied values, so a
malformed or hostile filter never reaches the query, and accepts a bare string as a
one-value filter.

The SQL matches whole tokens rather than substrings:

```sql
string_to_array(coalesce(payment_methods, ''), ', ') @> ARRAY['gcash']::text[]
```

Note for anyone editing `applyPlan`-style array binds elsewhere: Drizzle expands a JS
array passed to `sql\`\`` into a row constructor, not an array parameter. The per-token
conditions are built with `sql.join` to avoid that.

### Client touch points

Adding a filter to this component needs all four, and only the first is obvious:

1. the chip row itself
2. `activeFilterCount` — needs an explicit `Array.isArray` clause, as it only special-cased `tags`
3. `getFilterParams()`
4. the debounce effect's dependency array, which lists every filter by hand

---

## Verification

The server filter was exercised through the real `getAllCafes` action and compared
against independent SQL, after accounting for the 6 chain cafes the action hides by
default (114 published − 6 chains = 108 baseline):

| Filter | Action | SQL (non-chain) | |
|---|---|---|---|
| `card` | 47 | 47 | ✅ |
| `gcash` | 98 | 98 | ✅ |
| `qr_ph` | 33 | 33 | ✅ |
| `gcash` OR `card` | 102 | 102 | ✅ |
| `maya` (dropped by whitelist) | 108 | — | ✅ returns all, not zero |

| Gate | Result |
|---|---|
| `bunx tsc --noEmit` | exit 0 |
| `bun lint` | exit 0 |
| `bun run build` | exit 0 |
| `bun test` | 936 pass / 17 fail — failure list identical to the `prod` baseline (883/17) |

UI verified in-render at a true 390px viewport (a 390px same-origin iframe of
`/cafes`, since the available launch flags would not produce a narrow viewport):

- Payment row renders exactly 5 chips: Credit / Debit Card, GCash, QR Ph / Bank Transfer, Google Pay, Apple Pay
- Price row collapses to one line at 390px (single distinct row, 26px tall)

---

## Also in this change: responsive price tiers

The price buttons read `₱ Budget` … `₱₱₱₱ Luxury` and wrapped on phones. Each is now a
symbol plus a name, with the name hidden below the `sm` breakpoint:

```
All · ₱ · ₱₱ · ₱₱₱ · ₱₱₱₱          (mobile — signs only, one line)
All · ₱ Budget · ₱₱ Mid · …      (≥640px — full labels)
```

Verified by the compiled CSS contract (`.hidden{display:none}` globally,
`.sm\:inline{display:inline}` inside `@media (min-width:40rem)`) and observed live:
`nameDisplay: none` at 390px, `inline` at 1280px. `All` keeps its label because it has
no symbol.

---

## Follow-ups (not done)

- The map page has its own filter path and does not consume `CafeFilters`, so this
  filter is cafes-list only.
- `google_pay` and `apple_pay` are filterable but currently have 0 cafes, so those two
  chips return nothing until owners tick them.
- The AI chat tool definitions (`utils/ai/tool-definitions.ts`) do not expose payment
  methods as a filter.
