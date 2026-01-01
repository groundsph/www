import { getCollectionBySlug } from "@/app/api/actions/collection"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import CollectionViewClient from "./CollectionViewClient"

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
            images: collection.coverImage ? [collection.coverImage] : undefined,
        },
    }
}

export default async function CollectionPage({ params }: Props) {
    const { slug } = await params
    const collection = await getCollectionBySlug(slug)

    if (!collection) {
        notFound()
    }

    return <CollectionViewClient collection={collection} />
}
