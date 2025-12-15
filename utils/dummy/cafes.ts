import { Cafe } from "../types/cafe";

export async function getCafeBySlug(slug: string) {
    // Utilize dummy data for now
    const cafe = dummyCafes.find((cafe) => cafe.slug === slug)
    return cafe
}

export const dummyCafes: Cafe[] = [
    {
        id: crypto.randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
        // Basic Info
        name: "Strange Matcha",
        slug: "strange-matcha",
        description: "Strange Matcha is a unique and trendy cafe that offers a unique experience for coffee lovers. The cafe is located in the heart of Cebu and is known for its unique and creative approach to coffee.",
        thumbnail: "/testing/strange-matcha.jpg",
        gallery: ["/testing/strange-matcha.jpg", "/testing/strange-matcha.jpg", "/testing/strange-matcha.jpg"],
        website_url: "https://strangematcha.ph",
        socials: [
            { title: "Instagram", url: "https://instagram.com/strangematcha" },
            { title: "Facebook", url: "https://facebook.com/strangematcha" },
        ],
        // Contact
        phone: "+63 912 345 6789",
        email: "hello@strangematcha.ph",
        // Location
        address_display: "Molave Community Marketplace, Molave St, Cebu City",
        lat: 10.3167,
        lng: 123.9000,
        area: "Cebu City",
        // Hours
        operating_hours: [
            { day: "mon", open: "08:00", close: "21:00" },
            { day: "tue", open: "08:00", close: "21:00" },
            { day: "wed", open: "08:00", close: "21:00" },
            { day: "thu", open: "08:00", close: "21:00" },
            { day: "fri", open: "08:00", close: "22:00" },
            { day: "sat", open: "09:00", close: "22:00" },
            { day: "sun", open: "09:00", close: "20:00" },
        ],
        // Amenities
        has_wifi: true,
        has_sockets: true,
        has_parking: true,
        has_aircon: true,
        is_pet_friendly: false,
        has_outdoor_seating: true,
        // Food & Drinks
        serves_food: true,
        specialty: ["matcha", "latte art", "pastries"],
        // Details
        price_level: "low",
        payment_methods: "cash card gcash",
        roaster: "Grounds",
        // Vibe
        tags: ["cozy", "instagrammable", "study-friendly"],
        // Meta
        rating: 4.5,
        reviews: 10,
        is_verified: true,
        is_active: true,
    },
    {
        id: crypto.randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
        // Basic Info
        name: "Bo's Coffee Casa Gorordo",
        slug: "bos-coffee-casa-gorordo",
        description: "Enjoy coffee in the 1850s ambiance of Casa Gorordo Museum. Bo's Coffee is a proudly Cebuano coffee chain that serves locally-sourced Filipino coffee beans.",
        thumbnail: "/testing/bos-coffee.jpg",
        gallery: ["/testing/bos-coffee.jpg"],
        website_url: "https://bfranchise.com/bos-coffee",
        socials: [
            { title: "Instagram", url: "https://instagram.com/baboratories" },
            { title: "Facebook", url: "https://facebook.com/boscoffeeofficial" },
        ],
        // Contact
        phone: "+63 32 412 1234",
        email: "info@boscoffee.com",
        // Location
        address_display: "35 Eduardo Aboitiz St, Parian, Cebu City",
        lat: 10.2999,
        lng: 123.9049,
        area: "Cebu City",
        // Hours
        operating_hours: [
            { day: "mon", open: "07:00", close: "21:00" },
            { day: "tue", open: "07:00", close: "21:00" },
            { day: "wed", open: "07:00", close: "21:00" },
            { day: "thu", open: "07:00", close: "21:00" },
            { day: "fri", open: "07:00", close: "22:00" },
            { day: "sat", open: "08:00", close: "22:00" },
            { day: "sun", open: "08:00", close: "20:00" },
        ],
        // Amenities
        has_wifi: true,
        has_sockets: true,
        has_parking: false,
        has_aircon: true,
        is_pet_friendly: false,
        has_outdoor_seating: true,
        // Food & Drinks
        serves_food: true,
        specialty: ["filipino coffee", "pour-over", "cold brew"],
        // Details
        price_level: 'medium',
        payment_methods: "cash card gcash",
        roaster: "Bo's Coffee",
        // Vibe
        tags: ["heritage", "local", "historic"],
        // Meta
        rating: 4.8,
        reviews: 24,
        is_verified: true,
        is_active: true,
    }
]