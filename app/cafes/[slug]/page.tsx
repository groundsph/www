import CafeDetails from "@/components/CafeDetails"

export default async function CafePage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    // Get cafe by slug
    const { slug } = await params

    // Pass cafe slug to client component
    return <CafeDetails cafeSlug={slug} />
}
