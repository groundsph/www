-- ================================================
-- Contribution Logs Table
-- Tracks user contributions to cafes for history display
-- ================================================

-- Create enum for action types
CREATE TYPE contribution_action_type AS ENUM (
    'CREATE',   -- User scouted/submitted a new cafe
    'UPDATE',   -- User updated cafe info (directly or via approved suggestion)
    'VERIFY',   -- User verified cafe information
    'MEDIA',    -- User added photos/gallery images
    'SUGGEST'   -- User submitted an edit suggestion (pending approval)
);

-- Create the contribution_logs table
CREATE TABLE IF NOT EXISTS contribution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    action_type contribution_action_type NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_contribution_logs_user_id ON contribution_logs(user_id);
CREATE INDEX idx_contribution_logs_cafe_id ON contribution_logs(cafe_id);
CREATE INDEX idx_contribution_logs_created_at ON contribution_logs(created_at DESC);

-- ================================================
-- Row Level Security (RLS)
-- ================================================

ALTER TABLE contribution_logs ENABLE ROW LEVEL SECURITY;

-- Public read access: Anyone can view contribution history
CREATE POLICY "Contribution logs are viewable by everyone"
ON contribution_logs FOR SELECT
USING (true);

-- Only service role can insert (server actions use admin client)
-- No INSERT policy needed for authenticated users since we use service role
-- This prevents direct client-side inserts

-- ================================================
-- Optional: Backfill existing data
-- This will create CREATE logs for all existing cafes with a contributor_id
-- Run this ONCE after creating the table if you want historical data
-- ================================================

-- INSERT INTO contribution_logs (user_id, cafe_id, action_type, details, created_at)
-- SELECT 
--     contributor_id,
--     id,
--     'CREATE',
--     jsonb_build_object('source', 'backfill', 'cafe_name', name),
--     created_at
-- FROM cafes
-- WHERE contributor_id IS NOT NULL;
