"use client"

import { useState } from "react"
import Image from "next/image"
import {
    Award,
    Plus,
    Trash2,
    Loader2,
    RefreshCw,
    Users,
    Settings,
    Upload,
} from "lucide-react"
import {
    type BadgeDefinition,
    createBadgeDefinition,
    updateBadgeDefinition,
    deleteBadgeDefinition,
    awardBadgeToUser,
    revokeBadgeFromUser,
    searchUsersForBadge,
    getUsersWithBadge,
    awardBadgeToAllUsers,
    adminCleanupOrphanedImages,
    adminProcessAvatarQueue,
} from "@/app/api/actions/admin"
import { uploadBadgeImage } from "@/utils/supabase/storage"
import { BadgeCardFull } from "@/components/badges/BadgeCard"
import IconPicker from "@/components/badges/IconPicker"
import { backfillBadgesForAllUsers } from "@/utils/badges/badge-logic"

interface SystemManagementProps {
    badges: BadgeDefinition[]
}

const resizeBadgeImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = document.createElement("img")
        img.src = URL.createObjectURL(file)
        img.onload = () => {
            if (img.width === 512 && img.height === 512) {
                resolve(file)
                return
            }
            const canvas = document.createElement("canvas")
            canvas.width = 512
            canvas.height = 512
            const ctx = canvas.getContext("2d")
            if (!ctx) {
                reject(new Error("Canvas context not available"))
                return
            }
            ctx.drawImage(img, 0, 0, 512, 512)
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(new File([blob], file.name, { type: "image/png" }))
                } else {
                    reject(new Error("Failed to create blob"))
                }
            }, "image/png")
        }
        img.onerror = () => reject(new Error("Failed to load image"))
    })
}

type TabType = "badges" | "maintenance"

