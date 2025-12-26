-- Add profile_completed column to track if user has completed initial profile setup
-- Run this in your Supabase SQL editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;

-- Optional: Mark all existing users as having completed their profile
-- (since they're already using the app)
UPDATE profiles SET profile_completed = true WHERE profile_completed IS NULL OR profile_completed = false;
