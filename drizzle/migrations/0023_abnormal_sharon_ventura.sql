-- Hand-hardened for a live database: every statement is re-runnable, so a run
-- that aborts (a duplicate row, a lock timeout) can be retried without leaving
-- the table in a worse state than it started. The generated form was not.
--
-- Ordering matters: the two unique indexes cannot be created while duplicate
-- rows exist, and a partially applied run must not strip the old index without
-- replacing it. IF EXISTS / IF NOT EXISTS make both recoverable.
ALTER TABLE "monthly_leaderboard_snapshots" ADD COLUMN IF NOT EXISTS "cafes_visited" integer;--> statement-breakpoint
DROP INDEX IF EXISTS "mls_type_year_month_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cafe_visits_one_per_manila_day_idx" ON "cafe_visits" USING btree ("user_id","cafe_id",(("visited_at" AT TIME ZONE 'Asia/Manila')::date));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mls_type_year_month_idx" ON "monthly_leaderboard_snapshots" USING btree ("type","year_month",coalesce("region", ''),coalesce("user_id"::text, ''),coalesce("cafe_id"::text, ''));
