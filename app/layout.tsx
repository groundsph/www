import type { Metadata } from "next"
import { DM_Sans, Playfair_Display } from "next/font/google"
import "./globals.css"

const playfairDisplay = Playfair_Display({
    variable: "--font-playfair-display",
    subsets: ["latin"],
})

const dmSans = DM_Sans({
    variable: "--font-dm-sans",
    subsets: ["latin"],
})

export const metadata: Metadata = {
    title: "Grounds",
    description: "cebu.coffee",
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang='en'>
            <body
                className={`${playfairDisplay.variable} ${dmSans.variable} font-sans antialiased bg-background text-text flex flex-col items-center w-screen relative`}
            >
                {children}
            </body>
        </html>
    )
}
