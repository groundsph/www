import { getSavedCollections } from "@/app/api/actions/collection"
import SavedCollectionsList from "@/components/collections/SavedCollectionsList"

export default async function SavedCollectionsPage() {
    const collections = await getSavedCollections()
    return <SavedCollectionsList collections={collections} />
}
