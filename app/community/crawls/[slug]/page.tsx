import { getCafeCrawlBySlug } from "@/app/api/actions/cafe-crawls"
import CrawlView from "@/components/crawls/CrawlView"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const crawl = await getCafeCrawlBySlug(slug)

    if (!crawl) {
        return {
            title: "Crawl Not Found | Grounds PH",
        }
    }

    return {
        title: `${crawl.title} | Grounds PH`,
        description: crawl.description ?? `A cafe crawl with ${crawl.itemCount} cafes`,
        openGraph: {
            title: crawl.title,
            description: crawl.description ?? `A cafe crawl with ${crawl.itemCount} cafes`,
            images: crawl.coverImage ? [crawl.coverImage] : [],
        },
    }
}

export default async function CrawlPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const crawl = await getCafeCrawlBySlug(slug)

    if (!crawl) {
        notFound()
    }

    const crawlData = {
        id: crawl.id,
        title: crawl.title,
        slug: crawl.slug,
        description: crawl.description,
        coverImage: crawl.coverImage,
        itemCount: crawl.itemCount,
        viewsCount: crawl.viewsCount,
        savesCount: crawl.savesCount,
        createdAt: crawl.createdAt,
        updatedAt: crawl.updatedAt,
        status: crawl.status,
        isPublic: true,
        author: crawl.author,
        cafes: crawl.items.map((item) => ({
            id: item.id,
            cafeId: item.cafeId,
            name: item.name,
            slug: item.slug,
            thumbnail: item.thumbnail,
            cityMunicipality: item.cityMunicipality,
            region: item.region,
            averageRating: item.averageRating,
            totalReviews: item.totalReviews,
            sortOrder: item.sortOrder,
            note: item.note,
            lat: item.lat,
            lng: item.lng,
        })),
        hasSaved: crawl.hasSaved,
        isOwner: crawl.isOwner,
    }

    return <CrawlView crawl={crawlData} />
}
