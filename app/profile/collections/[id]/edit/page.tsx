import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getCollectionForEdit } from "@/app/api/actions/collection"
import CollectionEditorClient from "./CollectionEditorClient"

interface Props {
    params: Promise<{ id: string }>
}

export const metadata: Metadata = {
    title: "Edit Collection",
    description: "Edit your cafe collection",
}

export default async function EditCollectionPage({ params }: Props) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
        redirect("/auth?redirect=/profile/collections")
    }

    const { id } = await params

    let collection
    try {
        collection = await getCollectionForEdit(id)
    } catch {
        notFound()
    }

    return <CollectionEditorClient collection={collection} />
}
