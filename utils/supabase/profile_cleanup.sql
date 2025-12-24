-- SQL trigger to delete avatar images when a profile is deleted
-- Run this in your Supabase SQL editor to set up automatic cleanup

-- Note: Supabase Storage cannot be accessed directly from PostgreSQL triggers,
-- so we use a different approach: we create a table to queue avatar deletions
-- and process them via an Edge Function or scheduled job.

-- Alternative approach: Use Supabase Edge Functions with a database webhook

-- ============================================================================
-- OPTION 1: Manual cleanup via application (recommended for simplicity)
-- ============================================================================
-- The application should call deleteAvatarImage() before deleting a profile.
-- This is handled in the profile deletion flow.

-- ============================================================================
-- OPTION 2: Database webhook + Edge Function (recommended for automation)
-- ============================================================================
-- 1. Create a webhook in Supabase Dashboard that triggers on profile DELETE
-- 2. The webhook calls an Edge Function that deletes the avatar from storage

-- Create a function to log deleted profiles for cleanup
CREATE TABLE IF NOT EXISTS avatar_deletion_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_url TEXT NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger function to queue avatar deletion before profile delete
CREATE OR REPLACE FUNCTION queue_avatar_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only queue if there's an avatar to delete
    IF OLD.avatar_url IS NOT NULL THEN
        INSERT INTO avatar_deletion_queue (avatar_url, user_id)
        VALUES (OLD.avatar_url, OLD.id);
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_queue_avatar_deletion ON profiles;
CREATE TRIGGER trigger_queue_avatar_deletion
    BEFORE DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION queue_avatar_deletion();

-- Grant access for the service role to process the queue
ALTER TABLE avatar_deletion_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage avatar deletion queue"
    ON avatar_deletion_queue
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Usage:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. When a profile is deleted, the avatar_url is queued
-- 3. Call processAvatarDeletionQueue() from your app periodically
--    OR set up a cron job / Edge Function to process the queue
-- ============================================================================
