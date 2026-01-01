import type { Metadata } from "next"
import { DM_Sans, Playfair_Display } from "next/font/google"
import Script from "next/script"
import { Suspense } from "react"
import "./globals.css"
import AuthProvider from "@/components/AuthProvider"
import LayoutWrapper from "@/components/LayoutWrapper"
import NotificationProvider from "@/components/NotificationProvider"
import AnalyticsBanner from "@/components/AnalyticsBanner"
import NavigationProgress from "@/components/NavigationProgress"
import BetaBanner from "@/components/BetaBanner"

const playfairDisplay = Playfair_Display({
    variable: "--font-playfair-display",
    subsets: ["latin"],
})

const dmSans = DM_Sans({
    variable: "--font-dm-sans",
    subsets: ["latin"],
})

export const metadata: Metadata = {
    metadataBase: new URL("https://grounds.ph"),
    title: {
        default: "Grounds - Discover the Best Cafes in the Philippines",
        template: "%s | Grounds",
    },
    alternates: {
        canonical: "https://grounds.ph",
    },
    description:
        "Discover and explore the best cafes in the Philippines. Community-driven cafe database featuring daily highlights, reviews, and more.",
    keywords: [
        "Philippines cafes",
        "coffee shops Philippines",
        "best cafes Philippines",
        "cafe finder",
        "cafe discovery",
        "specialty coffee Philippines",
        "cafe reviews",
        "coffee culture Philippines",
        "local cafes near me",
        "third wave coffee",
        "cafe guide Philippines",
        "coffee community",
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
        url: "https://grounds.ph",
        siteName: "Grounds",
        title: "Grounds",
        description:
            "Discover and explore the best cafes in the Philippines. Community-driven cafe database featuring daily highlights, reviews, and more.",
        images: [
            {
                url: "/og-image.jpg",
                width: 1200,
                height: 630,
                alt: "Grounds - Discover the Philippines' Best Cafes",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Grounds",
        description:
            "Discover and explore the best cafes in the Philippines. Community-driven cafe database featuring daily highlights, reviews, and more.",
        images: ["/og-image.jpg"],
        creator: "@adrianbonpin",
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
        icon: [
            { url: "/favicon.ico" },
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
        ],
        apple: [
            { url: "/apple-icon-57x57.png", sizes: "57x57", type: "image/png" },
            { url: "/apple-icon-60x60.png", sizes: "60x60", type: "image/png" },
            { url: "/apple-icon-72x72.png", sizes: "72x72", type: "image/png" },
            { url: "/apple-icon-76x76.png", sizes: "76x76", type: "image/png" },
            {
                url: "/apple-icon-114x114.png",
                sizes: "114x114",
                type: "image/png",
            },
            {
                url: "/apple-icon-120x120.png",
                sizes: "120x120",
                type: "image/png",
            },
            {
                url: "/apple-icon-144x144.png",
                sizes: "144x144",
                type: "image/png",
            },
            {
                url: "/apple-icon-152x152.png",
                sizes: "152x152",
                type: "image/png",
            },
            {
                url: "/apple-icon-180x180.png",
                sizes: "180x180",
                type: "image/png",
            },
        ],
        other: [
            {
                rel: "apple-touch-icon-precomposed",
                url: "/apple-icon-precomposed.png",
            },
        ],
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
            className=''
        >
            <body
                className={`${playfairDisplay.variable} ${dmSans.variable} font-sans antialiased bg-background text-text flex flex-col items-center max-w-screen relative min-h-screen [&_button]:cursor-pointer`}
            >
                <Suspense fallback={null}>
                    <NavigationProgress />
                </Suspense>
                <BetaBanner />
                <NotificationProvider>
                    <AuthProvider>
                        <LayoutWrapper>{children}</LayoutWrapper>
                    </AuthProvider>
                </NotificationProvider>
                <AnalyticsBanner />
                <Script
                    src='https://analytics.ranlabs.space/api/script.js'
                    data-site-id='5'
                    strategy='afterInteractive'
                />
            </body>
        </html>
    )
}
