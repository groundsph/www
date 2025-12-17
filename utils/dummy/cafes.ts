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
        id: 'bos-coffee-casa-gorordo-dummy',
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
        id: 'commonly-uncommon-dummy',
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
    },
    {
        id: 'bos-coffee-casa-gorordo-story',
        created_at: new Date(),
        updated_at: new Date(),
        cafe_id: dummyCafes[1].id,
        content: `# Bo's Coffee Casa Gorordo: Coffee in a Living Museum

Nestled within the historic walls of Casa Gorordo Museum, **Bo's Coffee Casa Gorordo** offers a truly unique coffee experience—where every sip comes with a side of Cebuano heritage. This isn't just a cafe; it's a journey back to the 1850s.

## A Heritage Setting Like No Other

Casa Gorordo is one of the few remaining Spanish-era houses in Cebu, and Bo's Coffee has transformed a portion of this heritage site into a charming cafe that honors the past while serving the present.

> "Drinking coffee here feels like stepping into a time machine. The wooden floors, the antique furniture, the history in every corner—it's magical."
> — *A Regular Guest*

## Our Filipino Coffee

As a proudly Cebuano coffee chain, Bo's Coffee sources beans exclusively from Filipino farmers across the archipelago:

**Featured Origins:**
- **Sagada Arabica** — From the mountains of Mountain Province, known for its bright acidity and citrus notes
- **Benguet Blend** — A smooth, medium-bodied coffee perfect for everyday drinking
- **Mt. Apo Peaberry** — Our premium single-origin with rich chocolate undertones

### Brewing Methods

We offer multiple ways to experience Filipino coffee:
* Pour-over for the purist
* Cold brew for hot Cebu afternoons
* Classic espresso-based drinks
* Traditional *barako* for the bold

## Beyond Coffee

Our menu extends beyond the cup:

- **Local pastries** — Partner bakeshops provide fresh ensaymada and pan de sal
- **Light meals** — Perfect for museum-goers taking a break
- **Heritage merchandise** — Take home a piece of Cebu

## The Experience

What makes this location special:

1. **Air-conditioned comfort** in a heritage building
2. **Outdoor seating** overlooking the garden courtyard
3. **Museum access** — combine your coffee visit with cultural exploration
4. **Free WiFi** for the modern visitor

---

## Plan Your Visit

Whether you're a history enthusiast, a coffee lover, or simply seeking a peaceful escape from the city bustle, Bo's Coffee Casa Gorordo welcomes you. We're located at 35 Eduardo Aboitiz St, Parian, Cebu City.

*Connect with us on [Facebook](https://facebook.com/boscoffeeofficial) for updates and events!*
`,
    },
    {
        id: 'commonly-uncommon-story',
        created_at: new Date(),
        updated_at: new Date(),
        cafe_id: dummyCafes[2].id,
        content: `# Commonly Uncommon: Extraordinary Coffee for Everyday Moments

In the heart of Cebu's bustling IT Park, **Commonly Uncommon** stands as a sanctuary for those who believe that great coffee doesn't have to be pretentious—it just has to be exceptional.

## The Philosophy

Our name says it all. We find the **extraordinary in the ordinary**, celebrating those small moments that make life special. A perfectly pulled shot of espresso. The first sip of your morning pour-over. The satisfaction of finding *your* coffee.

> "Coffee is commonly consumed. But our approach is uncommon. Every cup is crafted with intention, every bean is sourced with purpose."
> — *Founders of Commonly Uncommon*

## Our Coffee Journey

### In-House Roastery

What sets us apart is our commitment to **roasting our own beans**. Our in-house roastery allows us to:

- Control every aspect of the roasting process
- Experiment with unique flavor profiles
- Ensure peak freshness in every cup
- Build direct relationships with farmers

**Current Offerings:**
- **The Uncommon Blend** — Our signature house espresso with notes of dark chocolate and caramel
- **Single Origins** — Rotating selections from around the world
- **Pour-Over Flights** — Compare three different origins side by side

### Brewing Excellence

Our baristas are trained to bring out the best in every bean:

* Precision pour-overs using temperature-controlled kettles
* Specialty espresso with carefully calibrated extraction
* Signature drinks that push creative boundaries
* Alternative milk options including housemade oat milk

## The Space

Designed for the modern Cebuano:

### Work-Friendly Environment
- High-speed WiFi throughout
- Abundant power outlets at every table
- Dedicated quiet zones for focused work
- Meeting-ready spaces for small teams

### Comfort & Atmosphere
- Minimalist design with warm touches
- Natural light through floor-to-ceiling windows
- Air-conditioned throughout
- Pet-friendly (yes, bring your fur babies!)

## More Than Coffee

**Food Menu:**
- All-day breakfast items
- Artisan sandwiches and wraps
- Locally-sourced pastries
- Healthy bowl options

**Community Events:**
- Monthly cupping sessions
- Latte art workshops
- Coffee origin talks
- Local artist showcases

---

## Find Your Uncommon

Whether you're a remote worker seeking your daily office, a coffee enthusiast exploring new flavors, or simply someone who appreciates quality—Commonly Uncommon is your place.

Open daily in IT Park, Lahug, Cebu City.

*Follow our journey on [Instagram](https://instagram.com/commonlyuncommon) for new releases and behind-the-scenes roastery content!*
`,
    }
]