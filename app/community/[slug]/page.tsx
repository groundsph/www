import { getCollectionBySlug } from "@/app/api/actions/collection"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import CollectionView from "@/components/community/CollectionView"

interface Props {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const collection = await getCollectionBySlug(slug)

    if (!collection) {
        return {
            title: "Collection Not Found",
        }
    }

    return {
        title: `${collection.title} | Cafe Collection`,
        description:
            collection.description ||
            `A curated collection of ${collection.itemCount} cafes by ${collection.author.displayName}`,
        openGraph: {
            title: `${collection.title} | Cafe Collection`,
            description:
                collection.description ||
                `A curated collection of ${collection.itemCount} cafes`,
        },
    }
}

export default async function CollectionPage({ params }: Props) {
    const { slug } = await params
    const collection = await getCollectionBySlug(slug)

    if (!collection) {
        notFound()
    }

    return <CollectionView collection={collection} />
}
