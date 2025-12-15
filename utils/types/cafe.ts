export interface FeaturedCafe {
    title: string
    description: string
    image: string
    url: string
    rating: number
    reviews: number
}

export interface Cafe {
    id: string,
    created_at: Date,
    updated_at?: Date,
    // Basic Info
    name: string,
    slug: string,
    description: string,
    thumbnail: string,
    gallery?: string[],
    website_url?: string,
    socials?: CafeSocial[],
    // Contact
    phone?: string,
    email?: string,
    // Location
    address_display: string,
    lat: number,
    lng: number,
    area: string,
    // Hours
    operating_hours?: OperatingHours[],
    // Amenities
    has_wifi: boolean,
    has_sockets: boolean,
    has_parking: boolean,
    has_aircon?: boolean,
    is_pet_friendly?: boolean,
    has_outdoor_seating?: boolean,
    // Food & Drinks
    serves_food?: boolean,
    specialty?: string[],
    // Details
    price_level: PriceLevel,
    payment_methods: string,
    roaster?: string,
    // Vibe
    tags?: string[],
    // Meta
    rating: number,
    reviews: number,
    is_verified: boolean,
    is_active?: boolean,
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