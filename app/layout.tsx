import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"
import Script from "next/script"
import { Suspense } from "react"
import "./globals.css"
import AuthProvider from "@/components/layout/AuthProvider"

/**
 * Web Vitals metric type
 */
interface WebVitalsMetric {
    id: string
    name: string
    startTime: number
    value: number
    label: "web-vital" | "custom"
}

/**
 * Web Vitals reporting for performance monitoring
 * Logs metrics in development, can be sent to analytics in production
 */
export function reportWebVitals(metric: WebVitalsMetric) {
    // In development, log to console
    if (process.env.NODE_ENV === "development") {
        console.log(`[Web Vitals] ${metric.name}: ${metric.value}`)
    }

    // In production, could send to analytics service
    // Example: analytics.track(metric)
}
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

export const viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
}

export const metadata: Metadata = {
    metadataBase: new URL("https://grounds.ph"),
    title: {
        default: "GroundsPH - Discover the Best Cafes in the Philippines",
        template: "%s | GroundsPH",
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
    authors: [{ name: "GroundsPH" }],
    creator: "GroundsPH",
    publisher: "GroundsPH",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "GroundsPH",
    },
    openGraph: {
        type: "website",
        locale: "en_PH",
        url: "https://grounds.ph",
        siteName: "GroundsPH",
        title: "GroundsPH",
        description:
            "Discover and explore the best cafes in the Philippines. Community-driven cafe database featuring daily highlights, reviews, and more.",
        images: [
            {
                url: "/og-image.jpg",
                width: 1200,
                height: 630,
                alt: "GroundsPH - Discover the Philippines' Best Cafes",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "GroundsPH",
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
    icons: {
        icon: [
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
        ],
        apple: [
            { url: "/apple-icon-180x180.png", sizes: "180x180" },
            { url: "/apple-icon-152x152.png", sizes: "152x152" },
            { url: "/apple-icon-144x144.png", sizes: "144x144" },
            { url: "/apple-icon-120x120.png", sizes: "120x120" },
            { url: "/apple-icon-114x114.png", sizes: "114x114" },
        ],
    },
    category: "food and drink",
    verification: {
        google: process.env.GOOGLE_SITE_VERIFICATION,
        yandex: process.env.YANDEX_SITE_VERIFICATION,
        yahoo: process.env.YAHOO_SITE_VERIFICATION,
    },
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
                    src='https://stat.ranio.xyz/api/script.js'
                    data-site-id='5'
                    strategy='afterInteractive'
                />
            </body>
        </html>
    )
}
