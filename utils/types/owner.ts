import { Database } from './database.types';

// ============================================
// Subscription Types
// ============================================

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type VerificationType = 'document' | 'email' | 'social_proof';

// Map database 'basic' to UI 'pro' for display
export type SubscriptionTier = 'free' | 'pro' | 'premium';

// Helper to convert database tier to display tier
export function toDisplayTier(dbTier: Database['public']['Enums']['membership_tier']): SubscriptionTier {
    if (dbTier === 'basic') return 'pro';
    return dbTier as SubscriptionTier;
}

// Helper to convert display tier to database tier
export function toDbTier(displayTier: SubscriptionTier): Database['public']['Enums']['membership_tier'] {
    if (displayTier === 'pro') return 'basic';
    return displayTier as Database['public']['Enums']['membership_tier'];
}

// Subscription tier configuration
export const SUBSCRIPTION_TIERS = {
    free: {
        name: 'Free',
        price: 0,
        priceDisplay: '₱0',
        features: [
            'Direct Cafe Editing',
            'Unlimited Cafe Menu (Beta)',
        ],
        menuLimit: Infinity, // Unlimited during beta
        enabledFeatures: ['menu'] as TierFeature[],
    },
    pro: {
        name: 'Pro',
        price: 2000,
        priceDisplay: '₱2,000 / 6 months (Founder\'s Promo)',
        features: [
            'Verified Badge for Cafe',
            'Cafe Menu (30 Item Limit)',
            'Blog Posts',
            'Site/Cafe Analytics',
            'QR to Menu',
        ],
        menuLimit: 30,
        enabledFeatures: ['menu', 'blog', 'analytics', 'verified_badge', 'qr_menu', 'inventory'] as TierFeature[],
    },
    premium: {
        name: 'Premium',
        price: 4000,
        priceDisplay: '₱4,000 / 6 months (Founder\'s Promo)',
        features: [
            'Unlimited Cafe Menu',
            'Events',
            'Highlighted Map Pins',
            'Direct Support',
            'Featured Slot per Month Request',
            'Featured Reviews (Review Pinning)',
            'Cafe Priority Ranking',
            '+ More Features in the Future',
        ],
        menuLimit: Infinity,
        enabledFeatures: [
            'menu', 'blog', 'analytics', 'verified_badge', 'qr_menu', 'inventory',
            'events', 'highlighted_pins', 'direct_support', 'featured_slot_request',
            'review_pinning', 'priority_ranking'
        ] as TierFeature[],
    },
} as const;

// ============================================
// Tier Feature Types & Helpers
// ============================================

/**
 * Tier-specific feature flags that can be programmatically checked
 */
export type TierFeature =
    | 'menu'
    | 'blog'
    | 'events'
    | 'analytics'
    | 'verified_badge'
    | 'highlighted_pins'
    | 'featured_slot_request'
    | 'review_pinning'
    | 'priority_ranking'
    | 'qr_menu'
    | 'direct_support'
    | 'inventory';

// ============================================
// Beta Free Features Configuration
// ============================================

/**
 * Features available for free during beta period.
 * Premium competitive features (highlighted_pins, featured_slot_request, 
 * review_pinning, priority_ranking) remain paid to incentivize upgrades.
 * 
 * To disable beta mode and enforce subscriptions, set this to an empty array: []
 */
export const BETA_FREE_FEATURES: TierFeature[] = [
    'menu',           // Full menu management (no item limits)
    'blog',           // Blog posts
    'analytics',      // Site/cafe analytics
    'events',         // Events management
    'verified_badge', // Verified badge display
    'qr_menu',        // QR code to menu
    'direct_support', // Direct support channel
    'inventory',      // Inventory management
];

/**
 * Get the beta notice text for UI display
 */
export function getBetaNoticeText(): string {
    return "Most features are free during our beta period. Premium features (highlighted map pins, featured slots, review pinning, priority ranking) require a subscription. Features may become paid in the future to cover operational costs.";
}

/**
 * Check if a subscription tier has access to a specific feature
 */
export function canAccessFeature(tier: SubscriptionTier, feature: TierFeature): boolean {
    // Check if feature is free during beta
    if (BETA_FREE_FEATURES.includes(feature)) return true;

    // Otherwise, use normal tier check
    const tierConfig = SUBSCRIPTION_TIERS[tier];
    return (tierConfig.enabledFeatures as readonly TierFeature[]).includes(feature);
}

/**
 * Get the minimum tier required for a specific feature
 * Returns 'premium' as fallback if feature not found in any tier
 */
export function getRequiredTier(feature: TierFeature): SubscriptionTier {
    const tierOrder: SubscriptionTier[] = ['free', 'pro', 'premium'];
    for (const tier of tierOrder) {
        if (canAccessFeature(tier, feature)) {
            return tier;
        }
    }
    return 'premium';
}

