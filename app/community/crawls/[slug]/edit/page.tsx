import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getCafeCrawlBySlug } from "@/app/api/actions/cafe-crawls"
import CrawlEditor from "@/components/crawls/CrawlEditor"

interface EditCrawlPageProps {
    params: Promise<{
        slug: string
    }>
}

export default async function EditCrawlPage({ params }: EditCrawlPageProps) {
    const { slug } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session?.user) {
        redirect(`/auth/sign-in?callbackUrl=/community/crawls/${slug}/edit`)
    }

    // Fetch crawl data - slug can be either UUID or slug
    const crawl = await getCafeCrawlBySlug(slug)
    
    if (!crawl) {
        notFound()
    }

    // Verify ownership
    if (!crawl.isOwner) {
        redirect(`/community/crawls/${crawl.slug}`)
    }

    return (
        <CrawlEditor 
            crawl={{
                id: crawl.id,
                title: crawl.title,
                description: crawl.description,
                coverImage: crawl.coverImage,
                isPublic: crawl.status === "published",
                items: crawl.items.map(item => ({
                    id: item.id,
                    cafeId: item.cafeId,
                    sortOrder: item.sortOrder,
                    note: item.note,
                    name: item.name,
                    slug: item.slug,
                    thumbnail: item.thumbnail,
                    cityMunicipality: item.cityMunicipality,
                    region: item.region,
                    lat: item.lat,
                    lng: item.lng,
                })),
            }} 
            mode="edit" 
        />
    )
}
