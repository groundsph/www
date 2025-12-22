import "@/app/map.css"
import { getDailyFeatured, getAllCafes } from "@/app/api/actions/cafe"
import LandingHero from "@/components/LandingHero"
import RecentCard from "@/components/RecentCard"
import { CafeWithRatings } from "@/utils/types/extra"
import Link from "next/link"
import { SearchIcon } from "lucide-react"

export default async function Home() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": "https://grounds.ph/#organization",
                name: "Grounds",
                url: "https://grounds.ph",
                logo: {
                    "@type": "ImageObject",
                    url: "https://grounds.ph/og-image.png",
                },
                description:
                    "Community-driven cafe database featuring the best cafes in Cebu",
                address: {
                    "@type": "PostalAddress",
                    addressLocality: "Cebu",
                    addressRegion: "Cebu",
                    addressCountry: "PH",
                },
            },
            {
                "@type": "WebSite",
                "@id": "https://grounds.ph/#website",
                url: "https://grounds.ph",
                name: "Grounds - Discover Cebu's Best Cafes",
                description: "Discover and explore the best cafes in Cebu",
                publisher: {
                    "@id": "https://grounds.ph/#organization",
                },
                inLanguage: "en-PH",
            },
        ],
    }
    // Fetch data using server actions
    const featured = (await getDailyFeatured()) as CafeWithRatings | null
    const recentlyAdded = (await getAllCafes(1, 10, {})) as CafeWithRatings[]

    return (
        <>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <LandingHero featured={featured} />

            <section className='w-full min-h-max bg-secondary mb-4 flex flex-col items-center justify-center py-10 gap-4 px-6 overflow-clip relative'>
                {/* BG */}
                <SearchIcon className='absolute h-[140%] aspect-square w-auto text-background/10' />
                {/* Content */}
                <h2 className='font-serif text-3xl md:text-5xl font-semibold z-1 text-center'>
                    Found a spot we missed?
                </h2>
                <p className='max-w-md text-background text-center font-medium z-1'>
                    Help the community discover the best coffee spots by sharing
                    your favorite cafe.
                </p>
                <Link
                    href='/submit'
                    className='px-4 py-1 w-max bg-text text-background font-serif italic font-semibold rounded-lg transition-colors hover:bg-text/60 relative group shadow-lg text-nowrap text-xl z-1'
                >
                    Submit a Cafe
                </Link>
            </section>

            {/* Recently Added */}
            <section className='w-full min-h-max flex flex-col'>
                <h2 className='font-semibold font-serif text-2xl px-6'>
                    Recently Added Cafes
                </h2>
                <div className='flex flex-row gap-8 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-4 pb-10 snap-x snap-mandatory'>
                    {recentlyAdded.map((cafe, idx) => (
                        <RecentCard
                            key={cafe.id || idx}
                            cafe={cafe}
                            idx={idx}
                        />
                    ))}
                </div>
            </section>
        </>
    )
}
