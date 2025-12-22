export interface UserProfile {
    id: string; // UUID from Supabase Auth
    username: string;
    display_name: string;
    avatar_url?: string;
    bio?: string;
    location_base?: string; // e.g., "Cebu City" or "Manila"

    // Social/Community Stats
    stats: {
        cafes_scouted: number; // Number of approved submissions
        reviews_written: number;
        photos_contributed: number;
    };

    // Monetization/Support Status
    is_supporter: boolean; // True if they've ever donatedx 
    supporter_tier?: 'bronze' | 'silver' | 'gold'; // Optional tiers for donors

    // Achievements
    badges: UserBadge[]; // The dynamic badges we discussed

    // Preferences (for the "National" experience)
    favorite_regions: string[]; // e.g., ["Cebu", "Benguet"]
    wishlist_cafes: string[]; // Array of Cafe IDs they want to visit

    created_at: Date;
}

export interface UserBadge {
    id: string;
    user_id: string; // UUID of the user
    badge_id: string; // UUID from the BadgeDefinition table
    awarded_at: Date;
    evidence_url?: string; // Optional: Link to the specific cafe/review that earned it
}

export interface BadgeDefinition {
    id: string; // UUID
    name: string; // e.g., "The Baguio Scout"
    description: string; // e.g., "Awarded for being the first to submit a cafe in Baguio."
    image_url: string; // URL to the custom icon
    category: 'achievement' | 'monetary' | 'social'; // To group them in the UI
    rarity: 'common' | 'rare' | 'legendary';
    metadata?: Record<string, any>; // For future-proofing (e.g., custom colors or hex codes)
    created_at: Date;
}