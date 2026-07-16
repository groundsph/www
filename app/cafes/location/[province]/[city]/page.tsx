import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/db"
import { cafes } from "@/db/schema"
import { eq, and, ilike, or } from "drizzle-orm"
import { buildMetadata } from "@/utils/seo/landing-metadata"
import { buildItemListJsonLd, buildItemListElement } from "@/utils/seo/jsonld"
import { buildBreadcrumbList } from "@/utils/seo/breadcrumbs"
import { omitTestCafes } from "@/utils/filters"
import Link from "next/link"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

interface Props {
  params: Promise<{ province: string; city: string }>
}

function slugToDisplay(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province: provinceSlug, city: citySlug } = await params
  const province = slugToDisplay(provinceSlug)
  const city = slugToDisplay(citySlug)

  const matching = await db
    .select({ id: cafes.id })
    .from(cafes)
    .where(and(
      eq(cafes.isPublished, true),
      eq(cafes.isHiddenGem, false),
      ...omitTestCafes([]),
      or(
        ilike(cafes.cityMunicipality, `%${city}%`),
        ilike(cafes.province, `%${province}%`)
      )
    ))

  return buildMetadata({
    city,
    province,
    cafeCount: matching.length,
  })
}

export default async function CityLandingPage({ params }: Props) {
  const { province: provinceSlug, city: citySlug } = await params
  const province = slugToDisplay(provinceSlug)
  const city = slugToDisplay(citySlug)

  const matching = await db
    .select({
      id: cafes.id,
      name: cafes.name,
      slug: cafes.slug,
      thumbnail: cafes.thumbnail,
      cityMunicipality: cafes.cityMunicipality,
      province: cafes.province,
    })
    .from(cafes)
    .where(and(
      eq(cafes.isPublished, true),
      eq(cafes.isHiddenGem, false),
      ...omitTestCafes([]),
      or(
        ilike(cafes.cityMunicipality, `%${city}%`),
        ilike(cafes.province, `%${province}%`)
      )
    ))

  if (matching.length === 0) {
    notFound()
  }

  const breadcrumbs = buildBreadcrumbList([
    { name: "GroundsPH", url: siteUrl },
    { name: "Cafes", url: `${siteUrl}/cafes` },
    { name: `${city}, ${province}`, url: `${siteUrl}/cafes/location/${provinceSlug}/${citySlug}` },
  ])

  const itemList = buildItemListJsonLd(
    matching.map((c, i) => buildItemListElement(
      c.name,
      `${siteUrl}/cafes/${c.slug}`,
      i + 1,
    )),
    "listing"
  )

  return (
    <main className="w-full min-h-screen px-4 py-12 max-w-6xl mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />

      <h1 className="text-3xl md:text-4xl font-bold mb-2">
        Best Cafes in {city}, {province}
      </h1>
      <p className="text-text/70 mb-8">
        Discover {matching.length} cafes in {city}, {province}.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {matching.map((cafe) => (
          <Link
            key={cafe.id}
            href={`/cafes/${cafe.slug}`}
            className="block bg-background border border-tertiary/50 rounded-xl p-4 hover:border-primary/50 transition"
          >
            <h3 className="font-semibold">{cafe.name}</h3>
            <p className="text-sm text-text/60">{cafe.cityMunicipality}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}