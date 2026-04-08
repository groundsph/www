import CafeDetails from "@/components/cafe/CafeDetails"
import CafeHeroImage from "@/components/cafe/CafeHeroImage"
import Link from "next/link"
import type { Metadata } from "next"
import { getCafeBySlug, getReviewsByCafeIdPaginated } from "@/app/api/actions/cafe"
import { getCafeMenuItems } from "@/app/api/actions/owner"
import { getCafeEditPermission } from "@/app/api/actions/cafe-edit-permission"
import { CafeWithRatings } from "@/utils/types/extra"
import { getCafeDescription, getCafeThumbnailUrl } from "@/utils/extras"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const cafe = await getCafeBySlug(slug)

    if (!cafe) {
        return {
            title: "Cafe Not Found",
            description: "The cafe you are looking for does not exist.",
        }
    }

    const { name, address_display, thumbnail, tags, specialty } =
        cafe

    // Only use real thumbnails for OG images, not placeholders (will inherit site default)
    const thumbnailUrl =
        thumbnail && thumbnail !== "placeholder" ? thumbnail : undefined

    // Get the actual image URL for preloading (including placeholder fallback)
    const heroImageUrl = getCafeThumbnailUrl(thumbnail ?? "placeholder")

    const metaDescription = getCafeDescription(cafe)

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
            images: thumbnailUrl ? [{ url: thumbnailUrl }] : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: name,
            description: metaDescription,
            images: thumbnailUrl ? [thumbnailUrl] : undefined,
        },
        // Preload the hero image for faster LCP
        other: {
            link: `<${heroImageUrl}>; rel=preload; as=image`,
        },
    }
}

// JSON-LD Structured Data for CafeOrCoffeeShop
function generateJsonLd(cafe: CafeWithRatings) {
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
        image: cafe.thumbnail ? getCafeThumbnailUrl(cafe.thumbnail) : undefined,
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
            cafe.price_level === "budget"
                ? "₱"
                : cafe.price_level === "mid"
                  ? "₱₱"
                  : cafe.price_level === "premium"
                    ? "₱₱₱"
                    : "₱₱₱₱",
        aggregateRating: cafe.average_rating
            ? {
                  "@type": "AggregateRating",
                  ratingValue: cafe.average_rating,
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
    const { slug } = await params
    const cafe = await getCafeBySlug(slug)
    const [{ reviews: initialReviews, hasMore: initialHasMore }, menuItems] = await Promise.all([
        cafe ? getReviewsByCafeIdPaginated(cafe.id, 1, 10) : { reviews: [], hasMore: false },
        cafe ? getCafeMenuItems(cafe.id) : [],
    ])

    // Check if user can edit this cafe
    const editPermission = cafe
        ? await getCafeEditPermission(cafe.id)
        : { canEdit: false, role: null }

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
            <CafeDetails
                key={cafe.id}
                cafe={cafe}
                initialReviews={initialReviews}
                initialHasMore={initialHasMore}
                menuItems={menuItems}
                canEdit={editPermission.canEdit}
                editRole={editPermission.role}
                heroImage={
                    <CafeHeroImage
                        thumbnail={cafe.thumbnail ?? "placeholder"}
                    />
                }
            />
        </>
    )
}
