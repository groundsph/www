import CafeDetails from "@/app/cafes/[slug]/CafeDetails"
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"
import type { Metadata } from "next"
import { dummyCafes } from "@/utils/dummy/cafes"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const db = await createClient()
    const { slug } = await params
    // const cafe = (await db.from("cafes").select("*").eq("slug", slug).single()).data
    const cafe = dummyCafes.find((cafe) => cafe.slug === slug)

    if (!cafe) {
        return {
            title: "Cafe Not Found",
            description: "The cafe you are looking for does not exist.",
        }
    }

    const { name, description, address_display, thumbnail, tags, specialty } =
        cafe

    const metaDescription =
        description ||
        `Visit ${name} at ${address_display}. Find the perfect spot for your next coffee break or work session.`

    // Build keywords from cafe data
    const keywords = [
        name,
        "cafe",
        "coffee shop",
        "coffee",
        address_display,
        ...(tags || []),
        ...(specialty || []),
    ].filter(Boolean)

    return {
        title: name,
        description: metaDescription,
        keywords: keywords,
        openGraph: {
            title: name,
            description: metaDescription,
            type: "website",
            images: thumbnail ? [{ url: thumbnail }] : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: name,
            description: metaDescription,
            images: thumbnail ? [thumbnail] : undefined,
        },
    }
}

// JSON-LD Structured Data for CafeOrCoffeeShop
function generateJsonLd(cafe: (typeof dummyCafes)[number]) {
    const dayMapping: Record<string, string> = {
        mon: "Monday",
        tue: "Tuesday",
        wed: "Wednesday",
        thu: "Thursday",
        fri: "Friday",
        sat: "Saturday",
        sun: "Sunday",
    }

    const openingHours = cafe.operating_hours
        ?.filter((h) => !h.is_closed)
        .map((h) => `${dayMapping[h.day]} ${h.open}-${h.close}`)

    return {
        "@context": "https://schema.org",
        "@type": "CafeOrCoffeeShop",
        name: cafe.name,
        description: cafe.description,
        image: cafe.thumbnail,
        address: {
            "@type": "PostalAddress",
            streetAddress: cafe.address_display,
        },
        geo:
            cafe.lat && cafe.lng
                ? {
                      "@type": "GeoCoordinates",
                      latitude: cafe.lat,
                      longitude: cafe.lng,
                  }
                : undefined,
        telephone: cafe.phone,
        email: cafe.email,
        url: cafe.website_url,
        openingHours: openingHours,
        priceRange:
            cafe.price_level === "low"
                ? "₱"
                : cafe.price_level === "medium"
                ? "₱₱"
                : "₱₱₱",
        aggregateRating: cafe.rating
            ? {
                  "@type": "AggregateRating",
                  ratingValue: cafe.rating,
                  bestRating: 10,
                  worstRating: 1,
              }
            : undefined,
        servesCuisine: cafe.specialty,
        amenityFeature: [
            cafe.has_wifi && {
                "@type": "LocationFeatureSpecification",
                name: "WiFi",
                value: true,
            },
            cafe.has_sockets && {
                "@type": "LocationFeatureSpecification",
                name: "Power Outlets",
                value: true,
            },
            cafe.has_parking && {
                "@type": "LocationFeatureSpecification",
                name: "Parking",
                value: true,
            },
            cafe.has_aircon && {
                "@type": "LocationFeatureSpecification",
                name: "Air Conditioning",
                value: true,
            },
            cafe.is_pet_friendly && {
                "@type": "LocationFeatureSpecification",
                name: "Pet Friendly",
                value: true,
            },
            cafe.has_outdoor_seating && {
                "@type": "LocationFeatureSpecification",
                name: "Outdoor Seating",
                value: true,
            },
        ].filter(Boolean),
    }
}

export default async function CafePage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    // Constants
    const db = await createClient()
    const { slug } = await params
    // const cafe = (await db.from("cafes").select("*").eq("slug", slug).single()).data
    const cafe = dummyCafes.find((cafe) => cafe.slug === slug)
    if (!cafe)
        return (
            <section
                id='not-found'
                className='w-full h-full flex flex-col items-center justify-center flex-1'
            >
                <h1 className='text-5xl font-bold'>404</h1>
                <p className='text-2xl font-semibold'>Page Not Found</p>
                <p className='text-xl'>
                    The page you are looking for does not exist.
                </p>
                <Link
                    href='/'
                    className='text-sm font-semibold underline transition-colors hover:text-text/60'
                >
                    Go Back Home
                </Link>
            </section>
        )

    // Generate JSON-LD for SEO
    const jsonLd = generateJsonLd(cafe)

    // Pass cafe slug to client component
    return (
        <>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <CafeDetails cafe={cafe} />
        </>
    )
}
