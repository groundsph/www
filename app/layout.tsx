import type { Metadata } from "next"
import { DM_Sans, Playfair_Display } from "next/font/google"
import "./globals.css"
import AuthProvider from "@/components/AuthProvider"
import LayoutWrapper from "@/components/LayoutWrapper"
import NotificationProvider from "@/components/NotificationProvider"

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
        default: "Grounds",
        template: "%s | Grounds",
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
                url: "/og-image.png",
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
        images: ["/og-image.png"],
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
        icon: "/icon.png",
        shortcut: "/icon.png",
        apple: "/icon.png",
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
                className={`${playfairDisplay.variable} ${dmSans.variable} font-sans antialiased bg-background text-text flex flex-col items-center max-w-screen relative min-h-screen`}
            >
                <NotificationProvider>
                    <AuthProvider>
                        <LayoutWrapper>{children}</LayoutWrapper>
                    </AuthProvider>
                </NotificationProvider>
            </body>
        </html>
    )
}
