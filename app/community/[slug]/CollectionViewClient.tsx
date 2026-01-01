"use client"

import Image from "next/image"
import Link from "next/link"
import {
    Heart,
    Eye,
    Share2,
    ArrowLeft,
    MapPin,
    Star,
    Coffee,
    User,
    Lock,
    Pencil,
} from "lucide-react"
import { useState } from "react"
import { toggleLikeCollection } from "@/app/api/actions/collection"
import { useAuth } from "@/components/AuthProvider"
import { getCafeThumbnailUrl } from "@/utils/extras"

interface CollectionData {
    id: string
    title: string
    slug: string
    description: string | null
    coverImage: string | null
    itemCount: number | null
    viewsCount: number | null
    likesCount: number | null
    isPublic: boolean | null
    createdAt: string | null
    updatedAt: string | null
    author: {
        id: string
        displayName: string
        username: string
        avatarUrl: string | null
    }
    cafes: ({
        id: string
        name: string
        slug: string
        thumbnail: string
        cityMunicipality: string
        region: string
        averageRating: number | null
        totalReviews: number | null
        note?: string
    } | null)[]
    hasLiked: boolean
    isOwner: boolean
}

export default function CollectionViewClient({
    collection,
}: {
    collection: CollectionData
}) {
    const { user } = useAuth()
    const [liked, setLiked] = useState(collection.hasLiked)
    const [likesCount, setLikesCount] = useState(collection.likesCount ?? 0)
    const [isLiking, setIsLiking] = useState(false)
    const [copied, setCopied] = useState(false)

    const handleLike = async () => {
        if (!user) return
        if (isLiking) return

        setIsLiking(true)
        try {
            const result = await toggleLikeCollection(collection.id)
            setLiked(result.liked)
            setLikesCount((prev) => (result.liked ? prev + 1 : prev - 1))
        } catch (error) {
            console.error("Failed to toggle like:", error)
        } finally {
            setIsLiking(false)
        }
    }

    const handleShare = async () => {
        const url = `${window.location.origin}/community/${collection.slug}`
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Fallback
            const input = document.createElement("input")
            input.value = url
            document.body.appendChild(input)
            input.select()
            document.execCommand("copy")
            document.body.removeChild(input)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const validCafes = collection.cafes.filter(Boolean) as NonNullable<
        (typeof collection.cafes)[number]
    >[]

    return (
        <div className='min-h-screen w-full bg-background'>
            {/* Header Bar */}
            <div className='border-b border-secondary/20 bg-background'>
                <div className='max-w-7xl mx-auto px-6 py-4'>
                    <Link
                        href='/cafes'
                        className='inline-flex items-center gap-2 text-sm font-medium text-text/60 hover:text-text transition-colors'
                    >
                        <ArrowLeft className='w-4 h-4' />
                        Back
                    </Link>
                </div>
            </div>

            {/* Collection Header - Side by Side Layout */}
            <div className='max-w-5xl mx-auto px-6 py-8'>
                <div className='flex flex-col md:flex-row gap-6 md:gap-8'>
                    {/* Cover Image - Square */}
                    <div className='relative w-full md:w-64 aspect-square shrink-0 rounded-2xl overflow-hidden bg-secondary/10'>
                        {collection.coverImage ? (
                            <Image
                                src={collection.coverImage}
                                alt={collection.title}
                                fill
                                className='object-cover'
                                priority
                            />
                        ) : (
                            <div className='w-full h-full bg-linear-to-br from-primary/30 via-accent/20 to-secondary/30 flex items-center justify-center'>
                                <Coffee className='w-16 h-16 text-primary/40' />
                            </div>
                        )}
                        {!collection.isPublic && (
                            <div className='absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-text/80 text-background text-xs font-medium rounded-full'>
                                <Lock className='w-3 h-3' />
                                Private
                            </div>
                        )}
                    </div>

                    {/* Collection Details */}
                    <div className='flex-1 flex flex-col'>
                        <h1 className='font-serif text-3xl md:text-4xl font-bold text-text mb-3'>
                            {collection.title}
                        </h1>

                        {collection.description && (
                            <p className='text-text/70 text-lg mb-4'>
                                {collection.description}
                            </p>
                        )}

                        {/* Author */}
                        <Link
                            href={`/profile/${collection.author.username}`}
                            className='inline-flex items-center gap-3 group mb-4'
                        >
                            {collection.author.avatarUrl ? (
                                <Image
                                    src={collection.author.avatarUrl}
                                    alt={collection.author.displayName}
                                    width={36}
                                    height={36}
                                    className='rounded-full'
                                />
                            ) : (
                                <div className='w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center'>
                                    <User className='w-4 h-4 text-primary' />
                                </div>
                            )}
                            <div>
                                <p className='font-medium text-text group-hover:text-primary transition-colors'>
                                    {collection.author.displayName}
                                </p>
                                <p className='text-sm text-text/50'>
                                    @{collection.author.username}
                                </p>
                            </div>
                        </Link>

                        {/* Stats and Actions */}
                        <div className='mt-auto pt-4 flex flex-wrap items-center gap-4'>
                            <div className='flex items-center gap-4 text-text/60'>
                                <span className='flex items-center gap-1.5 text-sm'>
                                    <Coffee className='w-4 h-4' />
                                    {collection.itemCount ?? 0} cafes
                                </span>
                                <span className='flex items-center gap-1.5 text-sm'>
                                    <Eye className='w-4 h-4' />
                                    {collection.viewsCount ?? 0} views
                                </span>
                            </div>

                            <div className='flex items-center gap-2 ml-auto'>
                                {collection.isOwner && (
                                    <Link
                                        href={`/profile/collections/${collection.id}/edit`}
                                        className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-text/70 hover:text-text border border-secondary/30 rounded-full hover:bg-secondary/10 transition-colors'
                                    >
                                        <Pencil className='w-4 h-4' />
                                        Edit
                                    </Link>
                                )}

                                <button
                                    onClick={handleShare}
                                    className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-text/70 hover:text-text border border-secondary/30 rounded-full hover:bg-secondary/10 transition-colors'
                                >
                                    <Share2 className='w-4 h-4' />
                                    {copied ? "Copied!" : "Share"}
                                </button>

                                <button
                                    onClick={handleLike}
                                    disabled={!user || isLiking}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                                        liked
                                            ? "bg-primary text-white"
                                            : "text-text/70 hover:text-primary border border-secondary/30 hover:border-primary/50"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <Heart
                                        className={`w-4 h-4 ${liked ? "fill-current" : ""}`}
                                    />
                                    <span>{likesCount}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cafes List */}
            <div className='max-w-4xl mx-auto px-6 pb-8'>
                {validCafes.length === 0 ? (
                    <div className='text-center py-16'>
                        <Coffee className='w-16 h-16 text-secondary/40 mx-auto mb-4' />
                        <h3 className='text-xl font-serif font-semibold text-text mb-2'>
                            No cafes yet
                        </h3>
                        <p className='text-text/60'>
                            This collection is empty.
                        </p>
                    </div>
                ) : (
                    <div className='space-y-4'>
                        {validCafes.map((cafe, index) => (
                            <Link
                                key={cafe.id}
                                href={`/cafes/${cafe.slug}`}
                                className='flex gap-4 p-4 bg-background border border-secondary/20 hover:border-secondary/40 rounded-xl transition-all group shadow-sm hover:shadow-md'
                            >
                                {/* Index */}
                                <div className='shrink-0 w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center'>
                                    <span className='text-sm font-medium text-text/50'>
                                        {index + 1}
                                    </span>
                                </div>

                                {/* Thumbnail */}
                                <div className='relative w-auto h-20 md:h-24 shrink-0 rounded-lg overflow-hidden bg-secondary/10 aspect-video'>
                                    {cafe.thumbnail ? (
                                        <Image
                                            src={getCafeThumbnailUrl(
                                                cafe.thumbnail
                                            )}
                                            alt={cafe.name}
                                            fill
                                            className='object-cover'
                                            sizes='96px'
                                        />
                                    ) : (
                                        <div className='w-full h-full flex items-center justify-center aspect-video'>
                                            <Coffee className='w-8 h-8 text-secondary/40' />
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className='flex-1 min-w-0'>
                                    <h3 className='font-serif font-semibold text-lg text-text group-hover:text-primary transition-colors line-clamp-1'>
                                        {cafe.name}
                                    </h3>
                                    <div className='flex items-center gap-1.5 text-text/60 text-sm mt-1'>
                                        <MapPin className='w-3.5 h-3.5' />
                                        <span className='line-clamp-1'>
                                            {cafe.cityMunicipality},{" "}
                                            {cafe.region}
                                        </span>
                                    </div>
                                    {cafe.averageRating && (
                                        <div className='flex items-center gap-1 mt-2'>
                                            <Star className='w-4 h-4 text-amber-500 fill-amber-500' />
                                            <span className='text-sm font-medium text-text'>
                                                {cafe.averageRating.toFixed(1)}
                                            </span>
                                            {cafe.totalReviews && (
                                                <span className='text-sm text-text/50'>
                                                    ({cafe.totalReviews}{" "}
                                                    reviews)
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {cafe.note && (
                                        <p className='text-sm text-text/60 mt-2 italic line-clamp-2'>
                                            &quot;{cafe.note}&quot;
                                        </p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
