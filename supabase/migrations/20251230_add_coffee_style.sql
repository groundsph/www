-- Migration: Add coffee_style enum and column
-- Description: Adds a dedicated field to classify cafes as Classic (2nd-wave) or Artisan (3rd-wave)

-- Create the coffee_style enum
CREATE TYPE coffee_style AS ENUM ('classic', 'artisan');

-- Add coffee_style column to cafes table (nullable)
ALTER TABLE cafes ADD COLUMN coffee_style coffee_style DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN cafes.coffee_style IS 'Coffee style classification: classic (2nd-wave/espresso bar) or artisan (3rd-wave/craft)';

-- Note: The cafe_with_ratings view uses "SELECT c.*" so it will automatically
-- include the new coffee_style column - no view update needed.
