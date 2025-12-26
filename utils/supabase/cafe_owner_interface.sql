-- ============================================
-- Cafe Owner Interface Schema Migration
-- Created: 2025-12-26
-- ============================================

-- ============================================
-- 1. NEW ENUMS
-- ============================================

-- Subscription status for cafe subscriptions
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');

-- Verification request status
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');

-- Note: membership_tier already exists as ('free', 'basic', 'premium')
-- We may want to rename 'basic' to 'pro' in the future, but for now
-- we'll use 'basic' in the database and map it to 'Pro' in the UI

-- ============================================
-- 2. CAFE SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS cafe_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_id UUID NOT NULL UNIQUE REFERENCES cafes(id) ON DELETE CASCADE,
    tier membership_tier NOT NULL DEFAULT 'free',
    helix_subscription_id TEXT, -- HelixPay subscription reference (null for free tier)
    status subscription_status NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up subscription by HelixPay ID
CREATE INDEX idx_cafe_subscriptions_helix_id ON cafe_subscriptions(helix_subscription_id) 
WHERE helix_subscription_id IS NOT NULL;

-- Index for finding subscriptions by status
CREATE INDEX idx_cafe_subscriptions_status ON cafe_subscriptions(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_cafe_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cafe_subscriptions_updated_at
    BEFORE UPDATE ON cafe_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_cafe_subscriptions_updated_at();

-- ============================================
-- 3. OWNER VERIFICATION REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS owner_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    verification_type TEXT NOT NULL CHECK (verification_type IN ('document', 'email', 'social_proof')),
    proof_urls TEXT[] DEFAULT '{}',
    notes TEXT,
    status verification_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate pending requests from same user for same cafe
    UNIQUE (cafe_id, user_id, status)
);

-- Index for finding pending verifications (admin view)
CREATE INDEX idx_owner_verification_pending ON owner_verification_requests(status) 
WHERE status = 'pending';

-- Index for user's verification requests
CREATE INDEX idx_owner_verification_user ON owner_verification_requests(user_id);

-- Index for cafe's verification history
CREATE INDEX idx_owner_verification_cafe ON owner_verification_requests(cafe_id);

-- ============================================
-- 4. OWNER REVIEW RESPONSES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS owner_review_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    response TEXT NOT NULL CHECK (length(response) <= 1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_edited BOOLEAN DEFAULT FALSE
);

-- Index for fetching responses by review
CREATE INDEX idx_owner_review_responses_review ON owner_review_responses(review_id);

-- Index for owner's response history
CREATE INDEX idx_owner_review_responses_owner ON owner_review_responses(owner_id);

-- Trigger to track edits
CREATE OR REPLACE FUNCTION update_owner_review_responses()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.response IS DISTINCT FROM NEW.response THEN
        NEW.is_edited = TRUE;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_owner_review_responses_update
    BEFORE UPDATE ON owner_review_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_owner_review_responses();

-- ============================================
-- 5. CAFE MENUS TABLE (for Pro/Premium feature)
-- ============================================

CREATE TABLE IF NOT EXISTS cafe_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_id UUID NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_signature BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching menu by cafe
CREATE INDEX idx_cafe_menu_items_cafe ON cafe_menu_items(cafe_id);

-- Index for category filtering
CREATE INDEX idx_cafe_menu_items_category ON cafe_menu_items(cafe_id, category);

-- Trigger for updated_at
CREATE TRIGGER trigger_cafe_menu_items_updated_at
    BEFORE UPDATE ON cafe_menu_items
    FOR EACH ROW
    EXECUTE FUNCTION update_cafe_subscriptions_updated_at();

-- ============================================
-- 6. RLS POLICIES
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE cafe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_menu_items ENABLE ROW LEVEL SECURITY;

