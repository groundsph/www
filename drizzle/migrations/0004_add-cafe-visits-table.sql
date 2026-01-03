ALTER TYPE "public"."scout_rank" ADD VALUE 'scout' BEFORE 'expert';--> statement-breakpoint
ALTER TYPE "public"."scout_rank" ADD VALUE 'explorer' BEFORE 'expert';--> statement-breakpoint
ALTER TYPE "public"."scout_rank" ADD VALUE 'legend';--> statement-breakpoint
CREATE TABLE "cafe_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cafe_id" uuid NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cafe_visits" ADD CONSTRAINT "cafe_visits_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cafe_visits" ADD CONSTRAINT "cafe_visits_cafe_id_cafes_id_fk" FOREIGN KEY ("cafe_id") REFERENCES "public"."cafes"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
-- Indexes for efficient querying
CREATE INDEX "cafe_visits_user_id_idx" ON "cafe_visits" ("user_id");-->statement-breakpoint
CREATE INDEX "cafe_visits_cafe_id_idx" ON "cafe_visits" ("cafe_id");-->statement-breakpoint
-- Prevent multiple check-ins on the same day (one visit per user per cafe per day)
-- Use timezone-aware casting to ensure IMMUTABLE behavior
CREATE UNIQUE INDEX "cafe_visits_user_cafe_daily_unique" ON "cafe_visits" ("user_id", "cafe_id", (("visited_at" AT TIME ZONE 'UTC')::date));