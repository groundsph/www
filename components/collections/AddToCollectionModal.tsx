"use client"

import { useState, useEffect, useTransition } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Plus, Check, FolderPlus, Loader2 } from "lucide-react"
import Image from "next/image"
import {
    getCollectionsWithCafeStatus,
    addCafeToCollection,
    removeCafeFromCollection,
    createCollection,
} from "@/app/api/actions/collection"

interface CollectionWithStatus {
    id: string
    title: string
    slug: string
    coverImage: string | null
    itemCount: number | null
    isPublic: boolean | null
    hasCafe: boolean
}

interface AddToCollectionModalProps {
    isOpen: boolean
    onClose: () => void
    cafeId: string
    cafeName: string
}

export default function AddToCollectionModal({
    isOpen,
    onClose,
    cafeId,
    cafeName,
}: AddToCollectionModalProps) {
    const [collections, setCollections] = useState<CollectionWithStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [newCollectionName, setNewCollectionName] = useState("")
    const [creating, setCreating] = useState(false)

    // Fetch collections on mount
    useEffect(() => {
        if (isOpen) {
            setLoading(true)
            getCollectionsWithCafeStatus(cafeId)
                .then(setCollections)
                .finally(() => setLoading(false))
        }
    }, [isOpen, cafeId])

    const handleToggle = (collection: CollectionWithStatus) => {
        startTransition(async () => {
            try {
                if (collection.hasCafe) {
                    await removeCafeFromCollection(collection.id, cafeId)
                } else {
                    await addCafeToCollection(collection.id, cafeId)
                }
                // Update local state
                setCollections((prev) =>
                    prev.map((c) =>
                        c.id === collection.id
                            ? {
                                  ...c,
                                  hasCafe: !c.hasCafe,
                                  itemCount: c.hasCafe
                                      ? (c.itemCount ?? 0) - 1
                                      : (c.itemCount ?? 0) + 1,
                              }
                            : c
                    )
                )
            } catch (error) {
                console.error("Failed to update collection:", error)
            }
        })
    }

    const handleCreateCollection = async () => {
        if (!newCollectionName.trim()) return
        setCreating(true)
        try {
            const result = await createCollection({
                title: newCollectionName.trim(),
                isPublic: true,
            })
            // Add cafe to new collection
            await addCafeToCollection(result.id, cafeId)
            // Refresh collections
            const updated = await getCollectionsWithCafeStatus(cafeId)
            setCollections(updated)
            setNewCollectionName("")
            setShowCreateForm(false)
        } catch (error) {
            console.error("Failed to create collection:", error)
        } finally {
            setCreating(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className='fixed inset-0 bg-black/60 backdrop-blur-sm z-50'
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background rounded-2xl shadow-2xl z-50 overflow-hidden'
                    >
                        {/* Header */}
                        <div className='flex items-center justify-between p-4 border-b border-text/10'>
                            <div>
                                <h2 className='text-lg font-semibold'>
                                    Add to Collection
                                </h2>
                                <p className='text-sm text-text/60 truncate max-w-[280px]'>
                                    {cafeName}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className='p-2 hover:bg-text/10 rounded-full transition-colors cursor-pointer'
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        {/* Content */}
                        <div className='p-4 max-h-[60vh] overflow-y-auto'>
                            {loading ? (
                                <div className='flex items-center justify-center py-8'>
                                    <Loader2 className='w-6 h-6 animate-spin text-text opacity-50' />
                                </div>
                            ) : collections.length === 0 && !showCreateForm ? (
                                <div className='text-center py-8'>
                                    <FolderPlus className='w-12 h-12 mx-auto text-text opacity-30 mb-3' />
                                    <p className='text-text/60 mb-4'>
                                        You don&apos;t have any collections yet
                                    </p>
                                    <button
                                        onClick={() => setShowCreateForm(true)}
                                        className='px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-pointer'
                                    >
                                        Create Your First Collection
                                    </button>
                                </div>
                            ) : (
                                <div className='space-y-2'>
                                    {/* Collection List */}
                                    {collections.map((collection) => (
                                        <button
                                            key={collection.id}
                                            onClick={() =>
                                                handleToggle(collection)
                                            }
                                            disabled={isPending}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                                                collection.hasCafe
                                                    ? "bg-primary/10 border-2 border-primary"
                                                    : "bg-text/5 border-2 border-transparent hover:border-text/20"
                                            } ${isPending ? "opacity-50" : ""}`}
                                        >
                                            {/* Cover Image */}
                                            <div className='w-12 h-12 rounded-lg bg-text/10 overflow-hidden shrink-0'>
                                                {collection.coverImage ? (
                                                    <Image
                                                        src={
                                                            collection.coverImage
                                                        }
                                                        alt={collection.title}
                                                        width={48}
                                                        height={48}
                                                        className='w-full h-full object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full flex items-center justify-center text-text opacity-30'>
                                                        <FolderPlus className='w-5 h-5' />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className='flex-1 text-left'>
                                                <p className='font-medium truncate'>
                                                    {collection.title}
                                                </p>
                                                <p className='text-sm text-text/50'>
                                                    {collection.itemCount} cafe
                                                    {collection.itemCount !== 1
                                                        ? "s"
                                                        : ""}
                                                </p>
                                            </div>

                                            {/* Checkbox */}
                                            <div
                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                    collection.hasCafe
                                                        ? "bg-primary border-primary text-white"
                                                        : "border-text/30"
                                                }`}
                                            >
                                                {collection.hasCafe && (
                                                    <Check className='w-4 h-4' />
                                                )}
                                            </div>
                                        </button>
                                    ))}

                                    {/* Create New Collection */}
                                    {showCreateForm ? (
                                        <div className='p-3 bg-text/5 rounded-xl space-y-3'>
                                            <input
                                                type='text'
                                                placeholder='Collection name...'
                                                value={newCollectionName}
                                                onChange={(e) =>
                                                    setNewCollectionName(
                                                        e.target.value
                                                    )
                                                }
                                                autoFocus
                                                className='w-full px-3 py-2 rounded-lg border border-text/20 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50'
                                            />
                                            <div className='flex gap-2'>
                                                <button
                                                    onClick={() => {
                                                        setShowCreateForm(false)
                                                        setNewCollectionName("")
                                                    }}
                                                    className='flex-1 px-3 py-2 rounded-lg border border-text/20 font-medium hover:bg-text/5 transition-colors cursor-pointer'
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={
                                                        handleCreateCollection
                                                    }
                                                    disabled={
                                                        !newCollectionName.trim() ||
                                                        creating
                                                    }
                                                    className='flex-1 px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2'
                                                >
                                                    {creating ? (
                                                        <Loader2 className='w-4 h-4 animate-spin' />
                                                    ) : (
                                                        <>
                                                            <Plus className='w-4 h-4' />
                                                            Create
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() =>
                                                setShowCreateForm(true)
                                            }
                                            className='w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-text/20 text-text/60 hover:border-text/40 hover:text-text transition-colors cursor-pointer'
                                        >
                                            <Plus className='w-5 h-5' />
                                            New Collection
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
