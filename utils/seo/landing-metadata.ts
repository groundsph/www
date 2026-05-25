import type { Metadata } from "next"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

interface CityLandingData {
  city: string
  province: string
  cafeCount: number
}

export function buildMetadata(data: CityLandingData): Metadata {
  const { city, province, cafeCount } = data
  const provinceSlug = province.toLowerCase().replace(/\s+/g, "-")
  const citySlug = city.toLowerCase().replace(/\s+/g, "-")
  const path = `/cafes/${provinceSlug}/${citySlug}`

  return {
    title: `Best Cafes in ${city}, ${province} | Grounds PH`,
    description: `Discover ${cafeCount}+ cafes in ${city}, ${province}. Find WiFi-friendly, pet-friendly, and specialty coffee shops. Read reviews and plan your next coffee trip.`,
    keywords: [
      `cafes in ${city}`,
      `coffee shops ${city}`,
      `${city} cafe guide`,
      `best cafes ${city}`,
      `coffee ${province}`,
      `cafes ${province}`,
      `Philippines cafes`,
      "coffee near me",
    ],
    alternates: {
      canonical: `${siteUrl}${path}`,
    },
    openGraph: {
      title: `Best Cafes in ${city}, ${province} | Grounds PH`,
      description: `Discover ${cafeCount}+ cafes in ${city}, ${province}. Community-reviewed and curated.`,
      url: `${siteUrl}${path}`,
    },
  }
}