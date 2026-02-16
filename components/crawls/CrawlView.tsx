"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import {
    ArrowLeft,
    Coffee,
    Eye,
    Calendar,
    User,
    MapPin,
    Star,
    Pencil,
} from "lucide-react"
import CrawlRouteMap from "@/components/map/CrawlRouteMap"
import CrawlActions from "@/components/crawls/CrawlActions"
import { getCafeThumbnailUrl } from "@/utils/extras"

const staggerContainer = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.1,
        },
    },
}

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 },
}

interface CafeItem {
    id: string
    cafeId: string
    name: string
    slug: string
    thumbnail: string | null
    cityMunicipality: string
    region: string
    averageRating: number | null
    totalReviews: number | null
    sortOrder: number
    note: string | null
    lat?: number | null
    lng?: number | null
}

interface CrawlViewProps {
    crawl: {
        id: string
        title: string
        slug: string
        description: string | null
        coverImage: string | null
        itemCount: number
        viewsCount: number
        savesCount: number
        likesCount: number
        createdAt: string
        updatedAt?: string
        status?: string
        isPublic?: boolean
        author: {
            id: string
            username: string
            displayName: string
            avatarUrl: string | null
        }
        cafes: CafeItem[]
        hasSaved?: boolean
        hasLiked?: boolean
        isOwner?: boolean
    }
}

