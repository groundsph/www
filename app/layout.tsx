import type { Metadata } from "next"
import { DM_Sans, Playfair_Display } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/navbar"

const playfairDisplay = Playfair_Display({
    variable: "--font-playfair-display",
    subsets: ["latin"],
})

const dmSans = DM_Sans({
    variable: "--font-dm-sans",
    subsets: ["latin"],
})

export const metadata: Metadata = {
    metadataBase: new URL("https://cebu.coffee"),
    title: {
        default: "Grounds - Discover Cebu's Best Cafes",
        template: "%s | Grounds",
    },
    description:
        "Discover and explore the best cafes in Cebu. Community-driven cafe database featuring daily highlights, reviews, events, and blog posts about Cebu's vibrant coffee culture.",
    keywords: [
        "Cebu cafes",
        "coffee shops Cebu",
        "best cafes Cebu",
        "Cebu coffee",
        "cafe finder Cebu",
        "coffee culture Cebu",
        "cafe reviews Cebu",
        "specialty coffee Cebu",
    ],
    authors: [{ name: "Grounds" }],
    creator: "Grounds",
    publisher: "Grounds",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    openGraph: {
        type: "website",
        locale: "en_PH",
        url: "https://cebu.coffee",
        siteName: "Grounds",
        title: "Grounds - Discover Cebu's Best Cafes",
        description:
            "Discover and explore the best cafes in Cebu. Community-driven cafe database featuring daily highlights, reviews, events, and blog posts.",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "Grounds - Discover Cebu's Best Cafes",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Grounds - Discover Cebu's Best Cafes",
        description:
            "Discover and explore the best cafes in Cebu. Community-driven cafe database featuring daily highlights, reviews, events, and blog posts.",
        images: ["/og-image.png"],
        // creator: "@yourtwitterhandle", // TODO: Add your Twitter handle if applicable
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    icons: {
        icon: "/favicon.ico",
        shortcut: "/favicon.ico",
        apple: "/apple-touch-icon.png",
    },
    manifest: "/manifest.webmanifest",
    category: "food and drink",
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html
            lang='en'
            className='overscroll-none'
        >
            <body
                className={`${playfairDisplay.variable} ${dmSans.variable} font-sans antialiased bg-background text-text flex flex-col items-center w-screen relative min-h-screen`}
            >
                <Navbar />
                {children}
            </body>
        </html>
    )
}
