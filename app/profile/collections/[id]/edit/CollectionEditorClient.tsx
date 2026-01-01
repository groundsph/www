"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Reorder } from "motion/react"
import {
    ArrowLeft,
    Save,
    Trash2,
    Plus,
    Search,
    X,
    GripVertical,
    Coffee,
    Loader2,
    Eye,
    EyeOff,
    ImageIcon,
} from "lucide-react"
import {
    updateCollection,
    deleteCollection,
    searchCafesForCollection,
} from "@/app/api/actions/collection"
import { getCafesByIds } from "@/app/api/actions/profile"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { useNotification } from "@/components/NotificationProvider"
import ImageCropper from "@/components/ui/ImageCropper"
import { uploadCollectionCover } from "@/utils/storage/client"

interface CollectionItem {
    cafeId: string
    note?: string
}

interface Collection {
    id: string
    userId: string
    title: string
    slug: string
    description: string | null
    coverImage: string | null
    items: CollectionItem[] | null
    itemCount: number | null
    isPublic: boolean | null
    viewsCount: number | null
    likesCount: number | null
    createdAt: string | null
    updatedAt: string | null
}

interface CafeSearchResult {
    id: string
    name: string
    slug: string
    thumbnail: string
    cityMunicipality: string
    region: string
}

// Local cafe data for display
interface CafeData {
    id: string
    name: string
    thumbnail: string
    location: string
    note?: string
}