export default function CrawlView({ crawl }: CrawlViewProps) {
    const validCafes = crawl.cafes.filter(
        (c): c is CafeItem & { lat: number; lng: number } =>
            c != null && c.lat != null && c.lng != null
    )

    const mapPoints = validCafes
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((cafe, index) => ({
            lat: cafe.lat,
            lng: cafe.lng,
            imageUrl: cafe.thumbnail ? getCafeThumbnailUrl(cafe.thumbnail) : null,
            label: cafe.name,
            index: index + 1,
            cafeSlug: cafe.slug,
        }))

    return (
        <>
            {/* Cover Image Section */}
            {crawl.coverImage && (
                <div className="relative w-full aspect-21/9 md:aspect-3/1 bg-text/5">
                    <Image
                        src={crawl.coverImage}
                        alt={crawl.title}
                        fill
                        priority
                        className="object-cover"
                    />
                </div>
            )}

            <motion.article
                className="max-w-6xl px-4 py-8 md:py-12 w-full"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                {/* Back Link */}
                <motion.div variants={fadeInUp}>
                    <Link
                        href="/community"
                        className="inline-flex items-center gap-2 text-text/60 hover:text-primary transition-colors mb-8"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Back to Community</span>
                    </Link>
                </motion.div>

                {/* Header */}
                <motion.header variants={fadeInUp} className="mb-8">
                    {/* Title */}
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-serif text-text mb-4 leading-tight">
                        {crawl.title}
                    </h1>

                    {/* Description */}
                    {crawl.description && (
                        <p className="text-lg text-text/70 leading-relaxed mb-6">
                            {crawl.description}
                        </p>
                    )}

                    {/* Author & Meta */}
                    <div className="flex items-center justify-between flex-wrap gap-4 py-4 border-y border-text/10">
                        <div className="flex items-center gap-4">
                            <Link
                                href={`/profile/${crawl.author.username}`}
                                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                            >
                                {crawl.author.avatarUrl ? (
                                    <Image
                                        src={crawl.author.avatarUrl}
                                        alt={crawl.author.displayName}
                                        width={44}
                                        height={44}
                                        className="rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="w-5 h-5 text-primary" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium text-text">
                                        {crawl.author.displayName}
                                    </p>
                                    <p className="text-sm text-text/50">
                                        @{crawl.author.username}
                                    </p>
                                </div>
                            </Link>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-text/50">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span>
                                    {new Date(crawl.createdAt).toLocaleDateString(
                                        "en-US",
                                        {
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                        }
                                    )}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Eye className="w-4 h-4" />
                                <span>{crawl.viewsCount || 0} views</span>
                            </div>

                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4">
                        {crawl.isOwner && (
                            <Link
                                href={`/community/crawls/${crawl.slug}/edit`}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text/70 hover:text-text border border-secondary/30 rounded-full hover:bg-secondary/10 transition-colors"
                            >
                                <Pencil className="w-4 h-4" />
                                Edit
                            </Link>
                        )}

                        <CrawlActions
                            crawlId={crawl.id}
                            slug={crawl.slug}
                            saved={crawl.hasSaved ?? false}
                            savesCount={crawl.savesCount ?? 0}
                            liked={crawl.hasLiked ?? false}
                            likesCount={crawl.likesCount ?? 0}
                            isOwner={crawl.isOwner ?? false}
                        />
                    </div>
                </motion.header>

                {/* Map Section */}
                <motion.section variants={fadeInUp} className="mb-12">
                    <div className="rounded-2xl overflow-hidden border border-secondary/20 shadow-sm">
                        <div className="h-[420px] w-full">
                        <CrawlRouteMap
                            points={mapPoints}
                            showUserLocation={true}
                            revealSequence={true}
                            timelineDelayMs={1000}
                        />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-sm text-text/60">
                        <MapPin className="w-4 h-4" />
                        <span>{crawl.itemCount || 0} cafes in this route</span>
                    </div>
                </motion.section>

                {/* Cafes List */}
                <motion.section variants={fadeInUp}>
                    <h2 className="text-2xl font-bold font-serif text-text mb-6">
                        Cafes on this Route
                    </h2>

                    {crawl.cafes.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-16"
                        >
                            <Coffee className="w-16 h-16 text-secondary opacity-40 mx-auto mb-4" />
                            <h3 className="text-xl font-serif font-semibold text-text mb-2">
                                No cafes yet
                            </h3>
                            <p className="text-text/60">
                                This crawl is empty.
                            </p>
                        </motion.div>
                    ) : (
                        <div className="space-y-4">
                            {crawl.cafes
                                .sort((a, b) => a.sortOrder - b.sortOrder)
                                .map((cafe, index) => (
                                    <motion.div
                                        key={cafe.id}
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            opacity: { duration: 0.2 },
                                            x: { duration: 0.3 },
                                            layout: { duration: 0.2 },
                                        }}
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Link
                                            href={`/cafes/${cafe.slug}`}
                                            className="flex gap-4 p-4 bg-background border border-secondary/20 hover:border-secondary/40 rounded-xl transition-all group shadow-sm hover:shadow-md"
                                        >
                                        {/* Index */}
                                        <div className="hidden md:flex shrink-0 w-8 h-8 rounded-full bg-secondary/10 items-center justify-center">
                                            <span className="text-sm font-medium text-text/50">
                                                {index + 1}
                                            </span>
                                        </div>

                                        {/* Thumbnail */}
                                        <div className="relative w-20 h-20 md:w-28 md:h-28 shrink-0 rounded-lg overflow-hidden bg-secondary/10">
                                            {cafe.thumbnail ? (
                                                <Image
                                                    src={getCafeThumbnailUrl(
                                                        cafe.thumbnail
                                                    )}
                                                    alt={cafe.name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="80px"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Coffee className="w-6 h-6 md:w-8 md:h-8 text-secondary opacity-40" />
                                                </div>
                                            )}

                                            {/* Mobile Index Overlay */}
                                            <div className="md:hidden absolute top-1 left-1 w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-xs">
                                                <span className="text-[10px] font-bold text-text">
                                                    {index + 1}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <h3 className="font-serif font-semibold text-base md:text-lg text-text group-hover:text-primary transition-colors line-clamp-1">
                                                {cafe.name}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-text/60 text-xs md:text-sm mt-1">
                                                <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                                                <span className="line-clamp-1">
                                                    {cafe.cityMunicipality}
                                                </span>
                                            </div>
                                            {cafe.averageRating && (
                                                <div className="flex items-center gap-1 mt-2">
                                                    <Star className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500 fill-amber-500" />
                                                    <span className="text-xs md:text-sm font-medium text-text">
                                                        {cafe.averageRating.toFixed(
                                                            1
                                                        )}
                                                    </span>
                                                    {cafe.totalReviews && (
                                                        <span className="text-xs md:text-sm text-text/50">
                                                            ({cafe.totalReviews})
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {cafe.note && (
                                                <p className="text-xs md:text-sm text-text/60 mt-2 italic line-clamp-2">
                                                    &quot;{cafe.note}&quot;
                                                </p>
                                            )}
                                        </div>
                                    </Link>
                                    </motion.div>
                                ))}
                        </div>
                    )}
                </motion.section>
            </motion.article>
        </>
    )
}
