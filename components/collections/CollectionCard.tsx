"use client"

import Image from "next/image"
import Link from "next/link"
import { Heart, Eye, Coffee, Layers, Bookmark } from "lucide-react"

interface CollectionCardProps {
    collection: {
        id: string
        title: string
        slug: string
        description?: string | null
        coverImage?: string | null
        itemCount: number | null
        viewsCount: number | null
        likesCount: number | null
        savesCount?: number | null
        isPublic: boolean | null
        createdAt: string | null
    }
    showAuthor?: boolean
    author?: {
        displayName: string
        username: string
        avatarUrl?: string | null
    }
}

export default function CollectionCard({
    collection,
    showAuthor,
    author,
}: CollectionCardProps) {
    return (
        <Link
            href={`/community/${collection.slug}`}
            className='group flex flex-col bg-background border border-secondary/20 hover:border-secondary/40 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg'
        >
            {/* Cover Image */}
            <div className='relative w-full aspect-square bg-secondary/10 overflow-hidden'>
                {collection.coverImage ? (
                    <Image
                        src={collection.coverImage}
                        alt={collection.title}
                        fill
                        className='object-cover group-hover:scale-105 transition-transform duration-500'
                        sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                    />
                ) : (
                    <div className='w-full h-full flex items-center justify-center bg-linear-to-br from-primary/20 to-accent/20'>
                        <Layers className='w-12 h-12 text-primary opacity-40' />
                    </div>
                )}
                {/* Overlay gradient */}
                <div className='absolute inset-0 bg-linear-to-t from-text/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300' />

                {/* Item count badge */}
                <div className='absolute top-3 right-3 bg-background/90 backdrop-blur-sm text-text text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm'>
                    <Coffee className='w-3 h-3 text-primary' />
                    {collection.itemCount ?? 0} cafes
                </div>

                {/* Private badge */}
                {!collection.isPublic && (
                    <div className='absolute top-3 left-3 bg-text/80 text-background text-xs font-medium px-2.5 py-1 rounded-full'>
                        Private
                    </div>
                )}
            </div>

            {/* Content */}
            <div className='flex flex-col gap-2 p-4'>
                <h3 className='font-serif font-semibold text-lg text-text group-hover:text-primary transition-colors line-clamp-1'>
                    {collection.title}
                </h3>
                {collection.description && (
                    <p className='text-text/60 text-sm line-clamp-2 leading-relaxed'>
                        {collection.description}
                    </p>
                )}

                {/* Author */}
                {showAuthor && author && (
                    <div className='flex items-center gap-2 mt-1'>
                        {author.avatarUrl ? (
                            <Image
                                src={author.avatarUrl}
                                alt={author.displayName}
                                width={20}
                                height={20}
                                className='rounded-full'
                            />
                        ) : (
                            <div className='w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center'>
                                <span className='text-xs text-primary font-medium'>
                                    {author.displayName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <span className='text-xs text-text/60'>
                            by {author.displayName}
                        </span>
                    </div>
                )}

                {/* Stats */}
                <div className='flex items-center gap-4 mt-2 pt-2 border-t border-secondary/10'>
                    <div className='flex items-center gap-1.5 text-text/50'>
                        <Bookmark className='w-3.5 h-3.5' />
                        <span className='text-xs'>
                            {collection.savesCount ?? 0}
                        </span>
                    </div>
                    <div className='flex items-center gap-1.5 text-text/50'>
                        <Heart className='w-3.5 h-3.5' />
                        <span className='text-xs'>
                            {collection.likesCount ?? 0}
                        </span>
                    </div>
                    <div className='flex items-center gap-1.5 text-text/50'>
                        <Eye className='w-3.5 h-3.5' />
                        <span className='text-xs'>
                            {collection.viewsCount ?? 0}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    )
}