export default function CollectionEditorClient({
    collection,
}: {
    collection: Collection
}) {
    const router = useRouter()
    const { addNotification } = useNotification()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [title, setTitle] = useState(collection.title)
    const [description, setDescription] = useState(collection.description || "")
    const [coverImage, setCoverImage] = useState(collection.coverImage || "")
    const [isPublic, setIsPublic] = useState(collection.isPublic ?? true)
    const [items, setItems] = useState<CollectionItem[]>(collection.items || [])
    const [cafesData, setCafesData] = useState<Map<string, CafeData>>(new Map())

    // UI state
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<CafeSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Image cropper state
    const [croppingImage, setCroppingImage] = useState<File | null>(null)
    const [showCropper, setShowCropper] = useState(false)
    const [isUploadingCover, setIsUploadingCover] = useState(false)

    // Debounced search for cafes
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([])
            return
        }

        const timeoutId = setTimeout(async () => {
            setIsSearching(true)
            try {
                const results = await searchCafesForCollection(searchQuery)
                // Filter out already added cafes
                const existingIds = new Set(items.map((item) => item.cafeId))
                setSearchResults(results.filter((r) => !existingIds.has(r.id)))
            } catch (err) {
                console.error("Search failed:", err)
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [searchQuery, items])

    // Fetch cafe details for existing items on mount
    useEffect(() => {
        const fetchExistingCafes = async () => {
            const existingCafeIds = items
                .map((item) => item.cafeId)
                .filter((id) => !cafesData.has(id))

            if (existingCafeIds.length === 0) return

            try {
                const cafesResult = await getCafesByIds(existingCafeIds)
                setCafesData((prev) => {
                    const newMap = new Map(prev)
                    for (const cafe of cafesResult) {
                        newMap.set(cafe.id, {
                            id: cafe.id,
                            name: cafe.name,
                            thumbnail: cafe.thumbnail || "",
                            location: `${cafe.city_municipality}, ${cafe.region}`,
                        })
                    }
                    return newMap
                })
            } catch (err) {
                console.error("Failed to fetch existing cafe details:", err)
            }
        }

        fetchExistingCafes()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Only run on mount

    // Add cafe to collection
    const addCafe = (cafe: CafeSearchResult) => {
        setItems((prev) => [...prev, { cafeId: cafe.id }])
        setCafesData((prev) => {
            const newMap = new Map(prev)
            newMap.set(cafe.id, {
                id: cafe.id,
                name: cafe.name,
                thumbnail: cafe.thumbnail,
                location: `${cafe.cityMunicipality}, ${cafe.region}`,
            })
            return newMap
        })
        setSearchQuery("")
        setSearchResults([])
    }

    // Remove cafe from collection
    const removeCafe = (cafeId: string) => {
        setItems((prev) => prev.filter((item) => item.cafeId !== cafeId))
    }

    // Move cafe up/down
    const moveCafe = (index: number, direction: "up" | "down") => {
        if (direction === "up" && index === 0) return
        if (direction === "down" && index === items.length - 1) return

        const newItems = [...items]
        const targetIndex = direction === "up" ? index - 1 : index + 1
        const [removed] = newItems.splice(index, 1)
        newItems.splice(targetIndex, 0, removed)
        setItems(newItems)
    }

    // Update cafe note
    const updateNote = (cafeId: string, note: string) => {
        setItems((prev) =>
            prev.map((item) =>
                item.cafeId === cafeId
                    ? { ...item, note: note || undefined }
                    : item
            )
        )
    }

    // Save collection
    const handleSave = async () => {
        if (!title.trim()) {
            addNotification("Title is required", "error")
            return
        }

        setIsSaving(true)

        try {
            await updateCollection(collection.id, {
                title: title.trim(),
                description: description.trim() || undefined,
                coverImage: coverImage || undefined,
                isPublic,
                items,
            })
            addNotification("Collection saved!", "success")
        } catch (err) {
            console.error(err)
            addNotification("Failed to save collection", "error")
        } finally {
            setIsSaving(false)
        }
    }

    // Delete collection
    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteCollection(collection.id)
            addNotification("Collection deleted", "success")
            router.push("/profile/collections")
        } catch (err) {
            console.error(err)
            addNotification("Failed to delete collection", "error")
            setIsDeleting(false)
        }
    }

    // Handle file selection for cover image
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            addNotification("Please select an image file", "error")
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            addNotification("Image must be less than 10MB", "error")
            return
        }
        setCroppingImage(file)
        setShowCropper(true)
        e.target.value = ""
    }

    // Handle image crop completion
    const handleCropComplete = async (croppedBlob: Blob) => {
        setShowCropper(false)
        setCroppingImage(null)
        setIsUploadingCover(true)

        try {
            const file = new File([croppedBlob], "cover.jpg", {
                type: "image/jpeg",
            })
            const result = await uploadCollectionCover(file)
            if (result.success && result.url) {
                setCoverImage(result.url)
                addNotification("Cover image updated!", "success")
            } else {
                addNotification(
                    result.error || "Failed to upload image",
                    "error"
                )
            }
        } catch (err) {
            console.error(err)
            addNotification("Failed to upload image", "error")
        } finally {
            setIsUploadingCover(false)
        }
    }

    return (
        <div className='min-h-screen bg-background w-full'>
            {/* Header */}
            <div className='border-b w-full border-secondary/20 bg-background/80 backdrop-blur-sm sticky top-0 z-20'>
                <div className='max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4'>
                    <div className='flex items-center gap-4'>
                        <Link
                            href='/profile/collections'
                            className='p-2 -ml-2 text-text/60 hover:text-text transition-colors'
                        >
                            <ArrowLeft className='w-5 h-5' />
                        </Link>
                        <h1 className='font-serif text-xl font-bold text-text'>
                            Edit Collection
                        </h1>
                    </div>

                    <div className='flex items-center gap-3'>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className='p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors'
                            title='Delete collection'
                        >
                            <Trash2 className='w-5 h-5' />
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors'
                        >
                            {isSaving ? (
                                <Loader2 className='w-4 h-4 animate-spin' />
                            ) : (
                                <Save className='w-4 h-4' />
                            )}
                            Save
                        </button>
                    </div>
                </div>
            </div>

            <div className='max-w-5xl mx-auto px-6 py-8'>
                <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
                    {/* Left: Details */}
                    <div className='lg:col-span-1 space-y-6'>
                        {/* Cover Image */}
                        <div>
                            <label className='block text-sm font-medium text-text mb-2'>
                                Cover Image
                            </label>
                            <input
                                ref={fileInputRef}
                                type='file'
                                accept='image/*'
                                onChange={handleFileSelect}
                                className='hidden'
                            />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className='relative aspect-square rounded-xl border-2 border-dashed border-secondary/30 hover:border-primary/50 cursor-pointer overflow-hidden transition-colors group'
                            >
                                {isUploadingCover ? (
                                    <div className='w-full h-full flex flex-col items-center justify-center'>
                                        <Loader2 className='w-8 h-8 text-primary animate-spin' />
                                        <span className='text-sm text-text/60 mt-2'>
                                            Uploading...
                                        </span>
                                    </div>
                                ) : coverImage ? (
                                    <>
                                        <Image
                                            src={coverImage}
                                            alt='Cover'
                                            fill
                                            className='object-cover'
                                        />
                                        <div className='absolute inset-0 bg-text/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                                            <span className='text-white text-sm font-medium'>
                                                Change
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className='w-full h-full flex flex-col items-center justify-center text-text/40 group-hover:text-primary/60 transition-colors'>
                                        <ImageIcon className='w-10 h-10 mb-2' />
                                        <span className='text-sm'>
                                            Add cover image
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label className='block text-sm font-medium text-text mb-2'>
                                Title <span className='text-primary'>*</span>
                            </label>
                            <input
                                type='text'
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className='w-full px-4 py-3 bg-background border border-secondary/30 rounded-xl text-text focus:outline-none focus:border-primary/50 transition-colors'
                                maxLength={100}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className='block text-sm font-medium text-text mb-2'>
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className='w-full px-4 py-3 bg-background border border-secondary/30 rounded-xl text-text focus:outline-none focus:border-primary/50 transition-colors resize-none'
                                maxLength={500}
                            />
                        </div>

                        {/* Visibility */}
                        <div className='flex items-center justify-between p-4 bg-secondary/5 rounded-xl'>
                            <div className='flex items-center gap-3'>
                                {isPublic ? (
                                    <Eye className='w-5 h-5 text-primary' />
                                ) : (
                                    <EyeOff className='w-5 h-5 text-text/50' />
                                )}
                                <div>
                                    <p className='text-sm font-medium text-text'>
                                        {isPublic ? "Public" : "Private"}
                                    </p>
                                    <p className='text-xs text-text/60'>
                                        {isPublic
                                            ? "Anyone can view"
                                            : "Only you can view"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPublic(!isPublic)}
                                className={`w-12 h-6 rounded-full transition-colors ${
                                    isPublic ? "bg-primary" : "bg-secondary/30"
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                                        isPublic
                                            ? "translate-x-6"
                                            : "translate-x-0.5"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Right: Cafes */}
                    <div className='lg:col-span-2 space-y-6'>
                        {/* Search */}
                        <div>
                            <label className='block text-sm font-medium text-text mb-2'>
                                Add Cafes
                            </label>
                            <div className='relative'>
                                <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40' />
                                <input
                                    type='text'
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    placeholder='Search cafes to add...'
                                    className='w-full pl-12 pr-4 py-3 bg-background border border-secondary/30 rounded-xl text-text placeholder:text-text/40 focus:outline-none focus:border-primary/50 transition-colors'
                                />
                                {isSearching && (
                                    <Loader2 className='absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-spin' />
                                )}
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className='mt-2 border border-secondary/20 rounded-xl overflow-hidden divide-y divide-secondary/10'>
                                    {searchResults.map((cafe) => (
                                        <button
                                            key={cafe.id}
                                            onClick={() => addCafe(cafe)}
                                            className='w-full flex items-center gap-3 p-3 hover:bg-secondary/5 transition-colors text-left'
                                        >
                                            <div className='relative w-10 h-10 rounded-lg overflow-hidden bg-secondary/10 shrink-0'>
                                                {cafe.thumbnail ? (
                                                    <Image
                                                        src={getCafeThumbnailUrl(
                                                            cafe.thumbnail
                                                        )}
                                                        alt={cafe.name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full flex items-center justify-center'>
                                                        <Coffee className='w-5 h-5 text-secondary/40' />
                                                    </div>
                                                )}
                                            </div>
                                            <div className='flex-1 min-w-0'>
                                                <p className='text-sm font-medium text-text truncate'>
                                                    {cafe.name}
                                                </p>
                                                <p className='text-xs text-text/60 truncate'>
                                                    {cafe.cityMunicipality},{" "}
                                                    {cafe.region}
                                                </p>
                                            </div>
                                            <Plus className='w-5 h-5 text-primary shrink-0' />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cafes List */}
                        <div>
                            <div className='flex items-center justify-between mb-3'>
                                <label className='text-sm font-medium text-text'>
                                    Cafes ({items.length})
                                </label>
                            </div>

                            {items.length === 0 ? (
                                <div className='text-center py-12 border border-dashed border-secondary/30 rounded-xl'>
                                    <Coffee className='w-10 h-10 text-secondary/40 mx-auto mb-3' />
                                    <p className='text-text/60'>
                                        No cafes added yet
                                    </p>
                                    <p className='text-sm text-text/40'>
                                        Search above to add cafes
                                    </p>
                                </div>
                            ) : (
                                <Reorder.Group
                                    axis='y'
                                    values={items.map((i) => i.cafeId)}
                                    onReorder={(newOrder) => {
                                        // Reorder items based on new cafeId order
                                        const newItems = newOrder.map(
                                            (cafeId) =>
                                                items.find(
                                                    (i) => i.cafeId === cafeId
                                                )!
                                        )
                                        setItems(newItems)
                                    }}
                                    className='space-y-3'
                                >
                                    {items.map((item, index) => {
                                        const cafe = cafesData.get(item.cafeId)
                                        return (
                                            <Reorder.Item
                                                key={item.cafeId}
                                                value={item.cafeId}
                                                className='flex items-start gap-3 p-4 bg-secondary/5 rounded-xl group cursor-grab active:cursor-grabbing'
                                            >
                                                {/* Drag Handle & Index */}
                                                <div className='flex flex-col items-center gap-1 pt-1'>
                                                    <GripVertical className='w-4 h-4 text-text/30' />
                                                    <span className='text-xs text-text/40 font-medium'>
                                                        {index + 1}
                                                    </span>
                                                </div>

                                                {/* Thumbnail */}
                                                <div className='relative w-14 h-14 rounded-lg overflow-hidden bg-secondary/10 shrink-0'>
                                                    {cafe?.thumbnail ? (
                                                        <Image
                                                            src={getCafeThumbnailUrl(
                                                                cafe.thumbnail
                                                            )}
                                                            alt={cafe.name}
                                                            fill
                                                            className='object-cover'
                                                        />
                                                    ) : (
                                                        <div className='w-full h-full flex items-center justify-center'>
                                                            <Coffee className='w-6 h-6 text-secondary/40' />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className='flex-1 min-w-0'>
                                                    <p className='font-medium text-text truncate'>
                                                        {cafe?.name ||
                                                            "Loading..."}
                                                    </p>
                                                    <p className='text-sm text-text/60 truncate'>
                                                        {cafe?.location || ""}
                                                    </p>
                                                    {/* Note input */}
                                                    <input
                                                        type='text'
                                                        value={item.note || ""}
                                                        onChange={(e) =>
                                                            updateNote(
                                                                item.cafeId,
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder='Add a note...'
                                                        className='mt-2 w-full px-3 py-1.5 text-sm bg-background border border-secondary/20 rounded-lg text-text placeholder:text-text/30 focus:outline-none focus:border-primary/50'
                                                        maxLength={200}
                                                    />
                                                </div>

                                                {/* Actions */}
                                                <div className='flex flex-col gap-1'>
                                                    <button
                                                        onClick={() =>
                                                            moveCafe(
                                                                index,
                                                                "up"
                                                            )
                                                        }
                                                        disabled={index === 0}
                                                        className='p-1 text-text/40 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            moveCafe(
                                                                index,
                                                                "down"
                                                            )
                                                        }
                                                        disabled={
                                                            index ===
                                                            items.length - 1
                                                        }
                                                        className='p-1 text-text/40 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
                                                    >
                                                        ▼
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            removeCafe(
                                                                item.cafeId
                                                            )
                                                        }
                                                        className='p-1 text-red-400 hover:text-red-500 transition-colors'
                                                    >
                                                        <X className='w-4 h-4' />
                                                    </button>
                                                </div>
                                            </Reorder.Item>
                                        )
                                    })}
                                </Reorder.Group>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
                    <div
                        className='absolute inset-0 bg-text/50 backdrop-blur-sm'
                        onClick={() => setShowDeleteConfirm(false)}
                    />
                    <div className='relative w-full max-w-sm bg-background rounded-2xl p-6 shadow-xl'>
                        <h3 className='font-serif text-xl font-semibold text-text mb-2'>
                            Delete Collection?
                        </h3>
                        <p className='text-text/60 mb-6'>
                            This action cannot be undone. All data will be
                            permanently deleted.
                        </p>
                        <div className='flex gap-3'>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className='flex-1 px-4 py-3 text-text/70 font-medium rounded-xl border border-secondary/30 hover:bg-secondary/10 transition-colors'
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className='flex-1 px-4 py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2'
                            >
                                {isDeleting && (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                )}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Cropper */}
            <ImageCropper
                open={showCropper}
                image={croppingImage}
                aspect={1}
                onComplete={handleCropComplete}
                onCancel={() => {
                    setShowCropper(false)
                    setCroppingImage(null)
                }}
            />
        </div>
    )
}
