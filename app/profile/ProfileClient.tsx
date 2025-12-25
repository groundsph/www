"use client"

import { AuthContext } from "@/components/AuthProvider"
import {
    getAllBadges,
    getCafesByIds,
    getProfileWithBadges,
    getUserReviews,
    updateProfile,
} from "@/app/api/actions/profile"
import { uploadAvatar } from "@/utils/supabase/storage"
import { ProfileWithBadges, Tables } from "@/utils/types/extra"
import { motion, AnimatePresence } from "motion/react"
import {
    Award,
    Camera,
    Check,
    ChevronDown,
    Coffee,
    Edit2,
    Loader2,
    Medal,
    MessageSquare,
    Share2,
    Shield,
    Sparkles,
    User,
    X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useContext, useEffect, useRef, useState } from "react"
import ReviewItem from "@/components/reviews/ReviewItem"
import Passport from "@/components/profile/Passport"
import { getLucideIcon } from "@/components/badges/iconUtils"

type BadgeDefinition = Tables<"badge_definitions">

// Scout rank display config
const rankConfig = {
    novice: { label: "Novice Scout", icon: User, color: "text-secondary" },
    expert: { label: "Expert Scout", icon: Medal, color: "text-primary" },
    vanguard: {
        label: "Vanguard Scout",
        icon: Shield,
        color: "text-amber-600",
    },
}

