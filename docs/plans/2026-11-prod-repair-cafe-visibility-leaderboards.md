# Prod repair playbook — cafe visibility and leaderboard snapshots

Run order: **1 → 2 → 3 → 4 → 5 → 6 → 7**. Steps 1, 2 and 4 write to the prod database
and cannot be undone by reverting a commit, so each one is shown with its measured impact
before it runs. Step 3 is the deploy. Step 6 re-derives history.

The order is not arbitrary. The code in this branch reads `cafes_visited`, so the column
has to exist before it deploys; and the two unique indexes cannot be built while
duplicate rows exist, so they come after the dedupe **and after the deploy** — the old
read path inserted snapshots, so deduping before deploying would let the old code
re-dirty the table before the index is created.

Nothing here drops a table or removes a column. Every statement is re-runnable.

Connection: the prod URL is in `.env.local`, commented out. Set `DATABASE_URL` from it
for these steps; leave `.env.local` pointing at `gph-dev` the rest of the time.

---

## 0. What is being repaired, and why

Three defects, found together because they share a symptom ("the numbers look wrong"):

1. A cafe named `test-cafe` is live in prod, is not flagged `is_test`, and is reachable
   from the landing page's check-in prompt. The code filter was added in an earlier pass
   but the row was never flagged, so the filter had nothing to act on.
2. `monthly_leaderboard_snapshots` holds **21,045 duplicate rows** in 5,281 groups. The
   unique index meant to prevent that never fired, because `region`, `user_id` and
   `cafe_id` are frequently NULL and PostgreSQL treats NULLs as distinct.
3. Every stored snapshot's numbers came from a query that fanned out (visits × reviews ×
   page views), so historical cafe scores are inflated by up to the product of those
   counts. The stored rows are wrong, not merely duplicated.

---

## 1. Flag the test cafe  ⟵ writes

Measured state today:

| | |
|---|---|
| Matching rows | 1 (`slug = 'test-cafe'`, `is_test = false`, published, active) |
| Visits | 1 |
| Menu items | 1 |
| Reviews | 0 |

```sql
-- dry run
select id, slug, name, is_test, is_published, is_active
from cafes where slug = 'test-cafe';

-- apply
update cafes
set is_test = true,
    is_hidden_gem = false,
    updated_at = now()
where slug = 'test-cafe'
  and is_test = false;
```

Effect: the cafe disappears from every public surface once step 3 deploys (the check-in
prompt, search, map, leaderboard, sitemap, AI answers). It keeps its `is_published` /
`is_active` values, so a development build still shows it.

`is_hidden_gem` is cleared in the same statement because a QA fixture should not occupy a
hidden-gem slot in the hidden-gem evaluator.

Rollback: `update cafes set is_test = false where slug = 'test-cafe';`

---

## 2. Add the snapshot column  ⟵ writes DDL

One additive statement. It takes an ACCESS EXCLUSIVE lock for a few milliseconds on a
table with 26k rows and no readers blocked beyond that instant.

```sql
alter table monthly_leaderboard_snapshots
  add column if not exists cafes_visited integer;
```

This is also the first statement of the migration, so applying it here only means the
migration finds it already done.

---

## 3. Deploy the branch  ⟵ deploy

Squash-merge `feat/audit-2026-11` into `prod`, then `git push github prod` — Dokploy
builds from GitHub, so a Gitea-only merge leaves production unchanged.

From this point the read path no longer inserts snapshots; the daily cron and the admin
backfill tool are the only writers. That is what makes step 4 stick.

---

## 4. Deduplicate snapshots  ⟵ writes

Measured state today:

| | |
|---|---|
| Rows in `monthly_leaderboard_snapshots` | 26,373 |
| Distinct months | 31 (2024-04 … 2026-10) |
| Duplicate groups | 5,281 |
| **Rows to delete** | **21,045** |

Duplicates are ranked by `(rank asc, created_at asc, id asc)`, so the row kept is the
best-ranked, then the oldest. Nothing unique lives in the rows being deleted.

