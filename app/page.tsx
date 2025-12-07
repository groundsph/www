import { dummyCafes } from "@/utils/dummy/cafes"
import { StarIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import "@/app/map.css"
import CafeMapWrapper from "@/components/CafeMapWrapper"

export default function Home() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": "https://cebu.coffee/#organization",
                name: "Grounds",
                url: "https://cebu.coffee",
                logo: {
                    "@type": "ImageObject",
                    url: "https://cebu.coffee/og-image.png",
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
                "@id": "https://cebu.coffee/#website",
                url: "https://cebu.coffee",
                name: "Grounds - Discover Cebu's Best Cafes",
                description: "Discover and explore the best cafes in Cebu",
                publisher: {
                    "@id": "https://cebu.coffee/#organization",
                },
                inLanguage: "en-PH",
            },
        ],
    }

    interface Featured {
        title: string
        description: string
        image: string
        url: string
        rating: number
        reviews: number
    }

    const featured: Featured = {
        title: dummyCafes[0].name,
        description: dummyCafes[0].description,
        image: dummyCafes[0].thumbnail,
        url: `/cafes/${dummyCafes[0].slug}`,
        rating: dummyCafes[0].rating,
        reviews: dummyCafes[0].reviews,
    }

    return (
        <>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <section className='w-full bg-secondary text-background min-h-max py-4 px-4 flex justify-center'>
                <div className='w-full max-w-7xl flex flex-col md:flex-row md:gap-36 justify-between'>
                    <div className='flex-1 flex flex-col gap-4 justify-center'>
                        <h1 className='md:text-lg font-semibold font-serif'>
                            Today's Featured
                        </h1>
                        <p className='text-base md:text-xl'>
                            <span className='font-semibold text-primary'>
                                {featured.title}.
                            </span>{" "}
                            {featured.description}
                        </p>
                        <div className='flex flex-row gap-4 items-center'>
                            <Link
                                href={featured.url}
                                target='_blank'
                                className='px-4 py-1 rounded-lg bg-background w-max text-text font-semibold font-serif italic transition-colors hover:bg-background/60'
                            >
                                Learn More
                            </Link>
                            <div className='flex flex-row gap-2 text-primary'>
                                <span className='font-semibold flex flex-row gap-1 items-center'>
                                    {featured.rating}/10{" "}
                                    <StarIcon className='w-4 h-4 fill-primary' />
                                </span>
                                {" | "}
                                <span className='font-semibold'>
                                    {featured.reviews} reviews
                                </span>
                            </div>
                        </div>
                    </div>
                    <div
                        className='flex-1 flex items-center justify-center select-none'
                        draggable={false}
                    >
                        <div className='relative w-full h-auto aspect-square rounded-xl overflow-clip'>
                            <Image
                                src={featured.image}
                                alt=''
                                fill
                                className='object-cover'
                            />
                        </div>
                    </div>
                </div>
            </section>
            {/* Recently Added */}
            <section className='w-full min-h-max px-4 py-6 flex flex-col gap-4'>
                <h2 className='font-semibold font-serif text-2xl'>
                    Recently Added Cafes
                </h2>
                <div className='flex flex-row flex-wrap gap-4 h-80'>
                    {dummyCafes.map((cafe) => (
                        <div
                            key={cafe.id}
                            className='h-full flex flex-col gap-2'
                        >
                            <div className='relative w-auto flex-1 aspect-video'>
                                <Image
                                    src={cafe.thumbnail}
                                    alt=''
                                    fill
                                    className='object-cover'
                                />
                            </div>
                            <div className='flex flex-col'>
                                <h3 className='font-semibold font-serif text-lg'>
                                    {cafe.name}
                                </h3>
                                <p className='text-sm'>
                                    {cafe.address_display}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
            {/* Interactive Map */}
            <section className='w-full min-h-screen p-4 flex justify-center'>
                <div className='bg-secondary/20 border-2 border-white/10 w-full flex-1 rounded-md overflow-clip'>
                    <CafeMapWrapper cafes={dummyCafes} />
                </div>
            </section>
        </>
    )
}
