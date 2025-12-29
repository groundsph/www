import { createAdminClient } from "@/utils/supabase/admin"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import { Coffee } from "lucide-react"
import { getCafeThumbnailUrl } from "@/utils/extras"
import MenuHeader from "./MenuHeader"
import MenuContent from "./MenuContent"

interface MenuPageProps {
    params: Promise<{ slug: string }>
}

// Generate metadata for SEO
export async function generateMetadata({
    params,
}: MenuPageProps): Promise<Metadata> {
    const { slug } = await params
    const db = await createAdminClient()

    const { data: cafe } = await db
        .from("cafes")
        .select("name, description, thumbnail")
        .eq("slug", slug)
        .eq("is_published", true)
        .single()

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
    const db = await createAdminClient()

    // Fetch cafe
    const { data: cafe } = await db
        .from("cafes")
        .select("id, name, slug, thumbnail, address_display")
        .eq("slug", slug)
        .eq("is_published", true)
        .single()

    if (!cafe) {
        notFound()
    }

    // Fetch menu items
    const { data: menuItems } = await db
        .from("cafe_menu_items")
        .select("*")
        .eq("cafe_id", cafe.id)
        .eq("is_available", true)
        .order("sort_order", { ascending: true })

    // Group items by category
    const categories = [
        ...new Set((menuItems || []).map((item) => item.category)),
    ]

    return (
        <div className='min-h-screen bg-background w-full'>
            {/* Header - only shows if navigated from within the site */}
            <MenuHeader
                slug={slug}
                cafeName={cafe.name}
                thumbnail={cafe.thumbnail}
                addressDisplay={cafe.address_display}
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
                        menuItems={menuItems}
                        categories={categories}
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
