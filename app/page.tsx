import "@/app/map.css"
import { getDailyFeatured, getAllCafes } from "@/app/api/actions/cafe"
import CafeMapWrapper from "@/components/CafeMapWrapper"
import LandingHero from "@/components/LandingHero"
import RecentCard from "@/components/RecentCard"
import { CafeWithRatings } from "@/utils/types/extra"

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

            {/* Interactive Map */}
            {/* <section className='w-full min-h-screen p-4 flex justify-center'>
                <div className='bg-secondary/20 border-2 border-white/10 w-full flex-1 rounded-md overflow-clip'>
                    <CafeMapWrapper cafes={recentlyAdded} />
                </div>
            </section> */}
        </>
    )
}