export default function ProfileClient() {
    const router = useRouter()
    const authContext = useContext(AuthContext)
    const { user, profile: _authProfile, refreshProfile } = authContext

    // States
    const [profileData, setProfileData] = useState<ProfileWithBadges | null>(
        null
    )
    const [allBadges, setAllBadges] = useState<BadgeDefinition[]>([])
    const [loading, setLoading] = useState(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Reviews include dynamic interaction data
    const [reviews, setReviews] = useState<any[]>([])
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Edit form states
    const [editDisplayName, setEditDisplayName] = useState("")
    const [editBio, setEditBio] = useState("")

    // Avatar upload
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const [avatarError, setAvatarError] = useState<string | null>(null)
    const [uploadStatus, setUploadStatus] = useState<string | null>(null)

    // Constants for avatar processing
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB input limit (will be resized)
    const AVATAR_SIZE = 400 // Output size in pixels
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

    // Passport cafe data
    const [visitedCafes, setVisitedCafes] = useState<
        { name: string; slug: string }[]
    >([])
    const [favoriteCafes, setFavoriteCafes] = useState<
        { name: string; slug: string }[]
    >([])
    const [wishlistCafes, setWishlistCafes] = useState<
        { name: string; slug: string }[]
    >([])

    // Badge display
    const [showAllBadges, setShowAllBadges] = useState(false)

    // Redirect if not authenticated
    useEffect(() => {
        if (!user && !loading) {
            router.push("/auth")
        }
    }, [user, loading, router])

    // Fetch profile data
    useEffect(() => {
        const fetchData = async () => {
            if (!user) return

            try {
                const [profile, badges, userReviews] = await Promise.all([
                    getProfileWithBadges(user.id),
                    getAllBadges(),
                    getUserReviews(user.id, user.id),
                ])

                setProfileData(profile)
                setAllBadges(badges)
                setReviews(userReviews)

                if (profile) {
                    setEditDisplayName(profile.display_name)
                    setEditBio(profile.bio || "")

                    // Fetch passport cafes
                    if (profile.passport) {
                        const [visited, favorites, wishlist] =
                            await Promise.all([
                                getCafesByIds(
                                    profile.passport.visited_ids || []
                                ),
                                getCafesByIds(
                                    profile.passport.favorite_ids || []
                                ),
                                getCafesByIds(
                                    profile.passport.wishlist_ids || []
                                ),
                            ])
                        setVisitedCafes(
                            visited.map((c) => ({ name: c.name, slug: c.slug }))
                        )
                        setFavoriteCafes(
                            favorites.map((c) => ({
                                name: c.name,
                                slug: c.slug,
                            }))
                        )
                        setWishlistCafes(
                            wishlist.map((c) => ({
                                name: c.name,
                                slug: c.slug,
                            }))
                        )
                    }
                }
            } catch (error) {
                console.error("Error fetching profile:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [user])

    // Handle save
    const handleSave = async () => {
        setIsSaving(true)
        try {
            const result = await updateProfile({
                display_name: editDisplayName,
                bio: editBio,
            })

            if (result.success) {
                setProfileData((prev) =>
                    prev
                        ? {
                              ...prev,
                              display_name: editDisplayName,
                              bio: editBio,
                          }
                        : null
                )
                setIsEditing(false)
                // Refresh in background, don't block UI
                refreshProfile()
            }
        } catch (error) {
            console.error("Error saving profile:", error)
        } finally {
            setIsSaving(false)
        }
    }

    // Cancel edit
    const handleCancel = () => {
        setEditDisplayName(profileData?.display_name || "")
        setEditBio(profileData?.bio || "")
        setIsEditing(false)
    }

    if (loading || !user) {
        return (
            <main className='w-full min-h-screen px-4 py-8'>
                <div className='max-w-7xl mx-auto'>
                    {/* Header skeleton */}
                    <div className='flex flex-col md:flex-row gap-6 items-center md:items-start'>
                        <div className='w-28 h-28 bg-text/10 rounded-full animate-pulse' />
                        <div className='flex-1 flex flex-col items-center md:items-start gap-3'>
                            <div className='h-8 w-48 bg-text/10 rounded-lg animate-pulse' />
                            <div className='h-5 w-32 bg-text/5 rounded-lg animate-pulse' />
                            <div className='h-4 w-64 bg-text/5 rounded-lg animate-pulse' />
                        </div>
                    </div>
                    {/* Badges skeleton */}
                    <div className='mt-10'>
                        <div className='h-6 w-40 bg-text/10 rounded-lg animate-pulse mb-4' />
                        <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4'>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className='aspect-square bg-text/5 rounded-xl animate-pulse'
                                />
                            ))}
                        </div>
                    </div>
                    {/* Stats skeleton */}
                    <div className='mt-10'>
                        <div className='h-6 w-32 bg-text/10 rounded-lg animate-pulse mb-4' />
                        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className='h-28 bg-text/5 rounded-xl animate-pulse'
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        )
    }

    if (!profileData) {
        return (
            <main className='w-full min-h-screen flex items-center justify-center px-4'>
                <div className='text-center'>
                    <p className='text-xl font-serif'>Profile not found</p>
                    <Link
                        href='/'
                        className='text-primary hover:underline mt-2 inline-block'
                    >
                        Go home
                    </Link>
                </div>
            </main>
        )
    }

    const stats = profileData.stats
    const _passport = profileData.passport // Used for conditional UI checks
    const earnedBadgeIds = new Set(profileData.badges.map((b) => b.badge_id))
    const RankIcon = stats?.scout_rank
        ? rankConfig[stats.scout_rank].icon
        : User

    return (
        <main className='w-full min-h-screen px-4 py-8'>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className='max-w-7xl mx-auto'
            >
                {/* Profile Header */}
                <section className='flex flex-col md:flex-row gap-6 items-center md:items-start'>
                    {/* Avatar */}
                    <div className='relative'>
                        <input
                            ref={fileInputRef}
                            type='file'
                            accept='image/jpeg,image/png,image/webp,image/gif'
                            className='hidden'
                            onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return

                                setAvatarError(null)

                                // Validate file type (handle cases where file.type might be empty)
                                const fileExt =
                                    file.name.split(".").pop()?.toLowerCase() ||
                                    ""
                                const isValidType =
                                    ALLOWED_TYPES.includes(file.type) ||
                                    [
                                        "jpg",
                                        "jpeg",
                                        "png",
                                        "webp",
                                        "gif",
                                    ].includes(fileExt)

                                if (!isValidType) {
                                    setAvatarError(
                                        "Please use JPEG, PNG, WebP, or GIF"
                                    )
                                    e.target.value = ""
                                    return
                                }

                                // Validate file size (generous limit since we'll resize)
                                if (file.size > MAX_FILE_SIZE) {
                                    setAvatarError(
                                        "Image too large. Please use an image under 5MB"
                                    )
                                    e.target.value = ""
                                    return
                                }

                                setIsUploadingAvatar(true)
                                setUploadStatus("Loading image...")
                                try {
                                    // Load image and resize/crop to square
                                    const img = document.createElement("img")
                                    const objectUrl = URL.createObjectURL(file)

                                    await new Promise<void>(
                                        (resolve, reject) => {
                                            img.onload = () => resolve()
                                            img.onerror = () =>
                                                reject(
                                                    new Error(
                                                        "Failed to load image"
                                                    )
                                                )
                                            img.src = objectUrl
                                        }
                                    )

                                    setUploadStatus("Cropping & resizing...")

                                    // Create canvas and crop to center square
                                    const canvas =
                                        document.createElement("canvas")
                                    canvas.width = AVATAR_SIZE
                                    canvas.height = AVATAR_SIZE
                                    const ctx = canvas.getContext("2d")!

                                    // Calculate crop dimensions (center crop to square)
                                    const size = Math.min(img.width, img.height)
                                    const x = (img.width - size) / 2
                                    const y = (img.height - size) / 2

                                    // Draw cropped and resized image
                                    ctx.drawImage(
                                        img,
                                        x,
                                        y,
                                        size,
                                        size,
                                        0,
                                        0,
                                        AVATAR_SIZE,
                                        AVATAR_SIZE
                                    )
                                    URL.revokeObjectURL(objectUrl)

                                    // Convert to blob
                                    const blob = await new Promise<Blob>(
                                        (resolve, reject) => {
                                            canvas.toBlob(
                                                (b) =>
                                                    b
                                                        ? resolve(b)
                                                        : reject(
                                                              new Error(
                                                                  "Failed to create blob"
                                                              )
                                                          ),
                                                "image/jpeg",
                                                0.9
                                            )
                                        }
                                    )

                                    setUploadStatus("Uploading...")

                                    // Upload processed image
                                    const formData = new FormData()
                                    formData.append(
                                        "avatar",
                                        blob,
                                        "avatar.jpg"
                                    )
                                    const result = await uploadAvatar(formData)

                                    if (result.success && result.url) {
                                        setUploadStatus("Done!")
                                        setProfileData((prev) =>
                                            prev
                                                ? {
                                                      ...prev,
                                                      avatar_url: result.url!,
                                                  }
                                                : null
                                        )
                                        // Refresh in background, don't block UI
                                        refreshProfile()
                                    } else {
                                        setAvatarError(
                                            result.error || "Upload failed"
                                        )
                                    }
                                } catch (err) {
                                    console.error("Upload error:", err)
                                    setAvatarError("Failed to process image")
                                } finally {
                                    setIsUploadingAvatar(false)
                                    setUploadStatus(null)
                                    e.target.value = ""
                                }
                            }}
                        />
                        <div
                            onClick={() =>
                                isEditing && fileInputRef.current?.click()
                            }
                            className={`w-28 h-28 rounded-full bg-linear-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden border-4 border-background relative group ${isEditing ? "cursor-pointer" : ""}`}
                        >
                            {profileData.avatar_url ? (
                                <Image
                                    src={profileData.avatar_url}
                                    alt={profileData.display_name}
                                    fill
                                    className='object-cover'
                                />
                            ) : (
                                <User className='w-12 h-12 text-text/40' />
                            )}
                            {/* Upload overlay */}
                            {isEditing && (
                                <div className='absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full'>
                                    {isUploadingAvatar ? (
                                        <Loader2 className='w-8 h-8 text-white animate-spin' />
                                    ) : (
                                        <Camera className='w-8 h-8 text-white' />
                                    )}
                                </div>
                            )}
                            {/* Loading overlay when uploading */}
                            {isUploadingAvatar && (
                                <div className='absolute inset-0 bg-black/50 flex items-center justify-center rounded-full'>
                                    <Loader2 className='w-8 h-8 text-white animate-spin' />
                                </div>
                            )}
                        </div>
                        {profileData.is_supporter && (
                            <div
                                className='absolute -bottom-1 -right-1 bg-amber-500 text-white p-1.5 rounded-full shadow-lg'
                                title='Supporter'
                            >
                                <Sparkles className='w-4 h-4' />
                            </div>
                        )}
                        {/* Avatar error message */}
                        {avatarError && (
                            <p className='absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-red-500 whitespace-nowrap'>
                                {avatarError}
                            </p>
                        )}
                        {/* Upload status message */}
                        {uploadStatus && !avatarError && (
                            <p className='absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-primary font-medium whitespace-nowrap'>
                                {uploadStatus}
                            </p>
                        )}
                        {/* Edit hint */}
                        {isEditing && !avatarError && !uploadStatus && (
                            <p className='absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-text/50 whitespace-nowrap'>
                                Click to change
                            </p>
                        )}
                    </div>

                    {/* Info */}
                    <div className='flex-1 flex flex-col items-center md:items-start gap-1'>
                        <div className='flex flex-row items-center gap-3'>
                            {isEditing ? (
                                <input
                                    type='text'
                                    value={editDisplayName}
                                    onChange={(e) =>
                                        setEditDisplayName(e.target.value)
                                    }
                                    className='text-2xl md:text-3xl font-bold font-serif bg-transparent border-b-2 border-primary focus:outline-none px-1'
                                    placeholder='Display Name'
                                />
                            ) : (
                                <h1 className='text-2xl md:text-3xl font-bold font-serif'>
                                    {profileData.display_name}
                                </h1>
                            )}
                            {!isEditing && (
                                <>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className='p-1.5 rounded-full hover:bg-text/10 transition-colors cursor-pointer'
                                        title='Edit Profile'
                                    >
                                        <Edit2 className='w-4 h-4' />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const profileUrl = `${window.location.origin}/profile/${profileData.username}`
                                            if (navigator.share) {
                                                try {
                                                    await navigator.share({
                                                        title: `${profileData.display_name}'s Coffee Profile`,
                                                        text: `Check out ${profileData.display_name}'s coffee journey!`,
                                                        url: profileUrl,
                                                    })
                                                } catch {
                                                    // User cancelled or error
                                                }
                                            } else {
                                                await navigator.clipboard.writeText(
                                                    profileUrl
                                                )
                                                alert(
                                                    "Profile link copied to clipboard!"
                                                )
                                            }
                                        }}
                                        className='p-1.5 rounded-full hover:bg-text/10 transition-colors cursor-pointer'
                                        title='Share Profile'
                                    >
                                        <Share2 className='w-4 h-4' />
                                    </button>
                                </>
                            )}
                        </div>
                        <p className='text-text/60 font-medium'>
                            @{profileData.username}
                        </p>

                        {/* Bio */}
                        {isEditing ? (
                            <textarea
                                value={editBio}
                                onChange={(e) => setEditBio(e.target.value)}
                                className='w-full mt-2 p-2 bg-text/5 border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none'
                                placeholder='Write something about yourself...'
                                rows={3}
                            />
                        ) : (
                            <p className='text-text/80 mt-2 text-center md:text-left max-w-md'>
                                {profileData.bio || "No bio yet"}
                            </p>
                        )}

                        {/* Edit Actions */}
                        <AnimatePresence>
                            {isEditing && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className='flex flex-row gap-2 mt-3'
                                >
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className='flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer'
                                    >
                                        <Check className='w-4 h-4' />
                                        {isSaving ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        disabled={isSaving}
                                        className='flex items-center gap-1.5 px-4 py-2 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition-colors cursor-pointer'
                                    >
                                        <X className='w-4 h-4' />
                                        Cancel
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Member Info */}
                        <div className='flex flex-row flex-wrap gap-3 mt-3 text-sm text-text/60'>
                            {profileData.is_supporter &&
                                profileData.support_since && (
                                    <span className='flex items-center gap-1 text-amber-600 font-medium'>
                                        <Sparkles className='w-3.5 h-3.5' />
                                        Supporter since{" "}
                                        {new Date(
                                            profileData.support_since
                                        ).toLocaleDateString("en-US", {
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </span>
                                )}
                            {profileData.created_at && (
                                <span>
                                    Member since{" "}
                                    {new Date(
                                        profileData.created_at
                                    ).toLocaleDateString("en-US", {
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </span>
                            )}
                        </div>
                    </div>
                </section>

                {/* Badges Collection - Passport Style */}
                <section className='mt-10'>
                    <div className='flex items-center gap-2 mb-4'>
                        <Medal className='w-5 h-5' />
                        <h2 className='text-xl font-semibold font-serif'>
                            Badge Collection
                        </h2>
                        <span className='ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full'>
                            {profileData.badges.length}/{allBadges.length}
                        </span>
                    </div>

                    {/* Showcase Container */}
                    <div className='bg-text/5 border border-text/10 rounded-xl min-h-max relative p-6'>
                        {/* Background Texture */}
                        <div
                            className='absolute inset-0 opacity-[0.03] pointer-events-none rounded-xl'
                            style={{
                                backgroundImage: `radial-gradient(circle at 2px 2px, black 1px, transparent 0)`,
                                backgroundSize: "24px 24px",
                            }}
                        />

                        {(() => {
                            // Sort badges: earned first, then by rarity (legendary > rare > common)
                            const rarityOrder = {
                                legendary: 0,
                                rare: 1,
                                common: 2,
                            }
                            const sortedBadges = [...allBadges].sort((a, b) => {
                                const aEarned = earnedBadgeIds.has(a.id)
                                const bEarned = earnedBadgeIds.has(b.id)
                                if (aEarned !== bEarned) return aEarned ? -1 : 1
                                return (
                                    rarityOrder[a.rarity] -
                                    rarityOrder[b.rarity]
                                )
                            })

                            const earnedBadges = sortedBadges.filter((b) =>
                                earnedBadgeIds.has(b.id)
                            )
                            const unearnedBadges = sortedBadges.filter(
                                (b) => !earnedBadgeIds.has(b.id)
                            )
                            const displayBadges = showAllBadges
                                ? sortedBadges
                                : earnedBadges

                            const rarityStyles = {
                                common: "border-2 border-text/30",
                                rare: "border-2 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]",
                                legendary:
                                    "border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]",
                            }

                            if (earnedBadges.length === 0 && !showAllBadges) {
                                return (
                                    <div className='flex flex-col items-center justify-center py-12 text-center opacity-60'>
                                        <Award className='w-16 h-16 text-text/20 mb-4' />
                                        <p className='text-lg font-medium'>
                                            No badges yet
                                        </p>
                                        <p className='text-sm text-text/60 max-w-xs'>
                                            Earn badges by exploring cafes and
                                            engaging with the community!
                                        </p>
                                        {unearnedBadges.length > 0 && (
                                            <button
                                                onClick={() =>
                                                    setShowAllBadges(true)
                                                }
                                                className='mt-4 text-sm text-primary hover:underline cursor-pointer'
                                            >
                                                View all {allBadges.length}{" "}
                                                badges
                                            </button>
                                        )}
                                    </div>
                                )
                            }

                            return (
                                <>
                                    <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6'>
                                        <AnimatePresence mode='popLayout'>
                                            {displayBadges.map((badge) => {
                                                const isEarned =
                                                    earnedBadgeIds.has(badge.id)

                                                return (
                                                    <motion.div
                                                        key={badge.id}
                                                        layout
                                                        initial={{
                                                            opacity: 0,
                                                            scale: 0.8,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            scale: 1,
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            scale: 0.8,
                                                        }}
                                                        whileHover={{
                                                            scale: isEarned
                                                                ? 1.1
                                                                : 1.02,
                                                        }}
                                                        className='group relative flex flex-col items-center cursor-default'
                                                    >
                                                        {/* Badge Circle */}
                                                        <div
                                                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center bg-background transition-all ${
                                                                isEarned
                                                                    ? rarityStyles[
                                                                          badge
                                                                              .rarity
                                                                      ]
                                                                    : "border-2 border-dashed border-text/20 opacity-40 grayscale"
                                                            }`}
                                                        >
                                                            {(() => {
                                                                // Check for icon in metadata
                                                                const metadata =
                                                                    badge.metadata as {
                                                                        icon_name?: string
                                                                        icon_color?: string
                                                                    } | null
                                                                const iconName =
                                                                    metadata?.icon_name
                                                                const iconColor =
                                                                    metadata?.icon_color ||
                                                                    "#8B4513"
                                                                const IconComponent =
                                                                    iconName
                                                                        ? getLucideIcon(
                                                                              iconName
                                                                          )
                                                                        : null

                                                                if (
                                                                    IconComponent
                                                                ) {
                                                                    return (
                                                                        <IconComponent
                                                                            style={{
                                                                                color: iconColor,
                                                                            }}
                                                                            className='w-7 h-7'
                                                                        />
                                                                    )
                                                                } else if (
                                                                    badge.image_url
                                                                ) {
                                                                    return (
                                                                        <Image
                                                                            src={
                                                                                badge.image_url
                                                                            }
                                                                            alt={
                                                                                badge.name
                                                                            }
                                                                            width={
                                                                                48
                                                                            }
                                                                            height={
                                                                                48
                                                                            }
                                                                            className='object-contain'
                                                                            unoptimized
                                                                        />
                                                                    )
                                                                } else {
                                                                    return (
                                                                        <Award
                                                                            className={`w-7 h-7 ${isEarned ? "text-primary" : "text-text/20"}`}
                                                                        />
                                                                    )
                                                                }
                                                            })()}
                                                        </div>

                                                        {/* Badge Name */}
                                                        <span
                                                            className={`text-[11px] font-semibold mt-2 text-center line-clamp-2 leading-tight max-w-[70px] ${
                                                                isEarned
                                                                    ? "text-text"
                                                                    : "text-text/40"
                                                            }`}
                                                        >
                                                            {badge.name}
                                                        </span>

                                                        {/* Hover Tooltip */}
                                                        <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10'>
                                                            <div className='bg-text text-background text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-[200px]'>
                                                                {/* Rarity */}
                                                                <div
                                                                    className={`text-[10px] font-bold uppercase tracking-wide ${
                                                                        badge.rarity ===
                                                                        "legendary"
                                                                            ? "text-amber-300"
                                                                            : badge.rarity ===
                                                                                "rare"
                                                                              ? "text-blue-300"
                                                                              : "text-background/70"
                                                                    }`}
                                                                >
                                                                    {
                                                                        badge.rarity
                                                                    }
                                                                </div>
                                                                {/* Description */}
                                                                <div className='text-background/80 text-[10px] mt-1 whitespace-normal'>
                                                                    {
                                                                        badge.description
                                                                    }
                                                                </div>
                                                                {/* Earned at (for earned badges) */}
                                                                {isEarned &&
                                                                    (() => {
                                                                        const earnedBadge =
                                                                            profileData.badges.find(
                                                                                (
                                                                                    b
                                                                                ) =>
                                                                                    b.badge_id ===
                                                                                    badge.id
                                                                            )
                                                                        if (
                                                                            earnedBadge?.awarded_at
                                                                        ) {
                                                                            return (
                                                                                <div className='text-background/50 text-[10px] mt-1'>
                                                                                    Earned:{" "}
                                                                                    {new Date(
                                                                                        earnedBadge.awarded_at
                                                                                    ).toLocaleDateString(
                                                                                        "en-US",
                                                                                        {
                                                                                            month: "short",
                                                                                            day: "numeric",
                                                                                            year: "numeric",
                                                                                        }
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        }
                                                                        return null
                                                                    })()}
                                                                {!isEarned && (
                                                                    <div className='text-background/40 text-[10px] mt-1 italic'>
                                                                        Not
                                                                        earned
                                                                        yet
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className='w-2 h-2 bg-text rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1' />
                                                        </div>
                                                    </motion.div>
                                                )
                                            })}
                                        </AnimatePresence>
                                    </div>

                                    {/* Toggle button */}
                                    {unearnedBadges.length > 0 && (
                                        <button
                                            onClick={() =>
                                                setShowAllBadges(!showAllBadges)
                                            }
                                            className='mt-6 flex items-center gap-1 mx-auto text-sm text-text/60 hover:text-text transition-colors cursor-pointer'
                                        >
                                            {showAllBadges ? (
                                                <>Hide unearned</>
                                            ) : (
                                                <>
                                                    Show all {allBadges.length}{" "}
                                                    badges
                                                </>
                                            )}
                                            <ChevronDown
                                                className={`w-4 h-4 transition-transform ${showAllBadges ? "rotate-180" : ""}`}
                                            />
                                        </button>
                                    )}
                                </>
                            )
                        })()}
                    </div>
                </section>

                {/* Stats Grid - Cleaned up icons */}
                <section className='mt-10'>
                    <h2 className='text-xl font-semibold font-serif mb-4 flex items-center gap-2'>
                        <Award className='w-5 h-5' />
                        Your Stats
                    </h2>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                        {/* Scout Rank */}
                        <div className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center'>
                            <div
                                className={`p-2 rounded-lg mb-2 ${stats?.scout_rank ? "bg-primary/10" : "bg-text/10"}`}
                            >
                                <RankIcon
                                    className={`w-6 h-6 ${stats?.scout_rank ? rankConfig[stats.scout_rank].color : "text-text/40"}`}
                                />
                            </div>
                            <span className='text-lg font-bold capitalize'>
                                {stats?.scout_rank || "Novice"}
                            </span>
                            <span className='text-xs text-text/60'>
                                Scout Rank
                            </span>
                        </div>
                        {/* Reviews - Clickable */}
                        <a
                            href='#reviews'
                            className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-text/20 transition-colors cursor-pointer'
                        >
                            <div className='p-2 bg-primary/10 rounded-lg mb-2'>
                                <MessageSquare className='w-6 h-6 text-primary' />
                            </div>
                            <span className='text-2xl font-bold'>
                                {stats?.total_reviews ?? 0}
                            </span>
                            <span className='text-xs text-text/60'>
                                Reviews
                            </span>
                        </a>
                        {/* Photos */}
                        <div className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center'>
                            <div className='p-2 bg-secondary/10 rounded-lg mb-2'>
                                <Camera className='w-6 h-6 text-secondary' />
                            </div>
                            <span className='text-2xl font-bold'>
                                {stats?.total_photos ?? 0}
                            </span>
                            <span className='text-xs text-text/60'>Photos</span>
                        </div>
                        {/* Scouted */}
                        <div className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center'>
                            <div className='p-2 bg-text/10 rounded-lg mb-2'>
                                <Coffee className='w-6 h-6 text-text/70' />
                            </div>
                            <span className='text-2xl font-bold'>
                                {stats?.total_scouted ?? 0}
                            </span>
                            <span className='text-xs text-text/60'>
                                Scouted
                            </span>
                        </div>
                    </div>
                </section>

                {/* Passport Section */}
                <section className='mt-10'>
                    <Passport
                        visited={visitedCafes}
                        favorites={favoriteCafes}
                        wishlist={wishlistCafes}
                        isOwnProfile={true}
                    />
                </section>

                <section
                    id='reviews'
                    className='mt-10'
                >
                    <h2 className='text-xl font-semibold font-serif mb-4 flex items-center gap-2'>
                        {reviews.length > 0 ? (
                            <>
                                <MessageSquare className='w-5 h-5' />
                                Reviews
                                <span className='text-sm font-normal text-text/60'>
                                    ({reviews.length})
                                </span>
                            </>
                        ) : (
                            "Reviews"
                        )}
                    </h2>

                    {reviews.length > 0 ? (
                        <div className='flex flex-col gap-6'>
                            {reviews.map((review) => (
                                <div
                                    key={review.id}
                                    className='bg-text/5 border border-text/10 rounded-xl p-5 flex flex-col gap-4'
                                >
                                    {/* Cafe info line - Added Link and visual context */}
                                    <div className='flex items-center gap-2 pb-4 border-b border-text/10'>
                                        <div className='relative w-10 h-10 rounded-lg overflow-hidden shrink-0'>
                                            {review.cafe?.thumbnail ? (
                                                <Image
                                                    src={review.cafe.thumbnail}
                                                    alt={review.cafe.name}
                                                    fill
                                                    className='object-cover'
                                                />
                                            ) : (
                                                <div className='w-full h-full bg-secondary/20 flex items-center justify-center'>
                                                    <Coffee className='w-5 h-5 text-secondary' />
                                                </div>
                                            )}
                                        </div>
                                        <div className='flex flex-col'>
                                            <span className='text-xs text-text/60'>
                                                Review for
                                            </span>
                                            <Link
                                                href={`/cafes/${review.cafe.slug}`}
                                                className='font-bold text-lg hover:text-primary transition-colors leading-tight'
                                            >
                                                {review.cafe.name}
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Use ReviewItem for the actual content */}
                                    {/* We need to reconstruct the author object since ReviewItem expects it */}
                                    <ReviewItem
                                        review={{
                                            ...review,
                                            author: {
                                                display_name:
                                                    profileData.display_name,
                                                username: profileData.username,
                                                avatar_url:
                                                    profileData.avatar_url,
                                            },
                                            // Handle is_liked from our fetch
                                            review_interactions: review.is_liked
                                                ? [{ user_id: user.id }]
                                                : [],
                                        }}
                                        currentUser={user}
                                        // On profile page, we might restrict editing? Or allow it?
                                        // Since it's the "Manage Profile" page, editing seems appropriate.
                                        // However, providing the `onEdit` handler requires the Modal state which is currently not fully set up here.
                                        // For now, let's keep it read-only-ish or just delete.
                                        // ReviewItem handles delete internally if currentUser matches.
                                        // Edit requires a modal parent.
                                        // Let's omit `onEdit` for now to simplify, or if needed, we can add it later.
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className='text-center py-10 bg-text/5 rounded-xl border border-text/10'>
                            <p className='text-text/60 font-medium'>
                                You haven&apos;t written any reviews yet.
                            </p>
                        </div>
                    )}
                </section>
            </motion.div>
        </main>
    )
}
