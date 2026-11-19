# Test cafes are hidden by default; only a development build shows them

A cafe row can be flagged `is_test`, marking it as a QA fixture rather than part of the
catalogue. Such a cafe is invisible to visitors everywhere — listings, search, maps,
nearby lookups, leaderboards, feeds, sitemap, RSS, AI answers, other people's profiles,
and any blog post or event attached to it. The gate is `utils/filters.ts`:
`publicCafeConditions()` for anything listing cafes, `excludeTestCafeReferences()` for
rows that merely point at one.

The rule is **inverted from the obvious one**: hidden unless `NODE_ENV === "development"`,
rather than hidden when `NODE_ENV === "production"`. That way a preview or staging
deployment — which also builds in production mode — cannot leak a fixture either, and a
future environment cannot leak one by accident. The single escape hatch is a dev server.

## Consequences

- `bun test` runs with `NODE_ENV=test`, so fixtures are hidden under the test runner too.
  Tests must not depend on seeing a test cafe.
- A locally-built production bundle (`bun run build && bun start`) will not show a test
  cafe. Verification of this rule in a prod-like environment is by **absence** (the cafe
  is missing from search, map, nearby, sitemap), not by eye.
- Blog posts and events attached to a test cafe are **hidden entirely**, not shown with
  the cafe stripped out. The association is also rejected on write, so content cannot be
  silently hidden by a fixture being attached to it later.
- Opting out is explicit and per-condition, never a bypass of the helper:
  `publicCafeConditions({ includeDrafts: true })` for owner and admin surfaces (drafts and
  deactivated rows visible, **test cafes still hidden**), `{ includeTest: true }` for the
  slug resolver that internal tooling uses, and the narrow `omitTestCafes([...])` where a
  surface has its own visibility rules and only needs the test-cafe half.
- Stored history relaxes to the test-cafe half only. A cafe that was published in October
  and deactivated in November genuinely earned its October rank, so leaderboard snapshots
  filter on `is_test` and not on `is_published` / `is_active`.

## Considered options

- **Keep the `NODE_ENV === "production"` gate and add a `SHOW_TEST_CAFES` override flag.**
  Rejected: a mis-set flag is the failure mode being fixed, and the original leak
  survived precisely because nobody asserted absence.
- **Filter drafts and deactivated listings out of history too.** Rejected for
  leaderboards: a cafe that was published in October and has since been deactivated
  genuinely earned its October rank. Only the test-cafe half applies to stored history.
- **Recognise the fixture by slug or name in code instead of flagging the row.** Rejected:
  that is what actually happened — the code filter shipped, the row was never flagged, and
  the leak survived because the filter had nothing to act on. The flag is the contract;
  the code reads it.