/**
 * Get all features available for a tier
 */
export function getTierFeatures(tier: SubscriptionTier): TierFeature[] {
    return [...SUBSCRIPTION_TIERS[tier].enabledFeatures] as TierFeature[];
}

/**
 * Check if an upgrade from current tier to target tier would unlock a feature
 */
export function wouldUnlockFeature(
    currentTier: SubscriptionTier,
    targetTier: SubscriptionTier,
    feature: TierFeature
): boolean {
    return !canAccessFeature(currentTier, feature) && canAccessFeature(targetTier, feature);
}

/**
 * Get the display name for the tier required to use a feature
 */
export function getRequiredTierName(feature: TierFeature): string {
    const tier = getRequiredTier(feature);
    return SUBSCRIPTION_TIERS[tier].name;
}


// ============================================
// Cafe Subscription
// ============================================

export interface CafeSubscription {
    id: string;
    cafe_id: string;
    tier: SubscriptionTier; // Already mapped from database
    helix_subscription_id: string | null;
    status: SubscriptionStatus;
    current_period_start: string | null;
    current_period_end: string | null;
    created_at: string | null;
    updated_at: string | null;
    // Manual Payment Fields
    proof_of_payment_url?: string | null;
    is_manual_payment?: boolean;
    payment_verified?: boolean;
}

// ============================================
// Owner Verification
// ============================================

export interface OwnerVerificationRequest {
    id: string;
    cafe_id: string;
    user_id: string;
    verification_type: VerificationType;
    proof_urls: string[];
    notes: string | null;
    status: VerificationStatus;
    reviewed_by: string | null;
    reviewed_at: string | null;
    admin_notes: string | null;
    created_at: string | null;
    // Joined data
    cafe?: {
        id: string;
        name: string;
        slug: string;
        thumbnail: string;
    };
    user?: {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
    };
    reviewer?: {
        id: string;
        username: string;
        display_name: string;
    } | null;
}

// ============================================
// Owner Review Response
// ============================================

export interface OwnerReviewResponse {
    id: string;
    review_id: string;
    owner_id: string;
    response: string;
    created_at: string | null;
    updated_at: string | null;
    is_edited: boolean;
    // Joined data
    owner?: {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
    };
}

// ============================================
// Cafe Menu Items
// ============================================

export interface CafeMenuItem {
    id: string;
    cafe_id: string;
    category: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    is_signature: boolean;
    is_available: boolean;
    sort_order: number;
    created_at: string | null;
    updated_at: string | null;
}

// Common menu categories
export const MENU_CATEGORIES = [
    // Beverages - Coffee
    'Coffee',
    'Espresso Drinks',
    'Cold Brew',
    // Beverages - Non-Coffee
    'Non-Coffee',
    'Tea',
    'Milk Drinks',
    'Frappes',
    'Smoothies',
    'Specialty Drinks',
    'Refreshers',
    // Food
    'Food',
    'Rice Meals',
    'Sandwiches',
    'Pasta',
    'Breakfast',
    'Snacks',
    // Sweets
    'Pastries',
    'Desserts',
    'Cakes',
    // Extras
    'Add-ons',
    'Other',
] as const;

// ============================================
// Owner Dashboard Types
// ============================================

export interface OwnedCafe {
    id: string;
    name: string;
    slug: string;
    thumbnail: string;
    city_municipality: string;
    region: string;
    is_verified: boolean | null;
    is_published: boolean | null;
    average_rating: number | null;
    total_reviews: number | null;
    // Subscription info
    subscription: CafeSubscription | null;
    // Pending actions
    pending_reviews: number;
}

export interface OwnerDashboardStats {
    total_cafes: number;
    total_reviews: number;
    average_rating: number;
    unresponded_reviews: number;
}

// ============================================
// Form Types
// ============================================

export interface VerificationRequestForm {
    cafe_id: string;
    verification_type: VerificationType;
    proof_urls: string[];
    notes?: string;
}

export interface ReviewResponseForm {
    review_id: string;
    response: string;
}

export interface MenuItemForm {
    category: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    is_signature?: boolean;
    is_available?: boolean;
}

// ============================================
// API Response Types
// ============================================

export interface OwnerActionResult {
    success: boolean;
    error?: string;
}

export interface VerificationResult extends OwnerActionResult {
    request?: OwnerVerificationRequest;
}

export interface SubscriptionCheckoutResult extends OwnerActionResult {
    checkout_url?: string;
}

export interface MenuItemResult extends OwnerActionResult {
    item?: CafeMenuItem;
    remaining_slots?: number;
}
