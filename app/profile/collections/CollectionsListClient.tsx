"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Plus, Layers, ArrowLeft, Eye, Heart, Lock, Coffee } from "lucide-react"
import CreateCollectionModal from "./CreateCollectionModal"

interface Collection {
    id: string
    title: string
    slug: string
    description: string | null
    coverImage: string | null
    itemCount: number | null
    isPublic: boolean | null
    viewsCount: number | null
    likesCount: number | null
    createdAt: string | null
}

export default function CollectionsListClient({
    initialCollections,
}: {
    initialCollections: Collection[]
}) {
    const [collections, setCollections] = useState(initialCollections)
    const [showCreateModal, setShowCreateModal] = useState(false)

    const handleCreated = (newCollection: { id: string; slug: string }) => {
        // Redirect to edit page
        window.location.href = `/profile/collections/${newCollection.id}/edit`
    }

    return (
        <div className='min-h-screen w-full bg-background'>
            {/* Header */}
            <div className='border-b w-full border-secondary/20 bg-background/80 backdrop-blur-sm sticky top-0 z-20'>
                <div className='max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4'>
                    <div className='flex items-center gap-4'>
                        <Link
                            href='/profile'
                            className='p-2 -ml-2 text-text/60 hover:text-text transition-colors'
                        >
                            <ArrowLeft className='w-5 h-5' />
                        </Link>
                        <div>
                            <h1 className='font-serif text-2xl font-bold text-text'>
                                My Collections
                            </h1>
                            <p className='text-sm text-text/60'>
                                {collections.length} collections
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-medium text-sm hover:bg-primary/90 transition-colors'
                    >
                        <Plus className='w-4 h-4' />
                        <span className='hidden sm:inline'>New Collection</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className='max-w-6xl mx-auto px-6 py-8'>
                {collections.length === 0 ? (
                    <div className='text-center py-16'>
                        <Layers className='w-16 h-16 text-secondary/40 mx-auto mb-4' />
                        <h3 className='text-xl font-serif font-semibold text-text mb-2'>
                            No collections yet
                        </h3>
                        <p className='text-text/60 mb-6'>
                            Create your first collection to curate and share
                            your favorite cafes.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className='inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors'
                        >
                            <Plus className='w-5 h-5' />
                            Create Collection
                        </button>
                    </div>
                ) : (
                    <div className='space-y-3'>
                        {collections.map((collection) => (
                            <Link
                                key={collection.id}
                                href={`/profile/collections/${collection.id}/edit`}
                                className='flex items-center gap-4 p-4 bg-background border border-secondary/20 hover:border-primary/30 rounded-xl transition-all group hover:shadow-md'
                            >
                                {/* Thumbnail */}
                                <div className='relative w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-lg overflow-hidden bg-secondary/10'>
                                    {collection.coverImage ? (
                                        <Image
                                            src={collection.coverImage}
                                            alt={collection.title}
                                            fill
                                            className='object-cover'
                                            sizes='80px'
                                        />
                                    ) : (
                                        <div className='w-full h-full flex items-center justify-center bg-linear-to-br from-primary/20 to-accent/20'>
                                            <Layers className='w-6 h-6 text-primary/40' />
                                        </div>
                                    )}
                                    {!collection.isPublic && (
                                        <div className='absolute top-1 right-1 p-1 bg-text/80 rounded-full'>
                                            <Lock className='w-2.5 h-2.5 text-background' />
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className='flex-1 min-w-0'>
                                    <h3 className='font-serif font-semibold text-lg text-text group-hover:text-primary transition-colors line-clamp-1'>
                                        {collection.title}
                                    </h3>
                                    {collection.description && (
                                        <p className='text-sm text-text/60 line-clamp-1 mt-0.5'>
                                            {collection.description}
                                        </p>
                                    )}
                                    <div className='flex items-center gap-4 mt-2 text-sm text-text/50'>
                                        <span className='flex items-center gap-1'>
                                            <Coffee className='w-3.5 h-3.5' />
                                            {collection.itemCount ?? 0} cafes
                                        </span>
                                        <span className='flex items-center gap-1'>
                                            <Eye className='w-3.5 h-3.5' />
                                            {collection.viewsCount ?? 0}
                                        </span>
                                        <span className='flex items-center gap-1'>
                                            <Heart className='w-3.5 h-3.5' />
                                            {collection.likesCount ?? 0}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <CreateCollectionModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handleCreated}
                />
            )}
        </div>
    )
}
