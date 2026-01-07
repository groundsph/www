ALTER TABLE "cafes" ADD COLUMN "hidden_gem_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cafes" ADD COLUMN "hidden_gem_last_evaluated_period" text;--> statement-breakpoint
ALTER TABLE "cafes" ADD COLUMN "hidden_gem_graduated_at" timestamp with time zone;