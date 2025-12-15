import "@/app/map.css"
import LandingPage from "./landingPage"

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

    return (
        <>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <LandingPage />
        </>
    )
}
