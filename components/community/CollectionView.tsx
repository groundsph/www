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
import { useAuth } from "@/components/layout/AuthProvider"
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

export default function CollectionView({
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
                        href='/community'
                        className='inline-flex items-center gap-2 text-sm font-medium text-text/60 hover:text-text transition-colors'
                    >
                        <ArrowLeft className='w-4 h-4' />
                        Back
                    </Link>
                </div>
            </div>

            {/* Collection Header - Side by Side Layout */}
            <div className='max-w-5xl mx-auto px-6 py-8'>
                <div className='flex flex-row gap-4 md:gap-8'>
                    {/* Cover Image - Square */}
                    <div className='relative w-24 h-24 md:w-64 md:h-64 shrink-0 rounded-xl md:rounded-2xl overflow-hidden bg-secondary/10'>
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
                                <Coffee className='w-8 md:w-16 h-8 md:h-16 text-primary/40' />
                            </div>
                        )}
                        {!collection.isPublic && (
                            <div className='absolute top-2 right-2 md:top-3 md:right-3 flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 bg-text/80 text-background text-[10px] md:text-xs font-medium rounded-full'>
                                <Lock className='w-2.5 h-2.5 md:w-3 md:h-3' />
                                <span className='hidden md:inline'>
                                    Private
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Collection Details */}
                    <div className='flex-1 flex flex-col min-w-0'>
                        <h1 className='font-serif text-xl md:text-4xl font-bold text-text mb-1 md:mb-3 line-clamp-2'>
                            {collection.title}
                        </h1>

                        {collection.description && (
                            <p className='text-text/70 text-sm md:text-lg mb-2 md:mb-4 line-clamp-2 md:line-clamp-none'>
                                {collection.description}
                            </p>
                        )}

                        {/* Author */}
                        <Link
                            href={`/profile/${collection.author.username}`}
                            className='inline-flex items-center gap-2 md:gap-3 group mb-2 md:mb-4'
                        >
                            {collection.author.avatarUrl ? (
                                <Image
                                    src={collection.author.avatarUrl}
                                    alt={collection.author.displayName}
                                    width={36}
                                    height={36}
                                    className='rounded-full w-7 h-7 md:w-9 md:h-9'
                                />
                            ) : (
                                <div className='w-7 h-7 md:w-9 md:h-9 rounded-full bg-primary/20 flex items-center justify-center'>
                                    <User className='w-3.5 h-3.5 md:w-4 md:h-4 text-primary' />
                                </div>
                            )}
                            <div>
                                <p className='font-medium text-sm md:text-base text-text group-hover:text-primary transition-colors'>
                                    {collection.author.displayName}
                                </p>
                                <p className='text-xs md:text-sm text-text/50'>
                                    @{collection.author.username}
                                </p>
                            </div>
                        </Link>

                        {/* Stats - Mobile compact, Desktop full */}
                        <div className='flex items-center gap-3 md:gap-4 text-text/60 text-xs md:text-sm'>
                            <span className='flex items-center gap-1 md:gap-1.5'>
                                <Coffee className='w-3.5 h-3.5 md:w-4 md:h-4' />
                                {collection.itemCount ?? 0} cafes
                            </span>
                            <span className='flex items-center gap-1 md:gap-1.5'>
                                <Eye className='w-3.5 h-3.5 md:w-4 md:h-4' />
                                {collection.viewsCount ?? 0} views
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions - Full width row below on mobile, inline on desktop */}
                <div className='flex items-center gap-2 mt-4 md:mt-0 md:hidden'>
                    <button
                        onClick={handleShare}
                        className='flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-text/70 hover:text-text border border-secondary/30 rounded-full hover:bg-secondary/10 transition-colors'
                    >
                        <Share2 className='w-3.5 h-3.5' />
                        {copied ? "Copied!" : "Share"}
                    </button>

                    {collection.isOwner && (
                        <Link
                            href={`/profile/collections/${collection.id}/edit`}
                            className='flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-text/70 hover:text-text border border-secondary/30 rounded-full hover:bg-secondary/10 transition-colors'
                        >
                            <Pencil className='w-3.5 h-3.5' />
                            Edit
                        </Link>
                    )}

                    <button
                        onClick={handleLike}
                        disabled={!user || isLiking}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                            liked
                                ? "bg-primary text-white"
                                : "text-text/70 hover:text-primary border border-secondary/30 hover:border-primary/50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <Heart
                            className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`}
                        />
                        <span>{likesCount}</span>
                    </button>
                </div>

                {/* Desktop Actions - Hidden on mobile */}
                <div className='hidden md:flex items-center gap-2 mt-4'>
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

            {/* Cafes List */}
            <div className='max-w-5xl mx-auto px-4 md:px-6 pb-8'>
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
                    <div className='space-y-3 md:space-y-4'>
                        {validCafes.map((cafe, index) => (
                            <Link
                                key={cafe.id}
                                href={`/cafes/${cafe.slug}`}
                                className='flex gap-3 md:gap-4 p-3 md:p-4 bg-background border border-secondary/20 hover:border-secondary/40 rounded-xl transition-all group shadow-sm hover:shadow-md'
                            >
                                {/* Desktop Index - Hidden on Mobile */}
                                <div className='hidden md:flex shrink-0 w-8 h-8 rounded-full bg-secondary/10 items-center justify-center'>
                                    <span className='text-sm font-medium text-text/50'>
                                        {index + 1}
                                    </span>
                                </div>

                                {/* Thumbnail */}
                                <div className='relative w-20 h-20 md:w-auto md:h-24 shrink-0 rounded-lg overflow-hidden bg-secondary/10 aspect-square md:aspect-video'>
                                    {cafe.thumbnail ? (
                                        <Image
                                            src={getCafeThumbnailUrl(
                                                cafe.thumbnail
                                            )}
                                            alt={cafe.name}
                                            fill
                                            className='object-cover'
                                            sizes='(max-width: 768px) 80px, 160px'
                                        />
                                    ) : (
                                        <div className='w-full h-full flex items-center justify-center'>
                                            <Coffee className='w-6 h-6 md:w-8 md:h-8 text-secondary/40' />
                                        </div>
                                    )}

                                    {/* Mobile Index Overlay */}
                                    <div className='md:hidden absolute top-1 left-1 w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-xs'>
                                        <span className='text-[10px] font-bold text-text'>
                                            {index + 1}
                                        </span>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className='flex-1 min-w-0 flex flex-col justify-center'>
                                    <h3 className='font-serif font-semibold text-base md:text-lg text-text group-hover:text-primary transition-colors line-clamp-1'>
                                        {cafe.name}
                                    </h3>
                                    <div className='flex items-center gap-1.5 text-text/60 text-xs md:text-sm mt-0.5 md:mt-1'>
                                        <MapPin className='w-3 h-3 md:w-3.5 md:h-3.5 shrink-0' />
                                        <span className='line-clamp-1'>
                                            {cafe.cityMunicipality}
                                        </span>
                                    </div>
                                    {cafe.averageRating && (
                                        <div className='flex items-center gap-1 mt-1.5 md:mt-2'>
                                            <Star className='w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500 fill-amber-500' />
                                            <span className='text-xs md:text-sm font-medium text-text'>
                                                {cafe.averageRating.toFixed(1)}
                                            </span>
                                            {cafe.totalReviews && (
                                                <span className='text-xs md:text-sm text-text/50'>
                                                    ({cafe.totalReviews})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {cafe.note && (
                                        <p className='text-xs md:text-sm text-text/60 mt-1.5 md:mt-2 italic line-clamp-1 md:line-clamp-2'>
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