-- cafe_subscriptions: Owners can read their cafe's subscription, admins can read/write all
CREATE POLICY "Owners can view their cafe subscription"
    ON cafe_subscriptions FOR SELECT
    USING (
        cafe_id IN (
            SELECT id FROM cafes WHERE owner_ids @> ARRAY[auth.uid()]::uuid[]
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

CREATE POLICY "Service role can manage subscriptions"
    ON cafe_subscriptions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- owner_verification_requests: Users can view/create their own, admins can view/update all
CREATE POLICY "Users can view their verification requests"
    ON owner_verification_requests FOR SELECT
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    ));

CREATE POLICY "Users can create verification requests"
    ON owner_verification_requests FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update verification requests"
    ON owner_verification_requests FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    ));

-- owner_review_responses: Owners can manage responses for their cafes, public can read
CREATE POLICY "Anyone can view review responses"
    ON owner_review_responses FOR SELECT
    USING (true);

CREATE POLICY "Owners can create responses for their cafe reviews"
    ON owner_review_responses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reviews r
            JOIN cafes c ON r.cafe_id = c.id
            WHERE r.id = review_id AND c.owner_ids @> ARRAY[auth.uid()]::uuid[]
        )
    );

CREATE POLICY "Owners can update their own responses"
    ON owner_review_responses FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their own responses"
    ON owner_review_responses FOR DELETE
    USING (owner_id = auth.uid());

-- cafe_menu_items: Owners can manage, public can read for published cafes
CREATE POLICY "Anyone can view menu items for published cafes"
    ON cafe_menu_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cafes WHERE id = cafe_id AND is_published = true
        )
        OR EXISTS (
            SELECT 1 FROM cafes WHERE id = cafe_id AND owner_ids @> ARRAY[auth.uid()]::uuid[]
        )
    );

CREATE POLICY "Owners can manage their cafe menu items"
    ON cafe_menu_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM cafes WHERE id = cafe_id AND owner_ids @> ARRAY[auth.uid()]::uuid[]
        )
    );

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to check if a user is an owner of a cafe
CREATE OR REPLACE FUNCTION is_cafe_owner(p_user_id UUID, p_cafe_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM cafes 
        WHERE id = p_cafe_id 
        AND owner_ids @> ARRAY[p_user_id]::uuid[]
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get cafe subscription tier
CREATE OR REPLACE FUNCTION get_cafe_tier(p_cafe_id UUID)
RETURNS membership_tier AS $$
DECLARE
    v_tier membership_tier;
BEGIN
    SELECT tier INTO v_tier
    FROM cafe_subscriptions
    WHERE cafe_id = p_cafe_id AND status = 'active';
    
    RETURN COALESCE(v_tier, 'free');
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to count menu items for tier limit enforcement
CREATE OR REPLACE FUNCTION count_cafe_menu_items(p_cafe_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM cafe_menu_items WHERE cafe_id = p_cafe_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if cafe can add more menu items (tier-based limit)
CREATE OR REPLACE FUNCTION can_add_menu_item(p_cafe_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tier membership_tier;
    v_count INTEGER;
BEGIN
    v_tier := get_cafe_tier(p_cafe_id);
    v_count := count_cafe_menu_items(p_cafe_id);
    
    -- Free tier: No menu items allowed
    IF v_tier = 'free' THEN
        RETURN FALSE;
    END IF;
    
    -- Basic/Pro tier: 5 item limit
    IF v_tier = 'basic' THEN
        RETURN v_count < 5;
    END IF;
    
    -- Premium tier: Unlimited
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE cafe_subscriptions IS 'Stores per-cafe subscription information for the owner dashboard';
COMMENT ON TABLE owner_verification_requests IS 'Tracks owner verification requests and their review status';
COMMENT ON TABLE owner_review_responses IS 'Stores cafe owner responses to customer reviews';
COMMENT ON TABLE cafe_menu_items IS 'Custom menu items added by cafe owners (Pro/Premium feature)';

COMMENT ON FUNCTION is_cafe_owner IS 'Checks if a user is in the owner_ids array for a cafe';
COMMENT ON FUNCTION get_cafe_tier IS 'Returns the active subscription tier for a cafe (defaults to free)';
COMMENT ON FUNCTION can_add_menu_item IS 'Checks tier limits: Pro=5 items, Premium=unlimited';
