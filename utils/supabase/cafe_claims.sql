-- Cafe Claim Requests Migration
-- Run this in Supabase SQL Editor

-- Create cafe_claims table
CREATE TABLE IF NOT EXISTS cafe_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    proof_text TEXT NOT NULL, -- User's explanation/proof of ownership
    proof_document_url TEXT, -- Optional: URL to uploaded proof document
    admin_notes TEXT, -- Notes from admin during review
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES profiles(id),
    
    -- Prevent duplicate pending claims
    CONSTRAINT unique_pending_claim UNIQUE (cafe_id, user_id, status)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cafe_claims_cafe ON cafe_claims(cafe_id);
CREATE INDEX IF NOT EXISTS idx_cafe_claims_user ON cafe_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_cafe_claims_status ON cafe_claims(status);

-- Enable RLS
ALTER TABLE cafe_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own claims
CREATE POLICY "Users can view own claims"
    ON cafe_claims FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert claims (one pending claim per cafe per user)
CREATE POLICY "Users can submit claims"
    ON cafe_claims FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM cafe_claims
            WHERE cafe_id = cafe_claims.cafe_id
            AND user_id = auth.uid()
            AND status = 'pending'
        )
    );

-- Admins can view all claims
CREATE POLICY "Admins can view all claims"
    ON cafe_claims FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
    );

-- Admins can update claims (approve/reject)
CREATE POLICY "Admins can update claims"
    ON cafe_claims FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
    );

-- Function to approve claim and update cafe ownership
CREATE OR REPLACE FUNCTION approve_cafe_claim(claim_id UUID, admin_id UUID, notes TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    claim_record RECORD;
BEGIN
    -- Get claim details
    SELECT * INTO claim_record FROM cafe_claims WHERE id = claim_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update claim status
    UPDATE cafe_claims
    SET status = 'approved',
        reviewed_at = NOW(),
        reviewed_by = admin_id,
        admin_notes = notes
    WHERE id = claim_id;
    
    -- Update cafe with owner
    UPDATE cafes
    SET owner_ids = array_append(COALESCE(owner_ids, '{}'), claim_record.user_id),
        is_claimed = TRUE
    WHERE id = claim_record.cafe_id
    AND NOT (claim_record.user_id = ANY(COALESCE(owner_ids, '{}')));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE cafe_claims IS 'Stores cafe ownership claim requests from users';
