DROP TABLE "cafe_subscriptions" CASCADE;--> statement-breakpoint
DROP TABLE "featured_slot_requests" CASCADE;--> statement-breakpoint
ALTER TABLE "cafes" DROP COLUMN "membership_tier";--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."get_cafe_tier" CASCADE;--> statement-breakpoint
DROP TYPE "public"."membership_tier" CASCADE;--> statement-breakpoint
DROP TYPE "public"."subscription_status";