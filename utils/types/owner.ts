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
        ],
        menuLimit: 0,
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
    },
} as const;

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
    'Coffee',
    'Espresso Drinks',
    'Non-Coffee',
    'Tea',
    'Specialty Drinks',
    'Food',
    'Pastries',
    'Desserts',
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
