import { Database } from './database.types';
import { OperatingHours } from './cafe';
import { CafeSocial } from './cafe';

// 1. Extract database-generated types for convenience
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];

// 2. Define your CafeWithRatings manually to ensure all fields are present
// Override operating_hours and socials from Json to their proper types
export type CafeWithRatings = Omit<Tables<'cafes'>, 'operating_hours' | 'socials'> & {
    operating_hours: OperatingHours | null;
    socials: CafeSocial[] | null;
    average_rating: number | null;
    total_reviews: number | null;
    story?: Tables<'cafe_stories'> | null;
};

// 3. Define the custom Filter interface for your UI
export interface CafeFilters {
    has_wifi?: boolean;
    has_sockets?: boolean;
    has_parking?: boolean;
    has_aircon?: boolean;
    is_pet_friendly?: boolean;
    has_outdoor_seating?: boolean;
    price_level?: Database['public']['Enums']['price_level']; // Uses the actual DB Enum type
    search?: string;
    sortBy?: "recommended" | "rating" | "reviews" | "price_low" | "price_high";
}

// Profile Stats JSON structure
export interface ProfileStats {
    scout_rank: Database['public']['Enums']['scout_rank'];
    total_photos: number;
    total_reviews: number;
    total_scouted: number;
}

// Profile Passport JSON structure
export interface ProfilePassport {
    visited_ids: string[];
    wishlist_ids: string[];
    favorite_region: string;
}

// Profile with badges type
export type ProfileWithBadges = Tables<'profiles'> & {
    stats: ProfileStats | null;
    passport: ProfilePassport | null;
    badges: (Tables<'user_badges'> & {
        badge: Tables<'badge_definitions'>;
    })[];
}