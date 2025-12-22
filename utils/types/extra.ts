import { Database } from './database.types';

// 1. Extract database-generated types for convenience
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];

// 2. Define your CafeWithRatings from the view
// 2. Define your CafeWithRatings manually to ensure all fields are present
export type CafeWithRatings = Tables<'cafes'> & {
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