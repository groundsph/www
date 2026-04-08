import { db } from "@/db"
import { cafes, cafeMenuItems } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import { Coffee } from "lucide-react"
import { getCafeThumbnailUrl } from "@/utils/extras"
import MenuHeader from "@/components/menu/MenuHeader"
import MenuContent from "@/components/menu/MenuContent"

interface MenuPageProps {
    params: Promise<{ slug: string }>
}

// Generate metadata for SEO
export async function generateMetadata({
    params,
}: MenuPageProps): Promise<Metadata> {
    const { slug } = await params

    const cafeResult = await db
        .select({
            name: cafes.name,
            description: cafes.description,
            thumbnail: cafes.thumbnail,
        })
        .from(cafes)
        .where(and(eq(cafes.slug, slug), eq(cafes.isPublished, true)))
        .limit(1)

    const cafe = cafeResult[0]

    if (!cafe) {
        return { title: "Menu Not Found | Grounds" }
    }

    const thumbnailUrl = cafe.thumbnail
        ? getCafeThumbnailUrl(cafe.thumbnail)
        : undefined

    return {
        title: `${cafe.name} Menu | Grounds`,
        description:
            `View the menu at ${cafe.name} with prices and photos. ${cafe.description || ""}`.trim(),
        openGraph: {
            title: `${cafe.name} Menu | Grounds`,
            description: `View the menu at ${cafe.name} with prices and photos.`,
            images: thumbnailUrl
                ? [{ url: thumbnailUrl, width: 1200, height: 630 }]
                : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: `${cafe.name} Menu | Grounds`,
            description: `View the menu at ${cafe.name} with prices and photos.`,
            images: thumbnailUrl ? [thumbnailUrl] : undefined,
        },
    }
}

export default async function MenuPage({ params }: MenuPageProps) {
    const { slug } = await params

    // Fetch cafe
    const cafeResult = await db
        .select({
            id: cafes.id,
            name: cafes.name,
            slug: cafes.slug,
            thumbnail: cafes.thumbnail,
            addressDisplay: cafes.addressDisplay,
        })
        .from(cafes)
        .where(and(eq(cafes.slug, slug), eq(cafes.isPublished, true)))
        .limit(1)

    const cafe = cafeResult[0]

    if (!cafe) {
        notFound()
    }

    // Fetch menu items with all metadata fields
    const menuItems = await db
        .select({
            id: cafeMenuItems.id,
            name: cafeMenuItems.name,
            description: cafeMenuItems.description,
            price: cafeMenuItems.price,
            category: cafeMenuItems.category,
            imageUrl: cafeMenuItems.imageUrl,
            isAvailable: cafeMenuItems.isAvailable,
            isSignature: cafeMenuItems.isSignature,
            isFood: cafeMenuItems.isFood,
            isHot: cafeMenuItems.isHot,
            isCold: cafeMenuItems.isCold,
            calories: cafeMenuItems.calories,
            isVegan: cafeMenuItems.isVegan,
            isVegetarian: cafeMenuItems.isVegetarian,
            sizeOptions: cafeMenuItems.sizeOptions,
            communitySubmitted: cafeMenuItems.communitySubmitted,
            sortOrder: cafeMenuItems.sortOrder,
        })
        .from(cafeMenuItems)
        .where(
            and(
                eq(cafeMenuItems.cafeId, cafe.id),
                eq(cafeMenuItems.isAvailable, true)
            )
        )
        .orderBy(asc(cafeMenuItems.sortOrder))

    // Group items by category
    const categories = [...new Set(menuItems.map((item) => item.category))]

    return (
        <div className='min-h-screen bg-background w-full'>
            {/* Header - only shows if navigated from within the site */}
            <MenuHeader
                slug={slug}
                cafeName={cafe.name}
                thumbnail={cafe.thumbnail}
                addressDisplay={cafe.addressDisplay}
            />

            {/* Menu Content */}
            <main className='w-full'>
                {!menuItems || menuItems.length === 0 ? (
                    <div className='text-center py-16 text-text/60 px-4'>
                        <Coffee className='w-12 h-12 mx-auto mb-4 opacity-30' />
                        <p className='text-lg font-medium'>No menu items yet</p>
                        <p className='text-sm mt-1'>
                            Check back later for updates
                        </p>
                    </div>
                ) : (
                    <MenuContent
                        menuItems={menuItems.map((item) => ({
                            id: item.id,
                            name: item.name,
                            description: item.description,
                            price: item.price,
                            category: item.category,
                            imageUrl: item.imageUrl,
                            isSignature: item.isSignature,
                            isAvailable: item.isAvailable,
                            isFood: item.isFood,
                            isHot: item.isHot,
                            isCold: item.isCold,
                            calories: item.calories,
                            isVegan: item.isVegan,
                            isVegetarian: item.isVegetarian,
                            sizeOptions: item.sizeOptions,
                            communitySubmitted: item.communitySubmitted,
                        }))}
                        categories={categories}
                        cafeId={cafe.id}
                        cafeName={cafe.name}
                        cafeSlug={cafe.slug}
                    />
                )}
            </main>

            {/* Footer */}
            <footer className='border-t border-text/10'>
                <div className='max-w-2xl mx-auto px-4 py-6 text-center'>
                    <Link
                        href={`/cafes/${slug}`}
                        className='text-sm text-primary hover:underline'
                    >
                        View full cafe details →
                    </Link>
                    <p className='text-xs text-text/40 mt-3'>
                        Powered by{" "}
                        <Link
                            href='/'
                            className='text-primary hover:underline'
                        >
                            Grounds.ph
                        </Link>
                    </p>
                </div>
            </footer>
        </div>
    )
}
