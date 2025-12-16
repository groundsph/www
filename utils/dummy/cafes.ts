import { Cafe, CafeStory } from "../types/cafe";

export async function getCafeBySlug(slug: string) {
    // Utilize dummy data for now
    const cafe = dummyCafes.find((cafe) => cafe.slug === slug)
    return cafe
}

export const dummyCafes: Cafe[] = [
    {
        id: 'strange-matcha-dummy',
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
    },
    {
        id: crypto.randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
        // Basic Info
        name: "Commonly Uncommon",
        slug: "commonly-uncommon",
        description: "A specialty coffee shop that celebrates the extraordinary in everyday moments. Commonly Uncommon offers thoughtfully crafted beverages and a welcoming atmosphere for those who appreciate the finer details.",
        thumbnail: "/testing/commonly-uncommon.jpg",
        gallery: ["/testing/commonly-uncommon.jpg"],
        website_url: "https://commonlyuncommon.ph",
        socials: [
            { title: "Instagram", url: "https://instagram.com/commonlyuncommon" },
            { title: "Facebook", url: "https://facebook.com/commonlyuncommon" },
        ],
        // Contact
        phone: "+63 917 555 1234",
        email: "hello@commonlyuncommon.ph",
        // Location
        address_display: "IT Park, Lahug, Cebu City",
        lat: 10.3303,
        lng: 123.9056,
        area: "Cebu City",
        // Hours
        operating_hours: [
            { day: "mon", open: "07:00", close: "22:00" },
            { day: "tue", open: "07:00", close: "22:00" },
            { day: "wed", open: "07:00", close: "22:00" },
            { day: "thu", open: "07:00", close: "22:00" },
            { day: "fri", open: "07:00", close: "23:00" },
            { day: "sat", open: "08:00", close: "23:00" },
            { day: "sun", open: "08:00", close: "21:00" },
        ],
        // Amenities
        has_wifi: true,
        has_sockets: true,
        has_parking: true,
        has_aircon: true,
        is_pet_friendly: true,
        has_outdoor_seating: false,
        // Food & Drinks
        serves_food: true,
        specialty: ["single origin", "pour-over", "specialty espresso"],
        // Details
        price_level: 'medium',
        payment_methods: "cash card gcash maya",
        roaster: "In-house Roastery",
        // Vibe
        tags: ["minimalist", "work-friendly", "specialty"],
        // Meta
        rating: 4.7,
        reviews: 42,
        is_verified: true,
        is_active: true,
    }
]

export const dummyCafeStories: CafeStory[] = [
    {
        id: 'strange-matcha-dummy',
        created_at: new Date(),
        updated_at: new Date(),
        cafe_id: dummyCafes[0].id,
        content: `# Strange Matcha: Where Japanese Tradition Meets Cebuano Creativity

Tucked away in the vibrant Molave Community Marketplace, **Strange Matcha** has quickly become one of Cebu's most beloved specialty cafes. What started as a small passion project in 2021 has blossomed into a must-visit destination for matcha enthusiasts and coffee lovers alike.

## The Story Behind the Name

The name "Strange Matcha" reflects the founders' philosophy—embracing the unconventional. While traditional matcha preparations are honored, the cafe takes creative liberties with unique flavor combinations and presentations that you won't find anywhere else in the city.

> "We wanted to create a space where people could experience matcha in ways they never imagined. Every drink tells a story."
> — *The Strange Matcha Team*

## What Makes Us Special

### Our Matcha

We source our ceremonial-grade matcha directly from Uji, Kyoto—one of Japan's most prestigious tea-growing regions. Each batch is stone-ground to preserve its vibrant color and complex flavor profile.

**Signature Drinks:**
- **The Strange One** — Our flagship drink featuring housemade oat milk, vanilla, and a hint of lavender
- **Matcha Espresso Fusion** — A bold combination of our premium matcha with locally-roasted espresso
- **Ube Matcha Latte** — A Filipino-Japanese fusion that's become an instant classic

### Beyond the Cup

While matcha is our heart, we also offer:
* Freshly baked pastries from local bakeries
* Light bites perfect for work sessions
* A curated selection of teas and coffee alternatives

## The Space

Designed with intention, our cafe features:
- Natural wood elements and plenty of greenery
- Comfortable seating for solo visitors and groups
- Dedicated work areas with accessible power outlets
- A cozy outdoor section for those sunny Cebu afternoons

---

## Visit Us

Whether you're seeking a peaceful morning ritual, a productive work session, or simply a unique cafe experience, Strange Matcha welcomes you. We're open daily and can't wait to share our love for matcha with you.

*Follow us on [Instagram](https://instagram.com/strangematcha) for updates and new menu drops!*
`,
    }
]