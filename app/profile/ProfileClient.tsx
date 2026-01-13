"use client"

import { useAuth } from "@/components/AuthProvider"
import { useNotification } from "@/components/NotificationProvider"
import { getFullProfileData, updateProfile } from "@/app/api/actions/profile"
import { uploadAvatar } from "@/utils/storage/client"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { ProfileWithBadges, Tables } from "@/utils/types/extra"
import { motion, AnimatePresence } from "motion/react"
import {
    Award,
    Camera,
    Check,
    ChevronDown,
    Coffee,
    Compass,
    Edit2,
    Layers,
    Loader2,
    MapPin,
    Medal,
    MessageSquare,
    Settings,
    Share2,
    Shield,
    Sparkles,
    Store,
    Trophy,
    User,
    Users,
    X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import ReviewItem from "@/components/reviews/ReviewItem"
import Passport from "@/components/profile/Passport"
import VisitHistory from "@/components/profile/VisitHistory"
import { getLucideIcon } from "@/components/badges/iconUtils"
import ImageCropper from "@/components/ui/ImageCropper"
import { getUserCollections } from "@/app/api/actions/collection"
import FollowCounts from "@/components/social/FollowCounts"
import FollowListModal from "@/components/social/FollowListModal"

type BadgeDefinition = Tables<"badge_definitions">

// Scout rank display config with thresholds
const rankConfig = {
    novice: {
        label: "Novice",
        icon: User,
        color: "text-text/60",
        minPoints: 0,
        nextRank: "scout" as const,
    },
    scout: {
        label: "Scout",
        icon: Compass,
        color: "text-secondary",
        minPoints: 10,
        nextRank: "explorer" as const,
    },
    explorer: {
        label: "Explorer",
        icon: MapPin,
        color: "text-blue-500",
        minPoints: 30,
        nextRank: "expert" as const,
    },
    expert: {
        label: "Expert",
        icon: Medal,
        color: "text-primary",
        minPoints: 75,
        nextRank: "vanguard" as const,
    },
    vanguard: {
        label: "Vanguard",
        icon: Shield,
        color: "text-amber-600",
        minPoints: 150,
        nextRank: "legend" as const,
    },
    legend: {
        label: "Legend",
        icon: Trophy,
        color: "text-purple-500",
        minPoints: 300,
        nextRank: null,
    },
}

// Calculate progress to next rank
function getProgressToNextRank(
    currentPoints: number,
    currentRank: keyof typeof rankConfig
) {
    const config = rankConfig[currentRank]
    if (!config.nextRank)
        return { progress: 100, pointsNeeded: 0, nextRankLabel: null }

    const nextConfig = rankConfig[config.nextRank]
    const pointsInCurrentTier = currentPoints - config.minPoints
    const tierRange = nextConfig.minPoints - config.minPoints
    const progress = Math.min(
        100,
        Math.round((pointsInCurrentTier / tierRange) * 100)
    )
    const pointsNeeded = nextConfig.minPoints - currentPoints

    return { progress, pointsNeeded, nextRankLabel: nextConfig.label }
}

export default function ProfileClient() {
    const router = useRouter()
    const { user, refreshProfile } = useAuth()
    const { addNotification } = useNotification()

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

    // Cropper state for avatar
    const [croppingAvatar, setCroppingAvatar] = useState<File | null>(null)
    const [avatarCropperOpen, setAvatarCropperOpen] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<string | null>(null)

    // Constants for avatar processing
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB input limit (will be resized)
    const AVATAR_SIZE = 400 // Output size in pixels
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

    // Passport cafe data
    const [visitedCafes, setVisitedCafes] = useState<
        {
            name: string
            slug: string
            thumbnail: string | null
            visited_at: string | null
            visitCount?: number
        }[]
    >([])
    const [favoriteCafes, setFavoriteCafes] = useState<
        { name: string; slug: string }[]
    >([])
    const [wishlistCafes, setWishlistCafes] = useState<
        { name: string; slug: string }[]
    >([])

    // Badge display
    const [showAllBadges, setShowAllBadges] = useState(false)

    // Owned cafes (for cafe owners)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OwnedCafe type from owner actions
    const [ownedCafes, setOwnedCafes] = useState<any[]>([])

    // Rank Details Toggle
    const [showRankDetails, setShowRankDetails] = useState(false)

    // Follow counts state
    const [followersCount, setFollowersCount] = useState(0)
    const [followingCount, setFollowingCount] = useState(0)
    // Modal state
    const [isFollowModalOpen, setIsFollowModalOpen] = useState(false)
    const [followModalType, setFollowModalType] = useState<
        "followers" | "following"
    >("followers")

    // Collections
    const [collections, setCollections] = useState<
        {
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
        }[]
    >([])

    // Redirect if not authenticated
    useEffect(() => {
        if (!user && !loading) {
            router.push("/auth")
        }
    }, [user, loading, router])

    // Fetch profile data - single consolidated call
    useEffect(() => {
        const fetchData = async () => {
            if (!user) return

            try {
                // Single API call instead of 7 separate calls
                const data = await getFullProfileData(user.id)

                setProfileData(data.profile)
                setAllBadges(data.allBadges)
                setReviews(data.reviews)
                setOwnedCafes(data.ownedCafes)

                if (data.profile) {
                    setEditDisplayName(data.profile.display_name)
                    setEditBio(data.profile.bio || "")
                }

                // Set passport cafes
                setVisitedCafes(data.passportCafes.visited)
                setFavoriteCafes(data.passportCafes.favorites)
                setWishlistCafes(data.passportCafes.wishlist)
            } catch (error) {
                console.error("Error fetching profile:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [user])

    // Fetch collections separately (not part of getFullProfileData)
    useEffect(() => {
        const fetchCollections = async () => {
            if (!user) return
            try {
                const data = await getUserCollections(user.id)
                setCollections(data)
            } catch (error) {
                console.error("Error fetching collections:", error)
            }
        }
        fetchCollections()
    }, [user])

    // Handle save
    const handleSave = async () => {
        if (!user) return
        setIsSaving(true)
        try {
            const result = await updateProfile(user.id, {
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
                addNotification("Profile updated successfully", "success")
                // Refresh in background, don't block UI
                refreshProfile()
            } else {
                addNotification("Failed to update profile", "error")
            }
        } catch (error) {
            console.error("Error saving profile:", error)
            addNotification("An error occurred while saving", "error")
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

    // Handle avatar crop complete
    const handleAvatarCropComplete = async (croppedBlob: Blob) => {
        setAvatarCropperOpen(false)
        setCroppingAvatar(null)
        setIsUploadingAvatar(true)
        setUploadStatus("Processing...")

        try {
            // Resize to final avatar size
            const img = document.createElement("img")
            const objectUrl = URL.createObjectURL(croppedBlob)

            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve()
                img.onerror = () => reject(new Error("Failed to load image"))
                img.src = objectUrl
            })

            const canvas = document.createElement("canvas")
            canvas.width = AVATAR_SIZE
            canvas.height = AVATAR_SIZE
            const ctx = canvas.getContext("2d")!

            ctx.drawImage(img, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
            URL.revokeObjectURL(objectUrl)

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (b) =>
                        b
                            ? resolve(b)
                            : reject(new Error("Failed to create blob")),
                    "image/jpeg",
                    0.9
                )
            })

            setUploadStatus("Uploading...")

            const processedFile = new File([blob], "avatar.jpg", {
                type: "image/jpeg",
            })
            const result = await uploadAvatar(processedFile)

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
                refreshProfile()
            } else {
                setAvatarError(result.error || "Upload failed")
            }
        } catch (err) {
            console.error("Upload error:", err)
            setAvatarError("Failed to process image")
        } finally {
            setIsUploadingAvatar(false)
            setUploadStatus(null)
        }
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
                        {/* Hidden input for Avatar Upload */}
                        <input
                            ref={fileInputRef}
                            type='file'
                            accept='image/jpeg,image/png,image/webp,image/gif'
                            className='hidden'
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (!file) return

                                setAvatarError(null)

                                // Validate file type
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

                                // Validate file size
                                if (file.size > MAX_FILE_SIZE) {
                                    setAvatarError(
                                        "Image too large. Please use an image under 5MB"
                                    )
                                    e.target.value = ""
                                    return
                                }

                                // Open cropper
                                setCroppingAvatar(file)
                                setAvatarCropperOpen(true)
                                e.target.value = ""
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
                                    <Link
                                        href='/profile/settings'
                                        className='p-1.5 rounded-full hover:bg-text/10 transition-colors'
                                        title='Account Settings'
                                    >
                                        <Settings className='w-4 h-4' />
                                    </Link>
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

                        {/* Follow Counts and Activity Feed */}
                        <div className='flex flex-row flex-wrap gap-4 mt-3 items-center'>
                            <FollowCounts
                                userId={user.id}
                                username={profileData.username}
                                followersCount={followersCount}
                                followingCount={followingCount}
                                onCountsChange={(followers, following) => {
                                    setFollowersCount(followers)
                                    setFollowingCount(following)
                                }}
                                onFollowersClick={() => {
                                    setFollowModalType("followers")
                                    setIsFollowModalOpen(true)
                                }}
                                onFollowingClick={() => {
                                    setFollowModalType("following")
                                    setIsFollowModalOpen(true)
                                }}
                            />
                            <Link
                                href='/profile/activity'
                                className='flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors text-sm font-medium'
                            >
                                <Users className='w-4 h-4' />
                                Activity Feed
                            </Link>
                        </div>
                    </div>
                </section>

                {/* My Cafes Section - Only shown if user owns cafes */}
                {ownedCafes.length > 0 && (
                    <section className='mt-10'>
                        <div className='flex items-center gap-2 mb-4'>
                            <Store className='w-5 h-5' />
                            <h2 className='text-xl font-semibold font-serif'>
                                My Cafes
                            </h2>
                            <span className='ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full'>
                                {ownedCafes.length}
                            </span>
                        </div>

                        <div className='bg-linear-to-br from-primary/10 to-secondary/10 border border-primary/20 rounded-xl p-6'>
                            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                                {ownedCafes.slice(0, 3).map((cafe) => (
                                    <Link
                                        key={cafe.id}
                                        href={`/owner/cafes/${cafe.slug}`}
                                        className='flex items-center gap-3 p-4 bg-background rounded-lg border border-text/10 hover:border-primary/30 transition-all group'
                                    >
                                        {cafe.thumbnail ? (
                                            <div className='relative w-12 h-12 rounded-lg overflow-hidden shrink-0'>
                                                <Image
                                                    src={getCafeThumbnailUrl(
                                                        cafe.thumbnail
                                                    )}
                                                    alt={cafe.name}
                                                    fill
                                                    className='object-cover'
                                                />
                                            </div>
                                        ) : (
                                            <div className='w-12 h-12 rounded-lg bg-text/10 flex items-center justify-center shrink-0'>
                                                <Coffee className='w-5 h-5 text-text/40' />
                                            </div>
                                        )}
                                        <div className='flex-1 min-w-0'>
                                            <p className='font-semibold truncate group-hover:text-primary transition-colors'>
                                                {cafe.name}
                                            </p>
                                            <p className='text-xs text-text/50 truncate'>
                                                {cafe.address_display ||
                                                    cafe.city_municipality}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            <Link
                                href='/owner'
                                className='mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors'
                            >
                                <Store className='w-4 h-4' />
                                Go to Owner Dashboard
                            </Link>
                        </div>
                    </section>
                )}

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
                        {/* Scout Rank with Points & Progress */}
                        {(() => {
                            const currentRank = stats?.scout_rank || "novice"
                            const currentPoints = stats?.activity_points ?? 0
                            const { progress, pointsNeeded, nextRankLabel } =
                                getProgressToNextRank(
                                    currentPoints,
                                    currentRank
                                )

                            return (
                                <div className='bg-text/5 border border-text/10 rounded-xl p-4 flex flex-col items-center justify-center text-center'>
                                    <div
                                        className={`p-2 rounded-lg mb-2 ${stats?.scout_rank ? "bg-primary/10" : "bg-text/10"}`}
                                    >
                                        <RankIcon
                                            className={`w-6 h-6 ${stats?.scout_rank ? rankConfig[stats.scout_rank].color : "text-text/40"}`}
                                        />
                                    </div>
                                    <span className='text-lg font-bold capitalize'>
                                        {currentRank}
                                    </span>
                                    {/* Progress bar */}
                                    {nextRankLabel && (
                                        <div
                                            className='w-full mt-2'
                                            title={`Current points: ${currentPoints}`}
                                        >
                                            <div className='w-full h-1.5 bg-text/10 rounded-full overflow-hidden'>
                                                <div
                                                    className='h-full bg-primary rounded-full transition-all duration-500'
                                                    style={{
                                                        width: `${progress}%`,
                                                    }}
                                                />
                                            </div>
                                            <p className='text-[10px] text-text/50 mt-1'>
                                                {pointsNeeded} points to{" "}
                                                {nextRankLabel}
                                            </p>
                                        </div>
                                    )}
                                    {!nextRankLabel && (
                                        <span className='text-[10px] text-text/50 mt-1'>
                                            Max Rank!
                                        </span>
                                    )}
                                </div>
                            )
                        })()}
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

                    {/* Rank Hierarchy Toggle */}
                    <div className='mt-6 flex flex-col items-center'>
                        <button
                            onClick={() => setShowRankDetails(!showRankDetails)}
                            className='flex items-center gap-2 text-sm text-text/60 hover:text-text transition-colors cursor-pointer px-4 py-2 hover:bg-text/5 rounded-full'
                        >
                            {showRankDetails
                                ? "Hide Rank Hierarchy"
                                : "View Rank Hierarchy & Values"}
                            <ChevronDown
                                className={`w-4 h-4 transition-transform duration-300 ${showRankDetails ? "rotate-180" : ""}`}
                            />
                        </button>

                        <AnimatePresence>
                            {showRankDetails && (
                                <motion.div
                                    initial={{
                                        opacity: 0,
                                        height: 0,
                                        marginTop: 0,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        height: "auto",
                                        marginTop: 24,
                                    }}
                                    exit={{
                                        opacity: 0,
                                        height: 0,
                                        marginTop: 0,
                                    }}
                                    className='w-full overflow-hidden'
                                >
                                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                                        {(
                                            Object.entries(rankConfig) as [
                                                keyof typeof rankConfig,
                                                typeof rankConfig.novice,
                                            ][]
                                        )
                                            .sort(
                                                (a, b) =>
                                                    a[1].minPoints -
                                                    b[1].minPoints
                                            )
                                            .map(([key, config]) => {
                                                const currentRank =
                                                    stats?.scout_rank ||
                                                    "novice"
                                                const isCurrent =
                                                    key === currentRank
                                                const isUnlocked =
                                                    (stats?.activity_points ??
                                                        0) >= config.minPoints
                                                const RankIconComponent =
                                                    config.icon

                                                return (
                                                    <div
                                                        key={key}
                                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                                                            isCurrent
                                                                ? "bg-primary/5 border-primary/30"
                                                                : isUnlocked
                                                                  ? "bg-text/5 border-text/10"
                                                                  : "bg-transparent border-text/5 opacity-60"
                                                        }`}
                                                    >
                                                        <div
                                                            className={`p-3 rounded-lg ${
                                                                isCurrent
                                                                    ? "bg-primary/10"
                                                                    : isUnlocked
                                                                      ? "bg-text/10"
                                                                      : "bg-text/5"
                                                            }`}
                                                        >
                                                            <RankIconComponent
                                                                className={`w-6 h-6 ${
                                                                    isCurrent ||
                                                                    isUnlocked
                                                                        ? config.color
                                                                        : "text-text/30"
                                                                }`}
                                                            />
                                                        </div>
                                                        <div className='flex-1'>
                                                            <div className='flex items-center justify-between'>
                                                                <h3
                                                                    className={`font-bold ${isCurrent ? "text-primary" : "text-text"}`}
                                                                >
                                                                    {
                                                                        config.label
                                                                    }
                                                                </h3>
                                                                {isCurrent && (
                                                                    <span className='text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full'>
                                                                        YOU
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className='text-sm text-text/60'>
                                                                {
                                                                    config.minPoints
                                                                }{" "}
                                                                points
                                                            </p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                    <p className='text-center text-xs text-text/40 mt-6 max-w-lg mx-auto'>
                                        Earn points by visiting cafes, leaving
                                        reviews, adding photos, and suggesting
                                        new spots.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </section>

                {/* Favorite Spots - Top 5 most visited cafes */}
                {visitedCafes.some((c) => (c.visitCount ?? 0) > 1) && (
                    <section className='mt-10'>
                        <div className='flex items-center gap-2 mb-4'>
                            <Coffee className='w-5 h-5' />
                            <h2 className='text-xl font-semibold font-serif'>
                                Favorite Spots
                            </h2>
                            <span className='text-xs text-text/50'>
                                Your most visited cafes
                            </span>
                        </div>

                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3'>
                            {[...visitedCafes]
                                .sort(
                                    (a, b) =>
                                        (b.visitCount ?? 0) -
                                        (a.visitCount ?? 0)
                                )
                                .slice(0, 5)
                                .filter((c) => (c.visitCount ?? 0) > 1)
                                .map((cafe) => (
                                    <Link
                                        key={cafe.slug}
                                        href={`/cafes/${cafe.slug}`}
                                        className='group relative flex flex-col items-center p-4 bg-text/5 hover:bg-text/10 border border-text/10 rounded-xl transition-colors'
                                    >
                                        {/* Visit count badge */}
                                        <span className='absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full'>
                                            {cafe.visitCount}×
                                        </span>

                                        {/* Cafe thumbnail */}
                                        <div className='w-14 h-14 rounded-full overflow-hidden bg-text/10 mb-2'>
                                            {cafe.thumbnail ? (
                                                <Image
                                                    src={getCafeThumbnailUrl(
                                                        cafe.thumbnail
                                                    )}
                                                    alt={cafe.name}
                                                    width={56}
                                                    height={56}
                                                    className='w-full h-full object-cover'
                                                />
                                            ) : (
                                                <div className='w-full h-full flex items-center justify-center'>
                                                    <Coffee className='w-6 h-6 text-text opacity-30' />
                                                </div>
                                            )}
                                        </div>

                                        {/* Cafe name */}
                                        <span className='text-sm font-medium text-center line-clamp-2 group-hover:text-primary transition-colors'>
                                            {cafe.name}
                                        </span>
                                    </Link>
                                ))}
                        </div>
                    </section>
                )}

                {/* Visit History Section */}
                <section className='mt-10'>
                    <VisitHistory visits={visitedCafes} />
                </section>

                {/* Passport Section */}
                <section className='mt-10'>
                    <Passport
                        visited={visitedCafes.map((c) => ({
                            name: c.name,
                            slug: c.slug,
                        }))}
                        favorites={favoriteCafes}
                        wishlist={wishlistCafes}
                        isOwnProfile={true}
                    />
                </section>

                {/* Collections Section */}
                <section className='mt-10'>
                    <div className='flex items-center gap-2 mb-4'>
                        <Layers className='w-5 h-5' />
                        <h2 className='text-xl font-semibold font-serif'>
                            My Collections
                        </h2>
                        <span className='ml-auto bg-primary/15 text-primary text-sm font-bold px-2.5 py-1 rounded-full'>
                            {collections.length}
                        </span>
                    </div>

                    {collections.length > 0 ? (
                        <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                                {collections.slice(0, 3).map((collection) => (
                                    <Link
                                        key={collection.id}
                                        href={`/community/${collection.slug}`}
                                        className='flex items-center gap-3 p-4 bg-background rounded-lg border border-text/10 hover:border-primary/30 transition-all group'
                                    >
                                        {collection.coverImage ? (
                                            <div className='relative w-12 h-12 rounded-lg overflow-hidden shrink-0'>
                                                <Image
                                                    src={collection.coverImage}
                                                    alt={collection.title}
                                                    fill
                                                    className='object-cover'
                                                />
                                            </div>
                                        ) : (
                                            <div className='w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0'>
                                                <Layers className='w-5 h-5 text-primary/60' />
                                            </div>
                                        )}
                                        <div className='flex-1 min-w-0'>
                                            <p className='font-semibold truncate group-hover:text-primary transition-colors'>
                                                {collection.title}
                                            </p>
                                            <p className='text-xs text-text/50'>
                                                {collection.itemCount ?? 0}{" "}
                                                cafes
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            <Link
                                href='/profile/collections'
                                className='mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors'
                            >
                                <Layers className='w-4 h-4' />
                                Manage Collections
                            </Link>
                        </div>
                    ) : (
                        <div className='text-center py-10 bg-text/5 rounded-xl border border-text/10'>
                            <Layers className='w-12 h-12 text-text/20 mx-auto mb-3' />
                            <p className='text-text/60 font-medium mb-4'>
                                No collections yet
                            </p>
                            <Link
                                href='/profile/collections'
                                className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                            >
                                <Layers className='w-4 h-4' />
                                Create Collection
                            </Link>
                        </div>
                    )}
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
                                                    src={getCafeThumbnailUrl(
                                                        review.cafe.thumbnail
                                                    )}
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

            {profileData && (
                <FollowListModal
                    isOpen={isFollowModalOpen}
                    onClose={() => setIsFollowModalOpen(false)}
                    userId={profileData.id}
                    username={profileData.username}
                    initialType={followModalType}
                    currentUserId={user?.id}
                />
            )}

            {/* Avatar Image Cropper */}
            <ImageCropper
                open={avatarCropperOpen}
                image={croppingAvatar}
                aspect={1}
                onComplete={handleAvatarCropComplete}
                onCancel={() => {
                    setAvatarCropperOpen(false)
                    setCroppingAvatar(null)
                }}
            />
        </main>
    )
}
