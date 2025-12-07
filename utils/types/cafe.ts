export interface Cafe {
    id: string,
    created_at: Date,
    // Basic Info
    name: string,
    slug: string,
    description: string,
    thumbnail: string,
    gallery?: string[],
    // Location
    address_display: string,
    lat: number,
    lng: number,
    area: string,
    // Filters
    has_wifi: boolean,
    has_sockets: boolean,
    has_parking: boolean,
    // Details
    price_level: number,
    payment_methods: PaymentMethods[],
    raoster: string,
    // Meta
    rating: number,
    reviews: number,
    is_verified: boolean,
}

export type PaymentMethods = 'cash' | 'card' | 'gcash'
