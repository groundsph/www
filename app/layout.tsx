import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"
import Script from "next/script"
import { Suspense } from "react"
import "./globals.css"
import AuthProvider from "@/components/layout/AuthProvider"
import LayoutWrapper from "@/components/layout/LayoutWrapper"
import NotificationProvider from "@/components/layout/NotificationProvider"
import BadgeNotificationProvider from "@/components/badges/BadgeNotificationContext"
import AnalyticsBanner from "@/components/ui/AnalyticsBanner"
import NavigationProgress from "@/components/ui/NavigationProgress"
import AnnouncementBanner from "@/components/ui/AnnouncementBanner"

const dmSans = DM_Sans({
    variable: "--font-dm-sans",
    display: "swap",
    adjustFontFallback: true,
})

export const metadata: Metadata = {
    metadataBase: new URL("https://grounds.ph"),
    title: {
        default: "Grounds PH - Discover the Best Cafes in the Philippines",
        template: "%s | Grounds PH",
    },
    alternates: {
        canonical: "./",
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
    authors: [{ name: "Grounds PH" }],
    creator: "Grounds PH",
    publisher: "Grounds PH",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    openGraph: {
        type: "website",
        locale: "en_PH",
        url: "https://grounds.ph",
        siteName: "Grounds PH",
        title: "Grounds PH",
        description:
            "Discover and explore the best cafes in the Philippines. Community-driven cafe database featuring daily highlights, reviews, and more.",
        images: [
            {
                url: "/og-image.jpg",
                width: 1200,
                height: 630,
                alt: "Grounds PH - Discover the Philippines' Best Cafes",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Grounds PH",
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
            <head>
                {/* Preconnect to CDN for faster image loading */}
                <link
                    rel='preconnect'
                    href='https://cdn.grounds.ph'
                />
                <link
                    rel='dns-prefetch'
                    href='https://cdn.grounds.ph'
                />
            </head>
            <body
                className={`${dmSans.variable} font-sans antialiased bg-background text-text flex flex-col items-center max-w-screen relative min-h-screen [&_button]:cursor-pointer`}
            >
                <Suspense fallback={null}>
                    <NavigationProgress />
                </Suspense>
                <AnnouncementBanner />
                <NotificationProvider>
                    <BadgeNotificationProvider>
                        <AuthProvider>
                            <LayoutWrapper>{children}</LayoutWrapper>
                        </AuthProvider>
                    </BadgeNotificationProvider>
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
