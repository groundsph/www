import { Metadata } from "next"
import { getUserCollections } from "@/app/api/actions/collection"
import CollectionsListClient from "./CollectionsListClient"

export const metadata: Metadata = {
    title: "My Collections",
    description: "Manage your cafe collections",
}

export default async function MyCollectionsPage() {
    const collections = await getUserCollections()

    return <CollectionsListClient initialCollections={collections} />
}
