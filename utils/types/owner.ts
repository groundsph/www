export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type VerificationType = 'document' | 'email' | 'social_proof';

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
    is_food: boolean;
    is_hot: boolean;
    is_cold: boolean;
    calories: number | null;
    is_vegan: boolean;
    is_vegetarian: boolean;
    size_options: Array<{ label: string; price: number }> | null;
    last_updated_by: string | null;
    community_submitted: boolean;
    sort_order: number;
    created_at: string | null;
    updated_at: string | null;
}

export const MENU_CATEGORIES = [
    'Coffee',
    'Espresso Drinks',
    'Cold Brew',
    'Non-Coffee',
    'Tea',
    'Milk Drinks',
    'Frappes',
    'Smoothies',
    'Specialty Drinks',
    'Refreshers',
    'Food',
    'Rice Meals',
    'Sandwiches',
    'Pasta',
    'Breakfast',
    'Snacks',
    'Pastries',
    'Desserts',
    'Cakes',
    'Add-ons',
    'Other',
] as const;

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
    pending_reviews: number;
}

export interface OwnerDashboardStats {
    total_cafes: number;
    total_reviews: number;
    average_rating: number;
    unresponded_reviews: number;
}

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
    is_food?: boolean;
    is_hot?: boolean;
    is_cold?: boolean;
    calories?: number;
    is_vegan?: boolean;
    is_vegetarian?: boolean;
    size_options?: Array<{ label: string; price: number }>;
}

export interface OwnerActionResult {
    success: boolean;
    error?: string;
}

export interface VerificationResult extends OwnerActionResult {
    request?: OwnerVerificationRequest;
}

export interface MenuItemResult extends OwnerActionResult {
    item?: CafeMenuItem;
    remaining_slots?: number;
}
