import { Database } from './database.types';
import { OperatingHours } from './cafe';
import { CafeSocial } from './cafe';

// 1. Extract database-generated types for convenience
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];

// Event status enum type
export type EventStatus = 'draft' | 'published' | 'cancelled';

// Event type (matches events table)
export interface Event {
    id: string;
    title: string;
    description: string | null;
    start_date: string;
    end_date: string | null;
    location_name: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    region: string | null;
    cafe_id: string | null;
    image_url: string | null;
    ticket_link: string | null;
    is_national: boolean;
    created_by: string | null;
    status: EventStatus;
    created_at: string;
    updated_at: string;
}

// Event with related data
export interface EventWithCafe extends Event {
    cafe?: {
        id: string;
        name: string;
        slug: string;
        thumbnail: string;
    } | null;
    creator?: {
        id: string;
        display_name: string;
        avatar_url: string | null;
    } | null;
}

// Event filters for querying
export interface EventFilters {
    city?: string;
    region?: string;
    status?: EventStatus;
    is_national?: boolean;
    start_after?: string;
    start_before?: string;
}

// 2. Define your CafeWithRatings manually to ensure all fields are present
// Override operating_hours and socials from Json to their proper types
// Exclude search_vector as it's a database-internal field for full-text search
export type CafeWithRatings = Omit<Tables<'cafes'>, 'operating_hours' | 'socials' | 'search_vector'> & {
    operating_hours: OperatingHours | null;
    socials: CafeSocial[] | null;
    average_rating: number | null;
    total_reviews: number | null;
    rating_distribution?: { [key: string]: number } | null;
    story?: Tables<'cafe_stories'> | null;
    // Contributor (who submitted the cafe)
    contributor?: {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
    } | null;
    // Owners/managers profile data (resolved from owner_ids)
    owners?: {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
    }[];
};

// 3. Define the custom Filter interface for your UI
export interface CafeFilters {
    has_wifi?: boolean;
    has_sockets?: boolean;
    has_parking?: boolean;
    has_aircon?: boolean;
    is_pet_friendly?: boolean;
    has_outdoor_seating?: boolean;
    has_indoor_seating?: boolean;
    has_restroom?: boolean;
    has_bidet?: boolean;
    has_non_dairy?: boolean;
    has_decaf?: boolean;
    is_work_friendly?: boolean;
    price_level?: Database['public']['Enums']['price_level']; // Uses the actual DB Enum type
    coffee_style?: Database['public']['Enums']['coffee_style']; // Classic (2nd-wave) or Artisan (3rd-wave)
    region?: string;
    tags?: string[]; // Filter by vibe tags (any matching)
    search?: string;
    sortBy?: "recommended" | "rating" | "reviews" | "price_low" | "price_high";
    exclude_hidden_gems?: boolean; // Exclude Hidden Gems from results
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
    favorite_ids: string[];
}

// Profile with badges type
export type ProfileWithBadges = Tables<'profiles'> & {
    stats: ProfileStats | null;
    passport: ProfilePassport | null;
    badges: (Tables<'user_badges'> & {
        badge: Tables<'badge_definitions'>;
    })[];
}

// Cafe Submission Form Data
export interface CafeSubmission {
    // Step 1: Basic Info
    name: string;
    description: string;
    thumbnail: File | null;
    gallery: File[];

    // Step 2: Location
    region: string;
    province: string;
    city_municipality: string;
    area: string;
    address_display: string;
    lat: number | null;
    lng: number | null;

    // Step 3: Amenities & Features
    has_wifi: boolean;
    has_sockets: boolean;
    has_parking: boolean;
    has_aircon: boolean;
    is_pet_friendly: boolean;
    has_outdoor_seating: boolean;
    has_indoor_seating: boolean;
    has_restroom: boolean;
    has_bidet: boolean;
    has_non_dairy: boolean;
    has_decaf: boolean;
    milk_options: string[];
    serves_food: boolean;
    is_work_friendly: boolean;
    price_level: Database['public']['Enums']['price_level'];
    coffee_style: Database['public']['Enums']['coffee_style'] | null;
    payment_methods: string;
    specialty: string[];
    tags: string[];
    brew_methods: string[];
    roaster: string;

    // Step 4: Operating Hours
    operating_hours: OperatingHours;

    // Step 5: Contact & Socials
    website_url: string;
    phone: string;
    email: string;
    socials: CafeSocial[];
    is_owner: boolean;
    ownership_proof_files: File[];

    // Hidden Gem fields
    is_hidden_gem: boolean;
    finding_hint: string;
}

// Serializable version of CafeSubmission for server actions (excludes File objects)
export type SerializableCafeSubmission = Omit<CafeSubmission, 'thumbnail' | 'gallery' | 'ownership_proof_files'>;

// Default empty submission for form initialization
export const DEFAULT_CAFE_SUBMISSION: CafeSubmission = {
    name: '',
    description: '',
    thumbnail: null,
    gallery: [],
    region: '',
    province: '',
    city_municipality: '',
    area: '',
    address_display: '',
    lat: null,
    lng: null,
    has_wifi: false,
    has_sockets: false,
    has_parking: false,
    has_aircon: false,
    is_pet_friendly: false,
    has_outdoor_seating: false,
    has_indoor_seating: false,
    has_restroom: false,
    has_bidet: false,
    has_non_dairy: false,
    has_decaf: false,
    milk_options: [],
    serves_food: false,
    is_work_friendly: false,
    price_level: 'medium',
    coffee_style: null,
    payment_methods: '',
    specialty: [],
    tags: [],
    brew_methods: [],
    roaster: '',
    operating_hours: [],
    website_url: '',
    phone: '',
    email: '',
    socials: [],
    is_owner: false,
    ownership_proof_files: [],
    is_hidden_gem: false,
    finding_hint: '',
};