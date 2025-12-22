export interface FeaturedCafe {
    title: string
    description: string
    image: string
    url: string
    rating: number
    reviews: number
}

export interface CafeStory {
    id: string,
    created_at: Date,
    updated_at: Date,
    cafe_id: string,
    content: string,
}

export interface Cafe {
    id: string;
    created_at: Date;
    updated_at?: Date;
    is_published: boolean; // Keep this for your moderation buffer!

    // Ownership & Monetization
    is_claimed: boolean;
    membership_tier: 'free' | 'basic' | 'premium';
    featured_until?: Date;
    owner_ids?: string[];
    contributor_id?: string; // Links to the user who "Scouted" it

    // Basic Info
    name: string;
    slug: string;
    description: string;
    thumbnail: string;
    gallery?: string[];

    // Standardized Location (Vital for National Search)
    region: string;           // e.g., "Region VII"
    province: string;         // e.g., "Cebu"
    city_municipality: string;// e.g., "Cebu City"
    address_display: string;
    lat: number;
    lng: number;

    // Amenities (Added suggested "Vibe" tags)
    has_wifi: boolean;
    has_sockets: boolean;
    has_parking: boolean;
    has_aircon?: boolean;
    is_pet_friendly?: boolean;
    has_outdoor_seating?: boolean;
    is_work_friendly?: boolean; // Specific tag for digital nomads

    // Coffee Specifics
    roaster?: string;
    brew_methods?: string[]; // e.g., ["V60", "Cold Brew", "Siphon"]
    price_level: PriceLevel;

    // Verification
    is_verified: boolean; // Your "Grounds Approved" badge
    is_active: boolean;   // To handle temporary closures
}

export type OperatingHours = {
    day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
    open: string,
    close: string,
    is_closed?: boolean,
}

export type CafeSocial = {
    title: string,
    url: string,
}

export type PriceLevel = 'low' | 'medium' | 'high'