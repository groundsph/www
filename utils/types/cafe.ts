export type OperatingHour = {
    day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
    open: string;
    close: string;
    is_closed?: boolean;
    is_24_hours?: boolean;
}

export type OperatingHours = OperatingHour[];

export type CafeSocial = {
    title: string;
    url: string;
}

export interface Cafe {
    id: string;
    created_at: Date;
    updated_at: Date;
    name: string;
    slug: string;
    description: string;
    thumbnail: string;
    gallery: string[];
    website_url?: string;
    socials?: CafeSocial[];
    phone?: string;
    email?: string;
    address_display: string;
    lat: number;
    lng: number;
    area: string;
    operating_hours: OperatingHours;
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
    milk_options?: string[];
    serves_food: boolean;
    specialty?: string[];
    price_level: "low" | "medium" | "high";
    payment_methods?: string;
    roaster?: string;
    tags?: string[];
    rating: number;
    reviews: number;
    is_verified: boolean;
    is_active: boolean;
}

export interface CafeStory {
    id: string;
    created_at: Date;
    updated_at: Date;
    cafe_id: string;
    content: string;
}