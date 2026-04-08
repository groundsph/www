ALTER TABLE "cafes" ALTER COLUMN "price_level" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."price_level";--> statement-breakpoint
CREATE TYPE "public"."price_level" AS ENUM('budget', 'mid', 'premium', 'luxury');--> statement-breakpoint
ALTER TABLE "cafes" ALTER COLUMN "price_level" SET DATA TYPE "public"."price_level" USING "price_level"::"public"."price_level";