export default function SystemManagement({
    badges: initialBadges,
}: SystemManagementProps) {
    const [activeTab, setActiveTab] = useState<TabType>("badges")
    const [badges, setBadges] = useState(initialBadges)
    const [processing, setProcessing] = useState<string | null>(null)

    // Badge modal state
    const [showBadgeModal, setShowBadgeModal] = useState(false)
    const [editingBadge, setEditingBadge] = useState<BadgeDefinition | null>(
        null
    )
    const [badgeForm, setBadgeForm] = useState<{
        name: string
        description: string
        image_url: string
        category: "achievement" | "monetary" | "social"
        rarity: "common" | "rare" | "legendary"
    }>({
        name: "",
        description: "",
        image_url: "",
        category: "achievement",
        rarity: "common",
    })
    const [badgeImageFile, setBadgeImageFile] = useState<File | null>(null)
    const [badgeImagePreview, setBadgeImagePreview] = useState<string | null>(
        null
    )
    const [badgeLoading, setBadgeLoading] = useState(false)
    const [useIconMode, setUseIconMode] = useState(false)
    const [selectedIconName, setSelectedIconName] = useState<string | null>(
        null
    )
    const [selectedIconColor, setSelectedIconColor] = useState("#8B4513")
    const [badgeError, setBadgeError] = useState<string | null>(null)

    // Badge awarding state
    const [showAwardModal, setShowAwardModal] = useState(false)
    const [awardingBadge, setAwardingBadge] = useState<BadgeDefinition | null>(
        null
    )
    const [userSearchQuery, setUserSearchQuery] = useState("")
    const [userSearchResults, setUserSearchResults] = useState<
        {
            id: string
            username: string
            display_name: string
            avatar_url: string | null
        }[]
    >([])
    const [usersWithBadge, setUsersWithBadge] = useState<
        {
            user_id: string
            username: string
            display_name: string
            avatar_url: string | null
            awarded_at: string | null
        }[]
    >([])
    const [badgeUsersTotal, setBadgeUsersTotal] = useState(0)
    const [badgeUsersHasMore, setBadgeUsersHasMore] = useState(false)
    const [awardLoading, setAwardLoading] = useState(false)
    const [searchLoading, setSearchLoading] = useState(false)
    const [isAwardingAll, setIsAwardingAll] = useState(false)

    // Maintenance state
    const [cleanupLoading, setCleanupLoading] = useState(false)
    const [cleanupMessage, setCleanupMessage] = useState<string | null>(null)

    // Badge handlers
    const openBadgeModal = (badge?: BadgeDefinition) => {
        if (badge) {
            setEditingBadge(badge)
            setBadgeForm({
                name: badge.name,
                description: badge.description,
                image_url: badge.image_url,
                category: badge.category,
                rarity: badge.rarity,
            })
            const metadata = badge.metadata as {
                icon_name?: string
                icon_color?: string
            } | null
            if (metadata?.icon_name) {
                setUseIconMode(true)
                setSelectedIconName(metadata.icon_name)
                setSelectedIconColor(metadata.icon_color || "#8B4513")
                setBadgeImagePreview(null)
            } else {
                setUseIconMode(false)
                setSelectedIconName(null)
                setSelectedIconColor("#8B4513")
                setBadgeImagePreview(badge.image_url)
            }
        } else {
            setEditingBadge(null)
            setBadgeForm({
                name: "",
                description: "",
                image_url: "",
                category: "achievement",
                rarity: "common",
            })
            setUseIconMode(false)
            setSelectedIconName(null)
            setSelectedIconColor("#8B4513")
            setBadgeImagePreview(null)
        }
        setBadgeImageFile(null)
        setBadgeError(null)
        setShowBadgeModal(true)
    }

    const closeBadgeModal = () => {
        setShowBadgeModal(false)
        setEditingBadge(null)
        setBadgeImageFile(null)
        setBadgeImagePreview(null)
        setBadgeError(null)
        setUseIconMode(false)
        setSelectedIconName(null)
        setSelectedIconColor("#8B4513")
    }

    const handleBadgeImageChange = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.type !== "image/png") {
            setBadgeError("Badge images must be PNG format")
            return
        }
        try {
            setBadgeLoading(true)
            const processedFile = await resizeBadgeImage(file)
            if (processedFile.size > 500 * 1024) {
                setBadgeError("File too large after processing (max 500KB)")
                setBadgeLoading(false)
                return
            }
            setBadgeImageFile(processedFile)
            setBadgeError(null)
            const reader = new FileReader()
            reader.onload = (e) => {
                setBadgeImagePreview(e.target?.result as string)
            }
            reader.readAsDataURL(processedFile)
        } catch (error) {
            console.error("Image processing error:", error)
            setBadgeError("Failed to process image")
        } finally {
            setBadgeLoading(false)
        }
    }

    const handleSaveBadge = async () => {
        setBadgeLoading(true)
        setBadgeError(null)
        try {
            let imageUrl = badgeForm.image_url
            if (useIconMode) {
                if (!selectedIconName) {
                    setBadgeError("Please select an icon")
                    setBadgeLoading(false)
                    return
                }
                imageUrl = `/icon-badge-placeholder.svg`
            } else {
                if (badgeImageFile) {
                    const formData = new FormData()
                    formData.append("image", badgeImageFile)
                    const uploadResult = await uploadBadgeImage(formData)
                    if (!uploadResult.success) {
                        setBadgeError(
                            uploadResult.error || "Failed to upload image"
                        )
                        setBadgeLoading(false)
                        return
                    }
                    imageUrl = uploadResult.url!
                }
                if (!imageUrl) {
                    setBadgeError("Badge image is required")
                    setBadgeLoading(false)
                    return
                }
            }
            const metadata = useIconMode
                ? { icon_name: selectedIconName, icon_color: selectedIconColor }
                : null
            if (editingBadge) {
                const result = await updateBadgeDefinition(editingBadge.id, {
                    name: badgeForm.name,
                    description: badgeForm.description,
                    image_url: imageUrl,
                    category: badgeForm.category,
                    rarity: badgeForm.rarity,
                    metadata,
                })
                if (!result.success) {
                    setBadgeError(result.error || "Failed to update badge")
                    setBadgeLoading(false)
                    return
                }
                setBadges((prev) =>
                    prev.map((b) =>
                        b.id === editingBadge.id
                            ? {
                                  ...b,
                                  ...badgeForm,
                                  image_url: imageUrl,
                                  metadata,
                              }
                            : b
                    )
                )
            } else {
                const result = await createBadgeDefinition({
                    name: badgeForm.name,
                    description: badgeForm.description,
                    image_url: imageUrl,
                    category: badgeForm.category,
                    rarity: badgeForm.rarity,
                    metadata: metadata || undefined,
                })
                if (!result.success || !result.badge) {
                    setBadgeError(result.error || "Failed to create badge")
                    setBadgeLoading(false)
                    return
                }
                setBadges((prev) => [...prev, result.badge!])
            }
            closeBadgeModal()
        } catch (error) {
            console.error("Error saving badge:", error)
            setBadgeError("An unexpected error occurred")
        }
        setBadgeLoading(false)
    }

    const handleDeleteBadge = async (badge: BadgeDefinition) => {
        if (
            !confirm(
                `Are you sure you want to delete the "${badge.name}" badge? This will also remove it from all users.`
            )
        ) {
            return
        }
        setProcessing(badge.id)
        const result = await deleteBadgeDefinition(badge.id)
        if (result.success) {
            setBadges((prev) => prev.filter((b) => b.id !== badge.id))
        } else {
            alert(result.error || "Failed to delete badge")
        }
        setProcessing(null)
    }

    // Award modal handlers
    const openAwardModal = async (badge: BadgeDefinition) => {
        setAwardingBadge(badge)
        setUserSearchQuery("")
        setUserSearchResults([])
        setUsersWithBadge([])
        setBadgeUsersTotal(0)
        setBadgeUsersHasMore(false)
        setShowAwardModal(true)
        const result = await getUsersWithBadge(badge.id, 20, 0)
        setUsersWithBadge(result.users)
        setBadgeUsersTotal(result.total)
        setBadgeUsersHasMore(result.hasMore)
    }

    const closeAwardModal = () => {
        setShowAwardModal(false)
        setAwardingBadge(null)
        setUserSearchQuery("")
        setUserSearchResults([])
        setUsersWithBadge([])
    }

    const handleUserSearch = async (query: string) => {
        setUserSearchQuery(query)
        if (query.length < 2) {
            setUserSearchResults([])
            return
        }
        setSearchLoading(true)
        const results = await searchUsersForBadge(query)
        const filteredResults = results.filter(
            (user) => !usersWithBadge.some((ub) => ub.user_id === user.id)
        )
        setUserSearchResults(filteredResults)
        setSearchLoading(false)
    }

    const handleAwardBadge = async (userId: string) => {
        if (!awardingBadge) return
        setAwardLoading(true)
        const result = await awardBadgeToUser(userId, awardingBadge.id)
        if (result.success) {
            const user = userSearchResults.find((u) => u.id === userId)
            if (user) {
                setUsersWithBadge((prev) => [
                    {
                        user_id: user.id,
                        username: user.username,
                        display_name: user.display_name,
                        avatar_url: user.avatar_url,
                        awarded_at: new Date().toISOString(),
                    },
                    ...prev,
                ])
            }
            setUserSearchResults((prev) => prev.filter((u) => u.id !== userId))
        } else {
            alert(result.error || "Failed to award badge")
        }
        setAwardLoading(false)
    }

    const handleRevokeBadge = async (userId: string) => {
        if (!awardingBadge) return
        const user = usersWithBadge.find((u) => u.user_id === userId)
        if (
            !confirm(
                `Revoke "${awardingBadge.name}" badge from ${user?.display_name || user?.username}?`
            )
        ) {
            return
        }
        setAwardLoading(true)
        const result = await revokeBadgeFromUser(userId, awardingBadge.id)
        if (result.success) {
            setUsersWithBadge((prev) =>
                prev.filter((u) => u.user_id !== userId)
            )
        } else {
            alert(result.error || "Failed to revoke badge")
        }
        setAwardLoading(false)
    }

    const handleAwardAll = async () => {
        if (!awardingBadge) return
        if (
            !confirm(
                `⚠️ CAUTION: You are about to award the "${awardingBadge.name}" badge to ALL users.\n\nThis action cannot be easily undone.\n\nAre you sure?`
            )
        ) {
            return
        }
        setIsAwardingAll(true)
        const result = await awardBadgeToAllUsers(awardingBadge.id)
        if (result.success) {
            alert("Successfully started awarding badge to all users.")
            const users = await getUsersWithBadge(awardingBadge.id, 20, 0)
            setUsersWithBadge(users.users)
            setBadgeUsersTotal(users.total)
            setBadgeUsersHasMore(users.hasMore)
        } else {
            alert("Failed to award badges: " + result.error)
        }
        setIsAwardingAll(false)
    }

    // Maintenance handlers
    const handleCleanupOrphans = async () => {
        if (
            !confirm(
                "This will scan all storage buckets and delete files not referenced in the database. Continue?"
            )
        ) {
            return
        }
        setCleanupLoading(true)
        setCleanupMessage(null)
        const result = await adminCleanupOrphanedImages()
        if (result.success && result.deleted) {
            const total =
                result.deleted.cafes +
                result.deleted.reviews +
                result.deleted.avatars
            setCleanupMessage(
                `Cleaned up ${total} orphaned files: ${result.deleted.cafes} cafe images, ${result.deleted.reviews} review images, ${result.deleted.avatars} avatars`
            )
        } else {
            setCleanupMessage(result.error || "Cleanup failed")
        }
        setCleanupLoading(false)
    }

    const handleProcessAvatarQueue = async () => {
        setCleanupLoading(true)
        setCleanupMessage(null)
        const result = await adminProcessAvatarQueue()
        if (result.success) {
            setCleanupMessage(
                `Processed ${result.processed || 0} queued avatar deletions`
            )
        } else {
            setCleanupMessage(result.error || "Processing failed")
        }
        setCleanupLoading(false)
    }

    const handleBackfillBadges = async () => {
        if (
            !confirm(
                "This will check and award badges to all existing users based on their activity. Continue?"
            )
        ) {
            return
        }
        setProcessing("backfill")
        const result = await backfillBadgesForAllUsers()
        setProcessing(null)
        if (result.success) {
            alert(
                `Backfill complete!\n\nUsers processed: ${result.usersProcessed}\nBadges awarded: ${result.badgesAwarded}${result.errors.length > 0 ? `\nErrors: ${result.errors.length}` : ""}`
            )
        } else {
            alert("Backfill failed: " + result.errors.join(", "))
        }
    }

    return (
        <div className='space-y-6'>
            {/* Header */}
            <div>
                <h1 className='text-2xl md:text-3xl font-bold text-text'>
                    System Management
                </h1>
                <p className='text-text/60 mt-1'>
                    Manage badges, settings, and maintenance tools.
                </p>
            </div>

            {/* Tabs */}
            <div className='flex gap-2 overflow-x-auto py-1'>
                <button
                    onClick={() => setActiveTab("badges")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "badges"
                            ? "bg-primary text-white"
                            : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Award className='w-4 h-4' />
                    Badges ({badges.length})
                </button>
                <button
                    onClick={() => setActiveTab("maintenance")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "maintenance"
                            ? "bg-primary text-white"
                            : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Settings className='w-4 h-4' />
                    Maintenance
                </button>
            </div>

            {/* Badges Tab */}
            {activeTab === "badges" && (
                <div className='space-y-4'>
                    {/* Action buttons */}
                    <div className='flex flex-wrap gap-3'>
                        <button
                            onClick={() => openBadgeModal()}
                            className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition'
                        >
                            <Plus className='w-4 h-4' />
                            Create Badge
                        </button>
                        <button
                            onClick={handleBackfillBadges}
                            disabled={processing === "backfill"}
                            className='flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-600 rounded-lg hover:bg-blue-500/30 transition disabled:opacity-50'
                        >
                            <RefreshCw
                                className={`w-4 h-4 ${processing === "backfill" ? "animate-spin" : ""}`}
                            />
                            {processing === "backfill"
                                ? "Backfilling..."
                                : "Backfill Badges"}
                        </button>
                    </div>

                    {/* Badge Grid */}
                    {badges.length === 0 ? (
                        <div className='text-center py-16 bg-background rounded-xl shadow-sm border border-tertiary/50'>
                            <Award className='w-12 h-12 mx-auto text-text/30 mb-4' />
                            <p className='text-text/60 text-lg'>
                                No badges yet
                            </p>
                            <p className='text-text/40 text-sm mt-1'>
                                Create your first badge to get started.
                            </p>
                        </div>
                    ) : (
                        <div className='grid gap-4'>
                            {badges.map((badge) => (
                                <BadgeCardFull
                                    key={badge.id}
                                    badge={badge}
                                    onAward={() => openAwardModal(badge)}
                                    onEdit={() => openBadgeModal(badge)}
                                    onDelete={() => handleDeleteBadge(badge)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Maintenance Tab */}
            {activeTab === "maintenance" && (
                <div className='space-y-4'>
                    <div className='bg-background rounded-xl p-5 shadow-sm border border-tertiary/50'>
                        <h3 className='font-semibold mb-2 flex items-center gap-2'>
                            <Trash2 className='w-5 h-5' />
                            Storage Cleanup
                        </h3>
                        <p className='text-text/60 text-sm mb-4'>
                            Clean up orphaned images that are no longer
                            referenced in the database.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <button
                                onClick={handleCleanupOrphans}
                                disabled={cleanupLoading}
                                className='flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                            >
                                {cleanupLoading ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                    <Trash2 className='w-4 h-4' />
                                )}
                                Clean Orphaned Images
                            </button>
                            <button
                                onClick={handleProcessAvatarQueue}
                                disabled={cleanupLoading}
                                className='flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-600 rounded-lg hover:bg-orange-500/30 transition disabled:opacity-50'
                            >
                                {cleanupLoading ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                    <Trash2 className='w-4 h-4' />
                                )}
                                Process Avatar Queue
                            </button>
                        </div>
                        {cleanupMessage && (
                            <div className='mt-4 p-3 bg-tertiary/20 border border-tertiary/50 rounded-lg text-sm'>
                                {cleanupMessage}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Badge Create/Edit Modal */}
            {showBadgeModal && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
                    <div className='bg-background rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6'>
                        <h2 className='text-xl font-bold mb-4'>
                            {editingBadge ? "Edit Badge" : "Create Badge"}
                        </h2>

                        <div className='space-y-4'>
                            <div>
                                <label className='block text-sm font-medium mb-1'>
                                    Name
                                </label>
                                <input
                                    type='text'
                                    value={badgeForm.name}
                                    onChange={(e) =>
                                        setBadgeForm({
                                            ...badgeForm,
                                            name: e.target.value,
                                        })
                                    }
                                    className='w-full px-3 py-2 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                />
                            </div>

                            <div>
                                <label className='block text-sm font-medium mb-1'>
                                    Description
                                </label>
                                <textarea
                                    value={badgeForm.description}
                                    onChange={(e) =>
                                        setBadgeForm({
                                            ...badgeForm,
                                            description: e.target.value,
                                        })
                                    }
                                    rows={3}
                                    className='w-full px-3 py-2 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                />
                            </div>

                            <div className='grid grid-cols-2 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium mb-1'>
                                        Category
                                    </label>
                                    <select
                                        value={badgeForm.category}
                                        onChange={(e) =>
                                            setBadgeForm({
                                                ...badgeForm,
                                                category: e.target
                                                    .value as typeof badgeForm.category,
                                            })
                                        }
                                        className='w-full px-3 py-2 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                    >
                                        <option value='achievement'>
                                            Achievement
                                        </option>
                                        <option value='monetary'>
                                            Monetary
                                        </option>
                                        <option value='social'>Social</option>
                                    </select>
                                </div>
                                <div>
                                    <label className='block text-sm font-medium mb-1'>
                                        Rarity
                                    </label>
                                    <select
                                        value={badgeForm.rarity}
                                        onChange={(e) =>
                                            setBadgeForm({
                                                ...badgeForm,
                                                rarity: e.target
                                                    .value as typeof badgeForm.rarity,
                                            })
                                        }
                                        className='w-full px-3 py-2 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                    >
                                        <option value='common'>Common</option>
                                        <option value='rare'>Rare</option>
                                        <option value='legendary'>
                                            Legendary
                                        </option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Image
                                </label>
                                <div className='flex gap-2 mb-3'>
                                    <button
                                        onClick={() => setUseIconMode(false)}
                                        className={`px-3 py-1.5 rounded-lg text-sm ${
                                            !useIconMode
                                                ? "bg-primary text-white"
                                                : "bg-tertiary/30 text-text/70"
                                        }`}
                                    >
                                        Upload Image
                                    </button>
                                    <button
                                        onClick={() => setUseIconMode(true)}
                                        className={`px-3 py-1.5 rounded-lg text-sm ${
                                            useIconMode
                                                ? "bg-primary text-white"
                                                : "bg-tertiary/30 text-text/70"
                                        }`}
                                    >
                                        Use Icon
                                    </button>
                                </div>

                                {useIconMode ? (
                                    <IconPicker
                                        selectedIcon={selectedIconName}
                                        selectedColor={selectedIconColor}
                                        onIconChange={setSelectedIconName}
                                        onColorChange={setSelectedIconColor}
                                    />
                                ) : (
                                    <div>
                                        {badgeImagePreview && (
                                            <div className='relative w-16 h-16 rounded-lg overflow-hidden mb-2'>
                                                <Image
                                                    src={badgeImagePreview}
                                                    alt='Preview'
                                                    fill
                                                    className='object-cover'
                                                />
                                            </div>
                                        )}
                                        <label className='flex items-center gap-2 px-4 py-2 bg-tertiary/30 rounded-lg cursor-pointer hover:bg-tertiary transition w-fit'>
                                            <Upload className='w-4 h-4' />
                                            Choose Image
                                            <input
                                                type='file'
                                                accept='.png'
                                                onChange={
                                                    handleBadgeImageChange
                                                }
                                                className='hidden'
                                            />
                                        </label>
                                        <p className='text-xs text-text/50 mt-1'>
                                            PNG format, 512x512px recommended
                                        </p>
                                    </div>
                                )}
                            </div>

                            {badgeError && (
                                <p className='text-red-500 text-sm'>
                                    {badgeError}
                                </p>
                            )}
                        </div>

                        <div className='flex gap-3 mt-6'>
                            <button
                                onClick={closeBadgeModal}
                                className='flex-1 px-4 py-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition'
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveBadge}
                                disabled={badgeLoading}
                                className='flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50'
                            >
                                {badgeLoading ? (
                                    <Loader2 className='w-4 h-4 animate-spin mx-auto' />
                                ) : editingBadge ? (
                                    "Update"
                                ) : (
                                    "Create"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Award Badge Modal */}
            {showAwardModal && awardingBadge && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
                    <div className='bg-background rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6'>
                        <h2 className='text-xl font-bold mb-4'>
                            Award &quot;{awardingBadge.name}&quot;
                        </h2>

                        <div className='space-y-4'>
                            {/* Search */}
                            <div className='relative'>
                                <input
                                    type='text'
                                    value={userSearchQuery}
                                    onChange={(e) =>
                                        handleUserSearch(e.target.value)
                                    }
                                    placeholder='Search users...'
                                    className='w-full px-4 py-2 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                                />
                                {searchLoading && (
                                    <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-text/40' />
                                )}
                            </div>

                            {/* Search Results */}
                            {userSearchResults.length > 0 && (
                                <div className='space-y-2'>
                                    {userSearchResults.map((user) => (
                                        <div
                                            key={user.id}
                                            className='flex items-center gap-3 p-2 bg-tertiary/10 rounded-lg'
                                        >
                                            <div className='relative w-8 h-8 rounded-full overflow-hidden bg-tertiary/30'>
                                                {user.avatar_url ? (
                                                    <Image
                                                        src={user.avatar_url}
                                                        alt={user.display_name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full flex items-center justify-center text-text/30 text-sm font-semibold'>
                                                        {user.display_name?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className='flex-1 min-w-0'>
                                                <div className='font-medium text-sm truncate'>
                                                    {user.display_name}
                                                </div>
                                                <div className='text-xs text-text/60 truncate'>
                                                    @{user.username}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    handleAwardBadge(user.id)
                                                }
                                                disabled={awardLoading}
                                                className='px-3 py-1 bg-green-500/20 text-green-600 rounded text-sm hover:bg-green-500/30 transition disabled:opacity-50'
                                            >
                                                Award
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Award All Button */}
                            <button
                                onClick={handleAwardAll}
                                disabled={isAwardingAll}
                                className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-600 rounded-lg hover:bg-amber-500/30 transition disabled:opacity-50'
                            >
                                <Users className='w-4 h-4' />
                                {isAwardingAll
                                    ? "Awarding..."
                                    : "Award to All Users"}
                            </button>

                            {/* Users with Badge */}
                            <div>
                                <h4 className='text-sm font-medium text-text/60 mb-2'>
                                    Users with this badge ({badgeUsersTotal})
                                </h4>
                                {usersWithBadge.length === 0 ? (
                                    <p className='text-sm text-text/40'>
                                        No users have this badge yet.
                                    </p>
                                ) : (
                                    <div className='space-y-2 max-h-48 overflow-y-auto'>
                                        {usersWithBadge.map((user) => (
                                            <div
                                                key={user.user_id}
                                                className='flex items-center gap-3 p-2 bg-tertiary/10 rounded-lg'
                                            >
                                                <div className='relative w-8 h-8 rounded-full overflow-hidden bg-tertiary/30'>
                                                    {user.avatar_url ? (
                                                        <Image
                                                            src={
                                                                user.avatar_url
                                                            }
                                                            alt={
                                                                user.display_name
                                                            }
                                                            fill
                                                            className='object-cover'
                                                        />
                                                    ) : (
                                                        <div className='w-full h-full flex items-center justify-center text-text/30 text-sm font-semibold'>
                                                            {user.display_name?.[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className='flex-1 min-w-0'>
                                                    <div className='font-medium text-sm truncate'>
                                                        {user.display_name}
                                                    </div>
                                                    <div className='text-xs text-text/60 truncate'>
                                                        @{user.username}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        handleRevokeBadge(
                                                            user.user_id
                                                        )
                                                    }
                                                    disabled={awardLoading}
                                                    className='px-3 py-1 bg-red-500/20 text-red-600 rounded text-sm hover:bg-red-500/30 transition disabled:opacity-50'
                                                >
                                                    Revoke
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={closeAwardModal}
                            className='w-full mt-6 px-4 py-2 bg-tertiary/30 text-text rounded-lg hover:bg-tertiary transition'
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
