import { createAdminClient } from "@/utils/supabase/admin"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Coffee } from "lucide-react"
import { getCafeThumbnailUrl } from "@/utils/extras"

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
            {/* Header */}
            <header className='sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-text/10'>
                <div className='max-w-2xl mx-auto px-4 py-3 flex items-center gap-3'>
                    <Link
                        href={`/cafes/${slug}`}
                        className='p-2 hover:bg-text/10 rounded-full transition-colors'
                    >
                        <ArrowLeft className='w-5 h-5' />
                    </Link>
                    {cafe.thumbnail && (
                        <div className='relative w-10 h-10 rounded-full overflow-hidden shrink-0'>
                            <Image
                                src={getCafeThumbnailUrl(cafe.thumbnail)}
                                alt={cafe.name}
                                fill
                                className='object-cover'
                            />
                        </div>
                    )}
                    <div className='flex-1 min-w-0'>
                        <h1 className='font-semibold truncate'>{cafe.name}</h1>
                        <p className='text-xs text-text/60 truncate'>
                            {cafe.address_display}
                        </p>
                    </div>
                </div>
            </header>

            {/* Menu Content */}
            <main className='max-w-6xl mx-auto px-4 py-6'>
                {!menuItems || menuItems.length === 0 ? (
                    <div className='text-center py-16 text-text/60'>
                        <Coffee className='w-12 h-12 mx-auto mb-4 opacity-30' />
                        <p className='text-lg font-medium'>No menu items yet</p>
                        <p className='text-sm mt-1'>
                            Check back later for updates
                        </p>
                    </div>
                ) : (
                    <div className='space-y-8'>
                        {categories.map((category) => (
                            <section key={category}>
                                <h2 className='text-lg font-semibold mb-4 text-primary'>
                                    {category}
                                </h2>
                                <div className='space-y-3'>
                                    {menuItems
                                        .filter(
                                            (item) => item.category === category
                                        )
                                        .map((item) => (
                                            <div
                                                key={item.id}
                                                className='flex gap-4 p-4 bg-text/5 rounded-xl'
                                            >
                                                {item.image_url && (
                                                    <div className='relative w-20 h-20 rounded-lg overflow-hidden shrink-0'>
                                                        <Image
                                                            src={item.image_url}
                                                            alt={item.name}
                                                            fill
                                                            className='object-cover'
                                                        />
                                                    </div>
                                                )}
                                                <div className='flex-1 min-w-0'>
                                                    <div className='flex items-start justify-between gap-2'>
                                                        <div>
                                                            <h3 className='font-medium flex items-center gap-2'>
                                                                {item.name}
                                                                {item.is_signature && (
                                                                    <span className='px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded'>
                                                                        ★
                                                                    </span>
                                                                )}
                                                            </h3>
                                                            {item.description && (
                                                                <p className='text-sm text-text/60 mt-1'>
                                                                    {
                                                                        item.description
                                                                    }
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className='font-bold text-primary whitespace-nowrap'>
                                                            ₱
                                                            {item.price.toFixed(
                                                                0
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className='border-t border-text/10 mt-12'>
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
                            Grounds
                        </Link>
                    </p>
                </div>
            </footer>
        </div>
    )
}
