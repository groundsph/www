-- Data migration: Convert old price_level values to new enum values
-- Run this BEFORE applying the schema migration

-- First, convert to text to allow any value
ALTER TABLE "cafes" ALTER COLUMN "price_level" SET DATA TYPE text;

-- Update existing data: map old values to new values
UPDATE "cafes" SET "price_level" = 'budget' WHERE "price_level" = 'low';
UPDATE "cafes" SET "price_level" = 'mid' WHERE "price_level" = 'medium';
-- Map 'high' to 'premium' (could also be 'luxury' depending on actual prices)
UPDATE "cafes" SET "price_level" = 'premium' WHERE "price_level" = 'high';

-- Drop old enum type
DROP TYPE IF EXISTS "public"."price_level";

-- Create new enum type
CREATE TYPE "public"."price_level" AS ENUM('budget', 'mid', 'premium', 'luxury');

-- Convert column back to enum type
ALTER TABLE "cafes" ALTER COLUMN "price_level" SET DATA TYPE "public"."price_level" USING "price_level"::"public"."price_level";