```sql
-- dry run: how many, and a sample
with ranked as (
  select id, type, year_month, region, user_id, cafe_id, rank, created_at,
         row_number() over (
           partition by type, year_month, coalesce(region, ''),
                        coalesce(user_id::text, ''), coalesce(cafe_id::text, '')
           order by rank asc, created_at asc, id asc
         ) as rn
  from monthly_leaderboard_snapshots
)
select count(*) filter (where rn > 1) as rows_to_delete,
       count(*) filter (where rn = 1) as rows_kept
from ranked;

-- one group, by eye
with ranked as (
  select *, row_number() over (
    partition by type, year_month, coalesce(region, ''),
                 coalesce(user_id::text, ''), coalesce(cafe_id::text, '')
    order by rank asc, created_at asc, id asc
  ) as rn
  from monthly_leaderboard_snapshots
)
select type, year_month, region, user_id, cafe_id, rank, created_at, rn
from ranked
where rn > 1
order by year_month desc
limit 20;

-- apply (single statement, so it is atomic and re-runnable)
with ranked as (
  select id, row_number() over (
    partition by type, year_month, coalesce(region, ''),
                 coalesce(user_id::text, ''), coalesce(cafe_id::text, '')
    order by rank asc, created_at asc, id asc
  ) as rn
  from monthly_leaderboard_snapshots
)
delete from monthly_leaderboard_snapshots m
using ranked r
where m.id = r.id and r.rn > 1;
```

Expected result: 26,373 → 5,328 rows. (`5,281` duplicate groups is fewer than the rows
deleted, because several groups hold more than two rows each.)

A backup is worth taking, because step 6 overwrites what is left anyway:

```sql
create table monthly_leaderboard_snapshots_backup_20261119 as
select * from monthly_leaderboard_snapshots;
```

Drop it after step 7 verifies.

---

## 5. Create the unique indexes  ⟵ writes DDL

```sh
bun db:migrate
```

`drizzle/migrations/0023_abnormal_sharon_ventura.sql` adds the column (already done in
step 2), replaces the inert unique index with a `COALESCE`-based one so global rows
collide the way they were always meant to, and adds
`cafe_visits_one_per_manila_day_idx` — unique on
`(user_id, cafe_id, (visited_at AT TIME ZONE 'Asia/Manila')::date)`.

Every statement carries `IF EXISTS` / `IF NOT EXISTS`, so a run that aborts (a stray
duplicate, a lock timeout) can simply be retried. Visits are already clean — measured: 0
duplicate groups across 86 visits — so the visit index builds immediately.

If `db:migrate` refuses because of the historical chain (a fresh database cannot replay
`0001_smart_nova`, a pre-existing condition unrelated to this change), apply the file
directly — it is plain SQL:

```sh
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/migrations/0023_abnormal_sharon_ventura.sql
```

---

## 6. Rebuild the affected history  ⟵ writes

Every stored month was computed by the fan-out query, so every month's cafe numbers are
wrong. Rebuild them with the admin backfill tool, which now writes the corrected
`visit_count` (Manila visit days) and `cafes_visited`, replaces one slice at a time, and
inserts with `onConflictDoNothing`.

Affected months: all 31, `2024-04` … `2026-10`. The current month is always computed live
and has no snapshot, so it is not in scope.

From `/manage/system/leaderboard-backfill` (its month list now comes from the server), or
directly:

```ts
await backfillLeaderboardSnapshots("2024-04", { force: true })
```

Run it month by month and check the returned counts. A month whose rebuilt cafe score is
dramatically lower than the stored one is the fan-out being removed, which is the expected
direction. Each slice is replaced inside its own transaction, so a failure costs that one
slice — re-run with `force: true` and it heals.

---

## 7. Verify

```sql
-- no duplicates left
select count(*) from (
  select 1 from monthly_leaderboard_snapshots
  group by type, year_month, coalesce(region,''),
           coalesce(user_id::text,''), coalesce(cafe_id::text,'')
  having count(*) > 1
) d;                                     -- expect 0

-- the indexes exist
select indexname from pg_indexes
where indexname in ('mls_type_year_month_idx','cafe_visits_one_per_manila_day_idx');

-- the QA fixture is flagged
select slug, is_test from cafes where slug = 'test-cafe';   -- expect t

-- spot-check one month's top cafe against a hand count
select c.name, s.score, s.visit_count, s.cafes_visited
from monthly_leaderboard_snapshots s join cafes c on c.id = s.cafe_id
where s.type = 'cafe' and s.year_month = '2026-09' and s.region is null
order by s.rank limit 3;
```

In the app: `/community` shows a leaderboard for the current month and for a past month,
with identical numbers for the same month however you navigate to it; a browser set to a
timezone ahead of Manila cannot select a month that has not happened yet; and the landing
page's check-in prompt no longer offers a cafe called `test-cafe`.

---

## Rollback

| Step | Undo |
|---|---|
| 1 | `update cafes set is_test = false where slug = 'test-cafe';` |
| 2 | The column is additive and unused by the old code; leave it |
| 3 | Revert the merge and redeploy |
| 4 | Restore from `monthly_leaderboard_snapshots_backup_20261119` |
| 5 | `drop index if exists mls_type_year_month_idx;` and `drop index if exists cafe_visits_one_per_manila_day_idx;` |
| 6 | Re-run step 6 for the affected months from the backup |
