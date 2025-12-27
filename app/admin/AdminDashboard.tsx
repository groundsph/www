"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    Check,
    X,
    MapPin,
    Wifi,
    Plug,
    Car,
    Snowflake,
    PawPrint,
    Sun,
    Utensils,
    Briefcase,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Eye,
    FileText,
    Globe,
    EyeOff,
    Search,
    Trash2,
    Filter,
    ArrowUpDown,
    Loader2,
    MessageSquare,
    Flag,
    Star,
    Award,
    Plus,
    Upload,
    Users,
} from "lucide-react"
import {
    approveCafe,
    rejectCafe,
    unpublishCafe,
    adminCleanupOrphanedImages,
    adminProcessAvatarQueue,
    moderateReview,
    deleteReviewAsAdmin,
    getPaginatedCafes,
    type ReviewForModeration,
    type BadgeDefinition,
    type CafeFilterOptions,
    createBadgeDefinition,
    updateBadgeDefinition,
    deleteBadgeDefinition,
    awardBadgeToUser,
    revokeBadgeFromUser,
    searchUsersForBadge,
    getUsersWithBadge,
    awardBadgeToAllUsers,
    type FeaturedSchedule,
    type TeamMember,
    searchUsersForRoleAssignment,
    updateUserRole,
    getAdminsAndModerators,
} from "@/app/api/actions/admin"
import {
    approveSuggestion,
    rejectSuggestion,
} from "@/app/api/actions/suggestions"
import { approveClaim, rejectClaim, CafeClaim } from "@/app/api/actions/claim"
import { EditSuggestion } from "@/utils/types/suggestions"
import { uploadBadgeImage } from "@/utils/supabase/storage"
import { CafeWithRatings } from "@/utils/types/extra"
import { BadgeCardFull } from "@/components/badges/BadgeCard"
import IconPicker from "@/components/badges/IconPicker"
import { Pencil, Store, RefreshCw } from "lucide-react"
import FeaturedScheduleManager from "./FeaturedScheduleManager"
import { backfillBadgesForAllUsers } from "@/utils/badges/badge-logic"

const resizeBadgeImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = document.createElement("img")
        img.src = URL.createObjectURL(file)
        img.onload = () => {
            // If already 512x512, return original
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

            // Draw stretched to 512x512
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

interface AdminDashboardProps {
    initialPendingCafes: CafeWithRatings[]
    initialPublishedCafes: CafeWithRatings[]
    pendingTotal: number
    publishedTotal: number
    pendingHasMore: boolean
    publishedHasMore: boolean
    filterOptions: CafeFilterOptions
    reportedReviews: ReviewForModeration[]
    badges: BadgeDefinition[]
    suggestions: EditSuggestion[]
    featuredSchedules: FeaturedSchedule[]
    pendingClaims?: CafeClaim[]
}

type TabType =
    | "pending"
    | "published"
    | "reviews"
    | "badges"
    | "suggestions"
    | "featured"
    | "claims"
    | "team"

export default function AdminDashboard({
    initialPendingCafes,
    initialPublishedCafes,
    pendingTotal: initialPendingTotal,
    publishedTotal: initialPublishedTotal,
    pendingHasMore: initialPendingHasMore,
    publishedHasMore: initialPublishedHasMore,
    filterOptions,
    reportedReviews: initialReported,
    badges: initialBadges,
    suggestions: initialSuggestions,
    featuredSchedules: initialFeaturedSchedules,
    pendingClaims: initialClaims = [],
}: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<TabType>("pending")

    // Cafe pagination state
    const [pendingCafes, setPendingCafes] = useState(initialPendingCafes)
    const [publishedCafes, setPublishedCafes] = useState(initialPublishedCafes)
    const [pendingTotal, setPendingTotal] = useState(initialPendingTotal)
    const [publishedTotal, setPublishedTotal] = useState(initialPublishedTotal)
    const [pendingHasMore, setPendingHasMore] = useState(initialPendingHasMore)
    const [publishedHasMore, setPublishedHasMore] = useState(
        initialPublishedHasMore
    )
    const [pendingPage, setPendingPage] = useState(1)
    const [publishedPage, setPublishedPage] = useState(1)
    const [loadingMore, setLoadingMore] = useState(false)
    const [isFiltering, setIsFiltering] = useState(false)

    const [reportedReviews, setReportedReviews] = useState(initialReported)
    const [badges, setBadges] = useState(initialBadges)
    const [suggestions, setSuggestions] = useState(initialSuggestions)
    const [claims, setClaims] = useState<CafeClaim[]>(initialClaims)
    const [expandedCafe, setExpandedCafe] = useState<string | null>(null)
    const [expandedReview, setExpandedReview] = useState<string | null>(null)
    const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(
        null
    )
    const [expandedClaim, setExpandedClaim] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [provinceFilter, setProvinceFilter] = useState<string>("")
    const [cityFilter, setCityFilter] = useState<string>("")
    const [sortBy, setSortBy] = useState<"name" | "date" | "city" | "province">(
        "name"
    )
    const [cleanupLoading, setCleanupLoading] = useState(false)
    const [cleanupMessage, setCleanupMessage] = useState<string | null>(null)

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
    // Icon mode state
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

    // Team management state
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [teamSearchQuery, setTeamSearchQuery] = useState("")
    const [teamSearchResults, setTeamSearchResults] = useState<TeamMember[]>([])
    const [teamLoading, setTeamLoading] = useState(false)
    const [teamSearchLoading, setTeamSearchLoading] = useState(false)

    const handleApprove = async (cafeId: string) => {
        setProcessing(cafeId)
        const result = await approveCafe(cafeId)
        if (result.success) {
            // Move from pending to published
            const cafe = pendingCafes.find((c) => c.id === cafeId)
            if (cafe) {
                setPendingCafes((prev) => prev.filter((c) => c.id !== cafeId))
                setPublishedCafes((prev) => [
                    ...prev,
                    { ...cafe, is_published: true },
                ])
            }
        } else {
            alert(result.error || "Failed to approve cafe")
        }
        setProcessing(null)
    }

    const handleReject = async (cafeId: string) => {
        if (
            !confirm(
                "Are you sure you want to reject and delete this cafe submission?"
            )
        ) {
            return
        }
        setProcessing(cafeId)
        const result = await rejectCafe(cafeId)
        if (result.success) {
            setPendingCafes((prev) => prev.filter((c) => c.id !== cafeId))
        } else {
            alert(result.error || "Failed to reject cafe")
        }
        setProcessing(null)
    }

    const handleUnpublish = async (cafeId: string) => {
        if (
            !confirm(
                "Are you sure you want to unpublish this cafe? It will be moved back to pending."
            )
        ) {
            return
        }
        setProcessing(cafeId)
        const result = await unpublishCafe(cafeId)
        if (result.success) {
            // Move from published to pending
            const cafe = publishedCafes.find((c) => c.id === cafeId)
            if (cafe) {
                setPublishedCafes((prev) => prev.filter((c) => c.id !== cafeId))
                setPendingCafes((prev) => [
                    ...prev,
                    { ...cafe, is_published: false },
                ])
            }
        } else {
            alert(result.error || "Failed to unpublish cafe")
        }
        setProcessing(null)
    }

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

    const toggleExpand = (cafeId: string) => {
        setExpandedCafe((prev) => (prev === cafeId ? null : cafeId))
    }

    const toggleReviewExpand = (reviewId: string) => {
        setExpandedReview((prev) => (prev === reviewId ? null : reviewId))
    }

    // Review moderation handlers
    const handleApproveReview = async (reviewId: string) => {
        setProcessing(reviewId)
        const result = await moderateReview(reviewId, "published")
        if (result.success) {
            setReportedReviews((prev) => prev.filter((r) => r.id !== reviewId))
        } else {
            alert(result.error || "Failed to approve review")
        }
        setProcessing(null)
    }

    const handleHideReview = async (reviewId: string) => {
        setProcessing(reviewId)
        const result = await moderateReview(reviewId, "hidden")
        if (result.success) {
            setReportedReviews((prev) => prev.filter((r) => r.id !== reviewId))
        } else {
            alert(result.error || "Failed to hide review")
        }
        setProcessing(null)
    }

    const handleDeleteReview = async (reviewId: string) => {
        if (
            !confirm(
                "Are you sure you want to permanently delete this review? This cannot be undone."
            )
        ) {
            return
        }
        setProcessing(reviewId)
        const result = await deleteReviewAsAdmin(reviewId)
        if (result.success) {
            setReportedReviews((prev) => prev.filter((r) => r.id !== reviewId))
        } else {
            alert(result.error || "Failed to delete review")
        }
        setProcessing(null)
    }

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
            // Check if badge uses icon mode
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

        // Validate PNG format
        if (file.type !== "image/png") {
            setBadgeError("Badge images must be PNG format")
            return
        }

        try {
            setBadgeLoading(true)
            const processedFile = await resizeBadgeImage(file)

            // Validate size (500KB)
            if (processedFile.size > 500 * 1024) {
                setBadgeError("File too large after processing (max 500KB)")
                setBadgeLoading(false)
                return
            }

            setBadgeImageFile(processedFile)
            setBadgeError(null)

            // Create preview
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

            // If using icon mode, validate icon selection and use placeholder URL
            if (useIconMode) {
                if (!selectedIconName) {
                    setBadgeError("Please select an icon")
                    setBadgeLoading(false)
                    return
                }
                // Use a placeholder URL for icon-based badges
                imageUrl = `/icon-badge-placeholder.svg`
            } else {
                // Image mode - upload new image if selected
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

            // Build metadata object
            const metadata = useIconMode
                ? { icon_name: selectedIconName, icon_color: selectedIconColor }
                : null

            if (editingBadge) {
                // Update existing badge
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

                // Update local state
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
                // Create new badge
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

                // Add to local state
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
                `Are you sure you want to delete the "${badge.name}" badge? This will also remove it from all users who have it.`
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

    // Badge awarding handlers
    const openAwardModal = async (badge: BadgeDefinition) => {
        setAwardingBadge(badge)
        setUserSearchQuery("")
        setUserSearchResults([])
        setUsersWithBadge([])
        setBadgeUsersTotal(0)
        setBadgeUsersHasMore(false)
        setShowAwardModal(true)

        // Fetch users who already have this badge (first page)
        const result = await getUsersWithBadge(badge.id, 20, 0)
        setUsersWithBadge(result.users)
        setBadgeUsersTotal(result.total)
        setBadgeUsersHasMore(result.hasMore)
    }

    const loadMoreBadgeUsers = async () => {
        if (!awardingBadge || !badgeUsersHasMore) return
        const result = await getUsersWithBadge(
            awardingBadge.id,
            20,
            usersWithBadge.length
        )
        setUsersWithBadge((prev) => [...prev, ...result.users])
        setBadgeUsersHasMore(result.hasMore)
    }

    const closeAwardModal = () => {
        setShowAwardModal(false)
        setAwardingBadge(null)
        setUserSearchQuery("")
        setUserSearchResults([])
        setUsersWithBadge([])
        setBadgeUsersTotal(0)
        setBadgeUsersHasMore(false)
    }

    const handleAwardAll = async () => {
        if (!awardingBadge) return

        const confirmed = window.confirm(
            `⚠️ CAUTION: You are about to award the "${awardingBadge.name}" badge to ALL users.\n\nThis action cannot be easily undone.\n\nAre you sure you want to proceed?`
        )

        if (!confirmed) return

        setIsAwardingAll(true)
        try {
            const result = await awardBadgeToAllUsers(awardingBadge.id)
            if (result.success) {
                alert(
                    "Successfully started awarding badge to all users. This may take a moment to complete."
                )
                // Refresh list
                const users = await getUsersWithBadge(awardingBadge.id, 20, 0)
                setUsersWithBadge(users.users)
                setBadgeUsersTotal(users.total)
                setBadgeUsersHasMore(users.hasMore)
            } else {
                alert("Failed to award badges: " + result.error)
            }
        } catch (error) {
            console.error(error)
            alert("An error occurred")
        } finally {
            setIsAwardingAll(false)
        }
    }

    const handleUserSearch = async (query: string) => {
        setUserSearchQuery(query)

        if (query.length < 2) {
            setUserSearchResults([])
            return
        }

        setSearchLoading(true)
        const results = await searchUsersForBadge(query)
        // Filter out users who already have this badge
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
            // Find user from search results and add to usersWithBadge
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
            // Remove from search results
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

    // Team management handlers
    const loadTeamMembers = async () => {
        setTeamLoading(true)
        const members = await getAdminsAndModerators()
        setTeamMembers(members)
        setTeamLoading(false)
    }

    const handleTeamSearch = async (query: string) => {
        setTeamSearchQuery(query)
        if (query.length < 2) {
            setTeamSearchResults([])
            return
        }
        setTeamSearchLoading(true)
        const results = await searchUsersForRoleAssignment(query)
        // Filter out users who are already admins/moderators
        const filtered = results.filter(
            (u) => !teamMembers.some((tm) => tm.id === u.id)
        )
        setTeamSearchResults(filtered)
        setTeamSearchLoading(false)
    }

    const handlePromoteUser = async (
        userId: string,
        role: "moderator" | "admin"
    ) => {
        setTeamLoading(true)
        const result = await updateUserRole(userId, role)
        if (result.success) {
            // Refresh team members list
            await loadTeamMembers()
            // Clear search results
            setTeamSearchResults((prev) => prev.filter((u) => u.id !== userId))
        } else {
            alert(result.error || "Failed to update user role")
        }
        setTeamLoading(false)
    }

    const handleDemoteUser = async (userId: string) => {
        if (
            !confirm("Are you sure you want to remove this user from the team?")
        ) {
            return
        }
        setTeamLoading(true)
        const result = await updateUserRole(userId, "user")
        if (result.success) {
            await loadTeamMembers()
        } else {
            alert(result.error || "Failed to demote user")
        }
        setTeamLoading(false)
    }

    // Load team members when Team tab is selected
    useEffect(() => {
        if (activeTab === "team" && teamMembers.length === 0) {
            loadTeamMembers()
        }
    }, [activeTab])

    const AMENITY_ICONS = {
        has_wifi: { icon: Wifi, label: "WiFi" },
        has_sockets: { icon: Plug, label: "Power Outlets" },
        has_parking: { icon: Car, label: "Parking" },
        has_aircon: { icon: Snowflake, label: "Air Conditioning" },
        is_pet_friendly: { icon: PawPrint, label: "Pet Friendly" },
        has_outdoor_seating: { icon: Sun, label: "Outdoor Seating" },
        serves_food: { icon: Utensils, label: "Serves Food" },
        is_work_friendly: { icon: Briefcase, label: "Work Friendly" },
    }

    // Get provinces from filter options
    const provinces = filterOptions.provinces

    // Get cities for the selected province from filter options
    const cities = useMemo(() => {
        if (!provinceFilter) return []
        const provinceData = filterOptions.cities.find(
            (c) => c.province === provinceFilter
        )
        return provinceData?.cities || []
    }, [filterOptions.cities, provinceFilter])

    // Fetch cafes with current filters (server-side)
    const fetchCafes = async (
        isPublished: boolean,
        page: number,
        append: boolean = false
    ) => {
        const result = await getPaginatedCafes({
            isPublished,
            page,
            pageSize: 25,
            province: provinceFilter || undefined,
            city: cityFilter || undefined,
            search: searchQuery || undefined,
            sortBy,
        })

        if (isPublished) {
            setPublishedCafes(
                append ? [...publishedCafes, ...result.cafes] : result.cafes
            )
            setPublishedTotal(result.total)
            setPublishedHasMore(result.hasMore)
            setPublishedPage(page)
        } else {
            setPendingCafes(
                append ? [...pendingCafes, ...result.cafes] : result.cafes
            )
            setPendingTotal(result.total)
            setPendingHasMore(result.hasMore)
            setPendingPage(page)
        }
    }

    // Handle filter/sort changes - refetch from server
    const applyFilters = async () => {
        setIsFiltering(true)
        const isPublished = activeTab === "published"
        await fetchCafes(isPublished, 1, false)
        setIsFiltering(false)
    }

    // Reset city filter when province changes
    const handleProvinceChange = async (province: string) => {
        setProvinceFilter(province)
        setCityFilter("") // Reset city when province changes
    }

    // Load more cafes
    const loadMore = async () => {
        if (loadingMore) return
        setLoadingMore(true)

        const isPublished = activeTab === "published"
        const currentPage = isPublished ? publishedPage : pendingPage
        await fetchCafes(isPublished, currentPage + 1, true)

        setLoadingMore(false)
    }

    // Debounced search effect
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        // Debounce search by 500ms
        searchTimeoutRef.current = setTimeout(() => {
            if (activeTab === "pending" || activeTab === "published") {
                applyFilters()
            }
        }, 500)

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery])

    // Apply filters when province, city, or sortBy changes
    useEffect(() => {
        if (activeTab === "pending" || activeTab === "published") {
            applyFilters()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provinceFilter, cityFilter, sortBy, activeTab])

    // Current cafes for display (already filtered/sorted from server)
    const currentCafes = activeTab === "pending" ? pendingCafes : publishedCafes
    const currentTotal = activeTab === "pending" ? pendingTotal : publishedTotal
    const currentHasMore =
        activeTab === "pending" ? pendingHasMore : publishedHasMore

    return (
        <div className='w-full overflow-hidden space-y-8 [&_button]:cursor-pointer'>
            {/* Header */}
            <div className='border-b border-text/10 pb-6'>
                <h1 className='text-3xl font-bold font-serif'>
                    Admin Dashboard
                </h1>
                <p className='text-text/60 mt-2'>
                    Manage cafe submissions and listings
                </p>
            </div>

            {/* Stats */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                    <div className='text-4xl font-bold'>
                        {filterOptions.totalPending}
                    </div>
                    <div className='text-text/60 text-sm'>Pending Cafes</div>
                </div>
                <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                    <div className='text-4xl font-bold'>
                        {filterOptions.totalPublished}
                    </div>
                    <div className='text-text/60 text-sm'>Published Cafes</div>
                </div>
                <div
                    className={`bg-text/5 border rounded-xl p-6 ${reportedReviews.length > 0 ? "border-red-500/30 bg-red-500/5" : "border-text/10"}`}
                >
                    <div
                        className={`text-4xl font-bold ${reportedReviews.length > 0 ? "text-red-500" : ""}`}
                    >
                        {reportedReviews.length}
                    </div>
                    <div className='text-text/60 text-sm'>Reported Reviews</div>
                </div>
            </div>

            {/* Storage Cleanup */}
            <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                <h2 className='text-lg font-semibold mb-4 flex items-center gap-2'>
                    <Trash2 className='w-5 h-5' />
                    Storage Cleanup
                </h2>
                <p className='text-text/60 text-sm mb-4'>
                    Clean up orphaned images that are no longer referenced in
                    the database.
                </p>
                <div className='flex flex-wrap gap-3'>
                    <button
                        onClick={handleCleanupOrphans}
                        disabled={cleanupLoading}
                        className='flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
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
                        className='flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-500 rounded-lg hover:bg-orange-500/30 transition disabled:opacity-50'
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
                    <div className='mt-4 p-3 bg-text/5 border border-text/10 rounded-lg text-sm'>
                        {cleanupMessage}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className='flex gap-2 border-b border-text/10 pb-4 overflow-x-auto [&_button]:text-nowrap'>
                <button
                    onClick={() => setActiveTab("pending")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "pending"
                            ? "bg-accent/20 text-accent border-accent/30"
                            : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <FileText className='w-4 h-4' />
                    Pending ({pendingCafes.length})
                </button>
                <button
                    onClick={() => setActiveTab("published")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "published"
                            ? "bg-accent/20 text-accent border-accent/30"
                            : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <Globe className='w-4 h-4' />
                    Published ({publishedCafes.length})
                </button>
                <button
                    onClick={() => setActiveTab("reviews")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "reviews"
                            ? "bg-red-500/20 text-red-500 border-red-500/30"
                            : reportedReviews.length > 0
                              ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                              : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <Flag className='w-4 h-4' />
                    Reviews ({reportedReviews.length})
                </button>
                <button
                    onClick={() => setActiveTab("badges")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "badges"
                            ? "bg-amber-500/20 text-amber-500 border-amber-500/30"
                            : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <Award className='w-4 h-4' />
                    Badges ({badges.length})
                </button>
                <button
                    onClick={() => setActiveTab("suggestions")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "suggestions"
                            ? "bg-primary/20 text-primary border-primary/30"
                            : suggestions.length > 0
                              ? "bg-primary/10 border-primary/20 text-primary/80 hover:bg-primary/20"
                              : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <Pencil className='w-4 h-4' />
                    Suggestions ({suggestions.length})
                </button>
                <button
                    onClick={() => setActiveTab("featured")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "featured"
                            ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                            : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <Star className='w-4 h-4' />
                    Featured
                </button>
                <button
                    onClick={() => setActiveTab("claims")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "claims"
                            ? "bg-purple-500/20 text-purple-500 border-purple-500/30"
                            : claims.length > 0
                              ? "bg-purple-500/10 border-purple-500/20 text-purple-500/80 hover:bg-purple-500/20"
                              : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <Store className='w-4 h-4' />
                    Claims ({claims.length})
                </button>
                <button
                    onClick={() => setActiveTab("team")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${
                        activeTab === "team"
                            ? "bg-blue-500/20 text-blue-500 border-blue-500/30"
                            : "bg-text/5 border-text/10 hover:bg-text/10"
                    }`}
                >
                    <Users className='w-4 h-4' />
                    Team
                </button>
            </div>

            {/* Search and Filter - only for cafe tabs */}
            {(activeTab === "pending" || activeTab === "published") && (
                <div className='space-y-3'>
                    {/* Search bar */}
                    <div className='relative'>
                        <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40' />
                        <input
                            type='text'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder='Search cafes by name, city, or address...'
                            className='w-full pl-12 pr-4 py-3 bg-text/5 border border-text/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50'
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className='absolute right-4 top-1/2 -translate-y-1/2 text-text/40 hover:text-text/60'
                            >
                                <X className='w-4 h-4' />
                            </button>
                        )}
                    </div>

                    {/* Filters row */}
                    <div className='flex gap-3 flex-wrap'>
                        {/* Province filter */}
                        <div className='relative'>
                            <Filter className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                            <select
                                value={provinceFilter}
                                onChange={(e) =>
                                    handleProvinceChange(e.target.value)
                                }
                                className='appearance-none pl-9 pr-8 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer text-sm'
                            >
                                <option value=''>All Provinces</option>
                                {provinces.map((province) => (
                                    <option
                                        key={province}
                                        value={province}
                                    >
                                        {province}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none' />
                        </div>

                        {/* City filter - only shows when province is selected */}
                        {provinceFilter && cities.length > 0 && (
                            <div className='relative'>
                                <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                                <select
                                    value={cityFilter}
                                    onChange={(e) =>
                                        setCityFilter(e.target.value)
                                    }
                                    className='appearance-none pl-9 pr-8 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer text-sm'
                                >
                                    <option value=''>All Cities</option>
                                    {cities.map((city) => (
                                        <option
                                            key={city}
                                            value={city}
                                        >
                                            {city}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none' />
                            </div>
                        )}

                        {/* Spacer to push sort to the right */}
                        <div className='flex-1' />

                        {/* Sort dropdown */}
                        <div className='relative'>
                            <ArrowUpDown className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                            <select
                                value={sortBy}
                                onChange={(e) =>
                                    setSortBy(e.target.value as typeof sortBy)
                                }
                                className='appearance-none pl-9 pr-8 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer text-sm'
                            >
                                <option value='name'>Sort by Name</option>
                                <option value='date'>Sort by Date</option>
                                <option value='city'>Sort by City</option>
                                <option value='province'>
                                    Sort by Province
                                </option>
                            </select>
                            <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none' />
                        </div>

                        {/* Clear filters button */}
                        {(provinceFilter || cityFilter) && (
                            <button
                                onClick={() => {
                                    setProvinceFilter("")
                                    setCityFilter("")
                                }}
                                className='px-3 py-2 text-sm text-accent hover:bg-accent/10 rounded-lg transition flex items-center gap-1'
                            >
                                <X className='w-4 h-4' />
                                Clear filters
                            </button>
                        )}
                    </div>

                    {/* Results count */}
                    <div className='text-sm text-text/50'>
                        {isFiltering ? (
                            <span className='flex items-center gap-2'>
                                <Loader2 className='w-4 h-4 animate-spin' />
                                Loading...
                            </span>
                        ) : (
                            <>
                                Showing {currentCafes.length} of {currentTotal}{" "}
                                cafes
                                {provinceFilter && ` in ${provinceFilter}`}
                                {cityFilter && `, ${cityFilter}`}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Reviews Moderation Queue */}
            {activeTab === "reviews" && (
                <>
                    {reportedReviews.length === 0 ? (
                        <div className='text-center py-16 bg-text/5 rounded-xl border border-text/10'>
                            <Check className='w-12 h-12 mx-auto text-green-500 mb-4' />
                            <p className='text-text/60 text-lg'>
                                No flagged reviews
                            </p>
                            <p className='text-text/40 text-sm mt-1'>
                                All reviews are in good standing!
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-4'>
                            {reportedReviews.map((review) => {
                                const isExpanded = expandedReview === review.id
                                const isProcessingThis =
                                    processing === review.id

                                return (
                                    <div
                                        key={review.id}
                                        className='bg-text/5 border border-red-500/20 rounded-xl overflow-hidden'
                                    >
                                        {/* Main Row */}
                                        <div className='p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4'>
                                            {/* Author Avatar */}
                                            <div className='relative w-12 h-12 shrink-0 rounded-full overflow-hidden bg-text/10'>
                                                {review.author?.avatar_url ? (
                                                    <Image
                                                        src={
                                                            review.author
                                                                .avatar_url
                                                        }
                                                        alt={
                                                            review.author
                                                                .display_name
                                                        }
                                                        fill
                                                        className='object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full flex items-center justify-center text-text/30'>
                                                        <MessageSquare className='w-5 h-5' />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Review Info */}
                                            <div className='flex-1 min-w-0'>
                                                <div className='flex items-center gap-2 flex-wrap'>
                                                    <span className='font-semibold'>
                                                        {review.author
                                                            ?.display_name ||
                                                            "Unknown User"}
                                                    </span>
                                                    <span className='text-text/40'>
                                                        @
                                                        {
                                                            review.author
                                                                ?.username
                                                        }
                                                    </span>
                                                    <span className='flex items-center gap-1 text-yellow-500'>
                                                        <Star className='w-4 h-4 fill-current' />
                                                        {review.rating}
                                                    </span>
                                                    {review.report_count >
                                                        0 && (
                                                        <span className='px-2 py-0.5 bg-red-500/20 text-red-500 rounded-full text-xs'>
                                                            {
                                                                review.report_count
                                                            }{" "}
                                                            report
                                                            {review.report_count !==
                                                            1
                                                                ? "s"
                                                                : ""}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className='text-text/60 text-sm mt-1'>
                                                    on{" "}
                                                    <Link
                                                        href={`/cafes/${review.cafe?.slug}`}
                                                        className='text-accent hover:underline'
                                                    >
                                                        {review.cafe?.name}
                                                    </Link>
                                                </p>
                                                <p className='text-text/80 text-sm mt-2 line-clamp-2'>
                                                    {review.comment}
                                                </p>
                                                <p className='text-text/40 text-xs mt-2'>
                                                    {review.created_at &&
                                                        new Date(
                                                            review.created_at
                                                        ).toLocaleDateString()}
                                                </p>
                                            </div>
                                            {/* Actions */}
                                            <div className='flex items-center gap-2 shrink-0 self-end sm:self-center'>
                                                <button
                                                    onClick={() =>
                                                        handleApproveReview(
                                                            review.id
                                                        )
                                                    }
                                                    disabled={isProcessingThis}
                                                    className='p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
                                                    title='Approve (Publish)'
                                                >
                                                    <Check className='w-5 h-5' />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleHideReview(
                                                            review.id
                                                        )
                                                    }
                                                    disabled={isProcessingThis}
                                                    className='p-2 bg-orange-500/20 text-orange-500 rounded-lg hover:bg-orange-500/30 transition disabled:opacity-50'
                                                    title='Hide Review'
                                                >
                                                    <EyeOff className='w-5 h-5' />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleDeleteReview(
                                                            review.id
                                                        )
                                                    }
                                                    disabled={isProcessingThis}
                                                    className='p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                                                    title='Delete Permanently'
                                                >
                                                    <Trash2 className='w-5 h-5' />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        toggleReviewExpand(
                                                            review.id
                                                        )
                                                    }
                                                    className='p-2 bg-text/5 rounded-lg hover:bg-text/10 transition'
                                                    title='View Details'
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className='w-5 h-5' />
                                                    ) : (
                                                        <ChevronDown className='w-5 h-5' />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className='border-t border-text/10 p-4 space-y-4 bg-background/50'>
                                                {/* Full Comment */}
                                                <div>
                                                    <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                        Full Review
                                                    </h4>
                                                    <p className='text-sm text-text/80 whitespace-pre-wrap'>
                                                        {review.comment}
                                                    </p>
                                                </div>

                                                {/* Review Images */}
                                                {review.images &&
                                                    review.images.length >
                                                        0 && (
                                                        <div>
                                                            <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                                Images (
                                                                {
                                                                    review
                                                                        .images
                                                                        .length
                                                                }
                                                                )
                                                            </h4>
                                                            <div className='flex gap-2 overflow-x-auto pb-2'>
                                                                {review.images.map(
                                                                    (
                                                                        url,
                                                                        idx
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                idx
                                                                            }
                                                                            className='relative w-24 h-24 shrink-0 rounded-lg overflow-hidden'
                                                                        >
                                                                            <Image
                                                                                src={
                                                                                    url
                                                                                }
                                                                                alt={`Review image ${idx + 1}`}
                                                                                fill
                                                                                className='object-cover'
                                                                            />
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* Cafe Link */}
                                                {review.cafe && (
                                                    <div className='pt-2 flex gap-4'>
                                                        <Link
                                                            href={`/cafes/${review.cafe.slug}`}
                                                            className='text-sm text-accent hover:underline inline-flex items-center gap-1'
                                                        >
                                                            View cafe page{" "}
                                                            <ExternalLink className='w-3 h-3' />
                                                        </Link>
                                                        {review.author && (
                                                            <Link
                                                                href={`/profile/${review.author.username}`}
                                                                className='text-sm text-accent hover:underline inline-flex items-center gap-1'
                                                            >
                                                                View author
                                                                profile{" "}
                                                                <ExternalLink className='w-3 h-3' />
                                                            </Link>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Cafe List - only for cafe tabs */}
            {(activeTab === "pending" || activeTab === "published") && (
                <>
                    {currentCafes.length === 0 ? (
                        <div className='text-center py-16 bg-text/5 rounded-xl border border-text/10'>
                            <AlertCircle className='w-12 h-12 mx-auto text-text/30 mb-4' />
                            <p className='text-text/60 text-lg'>
                                {searchQuery
                                    ? `No cafes found for "${searchQuery}"`
                                    : activeTab === "pending"
                                      ? "No pending submissions"
                                      : "No published cafes"}
                            </p>
                            <p className='text-text/40 text-sm mt-1'>
                                {searchQuery
                                    ? "Try a different search term"
                                    : activeTab === "pending"
                                      ? "All caught up!"
                                      : "Approve some cafes to see them here"}
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-4'>
                            {currentCafes.map((cafe) => {
                                const isExpanded = expandedCafe === cafe.id
                                const isProcessingThis = processing === cafe.id

                                return (
                                    <div
                                        key={cafe.id}
                                        className='bg-text/5 border border-text/10 rounded-xl overflow-hidden'
                                    >
                                        {/* Main Row */}
                                        <div className='p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'>
                                            {/* Thumbnail */}
                                            <div className='relative w-full sm:w-20 h-32 sm:h-20 shrink-0 rounded-lg overflow-hidden'>
                                                {cafe.thumbnail ? (
                                                    <Image
                                                        src={cafe.thumbnail}
                                                        alt={cafe.name}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full bg-text/10 flex items-center justify-center'>
                                                        <MapPin className='w-6 h-6 text-text/30' />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className='flex-1 min-w-0'>
                                                <h3 className='font-semibold text-lg truncate'>
                                                    {cafe.name}
                                                </h3>
                                                <p className='text-text/60 text-sm truncate'>
                                                    <MapPin className='inline w-3 h-3 mr-1' />
                                                    {cafe.city_municipality},{" "}
                                                    {cafe.province}
                                                </p>
                                                <p className='text-text/40 text-xs mt-1'>
                                                    {activeTab === "pending"
                                                        ? "Submitted "
                                                        : "Published "}
                                                    {new Date(
                                                        cafe.created_at!
                                                    ).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className='flex items-center gap-2 self-end sm:self-center'>
                                                <Link
                                                    href={`/admin/preview/${cafe.id}`}
                                                    className='p-2 bg-text/5 text-text rounded-lg hover:bg-text/20 transition'
                                                    title='View & Edit'
                                                >
                                                    <Eye className='w-5 h-5' />
                                                </Link>
                                                {activeTab === "pending" ? (
                                                    <>
                                                        <button
                                                            onClick={() =>
                                                                handleApprove(
                                                                    cafe.id
                                                                )
                                                            }
                                                            disabled={
                                                                isProcessingThis
                                                            }
                                                            className='p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
                                                            title='Approve'
                                                        >
                                                            <Check className='w-5 h-5' />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleReject(
                                                                    cafe.id
                                                                )
                                                            }
                                                            disabled={
                                                                isProcessingThis
                                                            }
                                                            className='p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                                                            title='Reject'
                                                        >
                                                            <X className='w-5 h-5' />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            handleUnpublish(
                                                                cafe.id
                                                            )
                                                        }
                                                        disabled={
                                                            isProcessingThis
                                                        }
                                                        className='p-2 bg-orange-500/20 text-orange-500 rounded-lg hover:bg-orange-500/30 transition disabled:opacity-50'
                                                        title='Unpublish'
                                                    >
                                                        <EyeOff className='w-5 h-5' />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        toggleExpand(cafe.id)
                                                    }
                                                    className='p-2 bg-text/5 rounded-lg hover:bg-text/10 transition'
                                                    title='View Details'
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className='w-5 h-5' />
                                                    ) : (
                                                        <ChevronDown className='w-5 h-5' />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className='border-t border-text/10 p-4 space-y-4 bg-background/50'>
                                                {/* Description */}
                                                {cafe.description && (
                                                    <div>
                                                        <h4 className='text-xs font-medium text-text/40 uppercase mb-1'>
                                                            Description
                                                        </h4>
                                                        <p className='text-sm text-text/80'>
                                                            {cafe.description}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Address */}
                                                <div>
                                                    <h4 className='text-xs font-medium text-text/40 uppercase mb-1'>
                                                        Address
                                                    </h4>
                                                    <p className='text-sm text-text/80'>
                                                        {cafe.address_display}
                                                    </p>
                                                    {cafe.lat && cafe.lng && (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${cafe.lat},${cafe.lng}`}
                                                            target='_blank'
                                                            rel='noopener noreferrer'
                                                            className='text-xs text-accent hover:underline inline-flex items-center gap-1 mt-1'
                                                        >
                                                            View on Google Maps{" "}
                                                            <ExternalLink className='w-3 h-3' />
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Amenities */}
                                                <div>
                                                    <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                        Amenities
                                                    </h4>
                                                    <div className='flex flex-wrap gap-2'>
                                                        {Object.entries(
                                                            AMENITY_ICONS
                                                        ).map(
                                                            ([
                                                                key,
                                                                {
                                                                    icon: Icon,
                                                                    label,
                                                                },
                                                            ]) => {
                                                                const hasAmenity =
                                                                    cafe[
                                                                        key as keyof typeof cafe
                                                                    ]
                                                                return (
                                                                    <div
                                                                        key={
                                                                            key
                                                                        }
                                                                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                                                            hasAmenity
                                                                                ? "bg-green-500/20 text-green-500"
                                                                                : "bg-text/5 text-text/30"
                                                                        }`}
                                                                    >
                                                                        <Icon className='w-3 h-3' />
                                                                        {label}
                                                                    </div>
                                                                )
                                                            }
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Gallery */}
                                                {cafe.gallery &&
                                                    cafe.gallery.length > 0 && (
                                                        <div>
                                                            <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                                Gallery (
                                                                {
                                                                    cafe.gallery
                                                                        .length
                                                                }{" "}
                                                                images)
                                                            </h4>
                                                            <div className='flex gap-2 overflow-x-auto pb-2'>
                                                                {cafe.gallery
                                                                    .slice(0, 6)
                                                                    .map(
                                                                        (
                                                                            url,
                                                                            idx
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    idx
                                                                                }
                                                                                className='relative w-24 h-24 shrink-0 rounded-lg overflow-hidden'
                                                                            >
                                                                                <Image
                                                                                    src={
                                                                                        url
                                                                                    }
                                                                                    alt={`Gallery ${idx + 1}`}
                                                                                    fill
                                                                                    className='object-cover'
                                                                                />
                                                                            </div>
                                                                        )
                                                                    )}
                                                                {cafe.gallery
                                                                    .length >
                                                                    6 && (
                                                                    <div className='w-24 h-24 shrink-0 rounded-lg bg-text/10 flex items-center justify-center text-text/40 text-sm'>
                                                                        +
                                                                        {cafe
                                                                            .gallery
                                                                            .length -
                                                                            6}{" "}
                                                                        more
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* Tags */}
                                                {cafe.tags &&
                                                    cafe.tags.length > 0 && (
                                                        <div>
                                                            <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                                Vibe Tags
                                                            </h4>
                                                            <div className='flex flex-wrap gap-1'>
                                                                {cafe.tags.map(
                                                                    (tag) => (
                                                                        <span
                                                                            key={
                                                                                tag
                                                                            }
                                                                            className='px-2 py-0.5 bg-text/10 rounded-full text-xs'
                                                                        >
                                                                            {tag.replace(
                                                                                /_/g,
                                                                                " "
                                                                            )}
                                                                        </span>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* Specialty */}
                                                {cafe.specialty &&
                                                    cafe.specialty.length >
                                                        0 && (
                                                        <div>
                                                            <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                                Specialties
                                                            </h4>
                                                            <div className='flex flex-wrap gap-1'>
                                                                {cafe.specialty.map(
                                                                    (s) => (
                                                                        <span
                                                                            key={
                                                                                s
                                                                            }
                                                                            className='px-2 py-0.5 bg-accent/20 text-accent rounded-full text-xs'
                                                                        >
                                                                            {s.replace(
                                                                                /_/g,
                                                                                " "
                                                                            )}
                                                                        </span>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* View on site link for published cafes */}
                                                {activeTab === "published" &&
                                                    cafe.slug && (
                                                        <div className='pt-2'>
                                                            <a
                                                                href={`/cafes/${cafe.slug}`}
                                                                target='_blank'
                                                                rel='noopener noreferrer'
                                                                className='text-sm text-accent hover:underline inline-flex items-center gap-1'
                                                            >
                                                                View public page{" "}
                                                                <ExternalLink className='w-3 h-3' />
                                                            </a>
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Load More Button */}
                    {currentHasMore && (
                        <div className='flex justify-center pt-4'>
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className='flex items-center gap-2 px-6 py-3 bg-accent/20 text-accent rounded-xl hover:bg-accent/30 transition disabled:opacity-50 border border-accent/30'
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                        Loading...
                                    </>
                                ) : (
                                    <>Load More Cafes</>
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Badges Management */}
            {activeTab === "badges" && (
                <>
                    {/* Create Badge Button and Backfill Button */}
                    <div className='mb-6 flex items-center gap-3 flex-wrap'>
                        <button
                            onClick={() => openBadgeModal()}
                            className='flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-500 rounded-lg hover:bg-amber-500/30 transition border border-amber-500/30'
                        >
                            <Plus className='w-4 h-4' />
                            Create Badge
                        </button>
                        <button
                            onClick={async () => {
                                if (
                                    !confirm(
                                        "This will check and award badges to all existing users based on their activity. Continue?"
                                    )
                                )
                                    return
                                setProcessing("backfill")
                                const result = await backfillBadgesForAllUsers()
                                setProcessing(null)
                                if (result.success) {
                                    alert(
                                        `Backfill complete!\n\nUsers processed: ${result.usersProcessed}\nBadges awarded: ${result.badgesAwarded}${result.errors.length > 0 ? `\nErrors: ${result.errors.length}` : ""}`
                                    )
                                } else {
                                    alert(
                                        "Backfill failed: " +
                                            result.errors.join(", ")
                                    )
                                }
                            }}
                            disabled={processing === "backfill"}
                            className='flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-500 rounded-lg hover:bg-blue-500/30 transition border border-blue-500/30 disabled:opacity-50'
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
                        <div className='text-center py-16 bg-text/5 rounded-xl border border-text/10'>
                            <Award className='w-12 h-12 mx-auto text-text/30 mb-4' />
                            <p className='text-text/60 text-lg'>
                                No badges yet
                            </p>
                            <p className='text-text/40 text-sm mt-1'>
                                Create your first badge to get started
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
                </>
            )}

            {/* Suggestions Management */}
            {activeTab === "suggestions" && (
                <>
                    {suggestions.length === 0 ? (
                        <div className='text-center py-16 bg-text/5 rounded-xl border border-text/10'>
                            <Pencil className='w-12 h-12 mx-auto text-text/30 mb-4' />
                            <h3 className='text-lg font-semibold'>
                                No pending suggestions
                            </h3>
                            <p className='text-text/60 text-sm mt-1'>
                                User edit suggestions will appear here for
                                review.
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-4'>
                            {suggestions.map((suggestion) => {
                                const isExpanded =
                                    expandedSuggestion === suggestion.id
                                const changesCount = Object.keys(
                                    suggestion.suggested_changes || {}
                                ).length

                                return (
                                    <div
                                        key={suggestion.id}
                                        className='bg-white/50 border border-text/10 rounded-xl overflow-hidden'
                                    >
                                        {/* Header */}
                                        <div
                                            className='p-3 sm:p-4 cursor-pointer hover:bg-text/5 transition flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'
                                            onClick={() =>
                                                setExpandedSuggestion(
                                                    isExpanded
                                                        ? null
                                                        : suggestion.id
                                                )
                                            }
                                        >
                                            {/* Cafe Thumbnail */}
                                            {suggestion.cafe?.thumbnail && (
                                                <Image
                                                    src={
                                                        suggestion.cafe
                                                            .thumbnail
                                                    }
                                                    alt={
                                                        suggestion.cafe.name ||
                                                        "Cafe"
                                                    }
                                                    width={56}
                                                    height={56}
                                                    className='rounded-lg object-cover'
                                                />
                                            )}

                                            <div className='flex-1 min-w-0'>
                                                <h3 className='font-semibold truncate'>
                                                    {suggestion.cafe?.name ||
                                                        "Unknown Cafe"}
                                                </h3>
                                                <p className='text-sm text-text/60'>
                                                    {changesCount} field
                                                    {changesCount !== 1
                                                        ? "s"
                                                        : ""}{" "}
                                                    to update
                                                </p>
                                                <p className='text-xs text-text/40'>
                                                    Suggested by{" "}
                                                    {suggestion.author
                                                        ?.display_name ||
                                                        suggestion.author
                                                            ?.username ||
                                                        "Unknown"}
                                                    {suggestion.created_at &&
                                                        ` • ${new Date(suggestion.created_at).toLocaleDateString()}`}
                                                </p>
                                            </div>

                                            <div className='flex items-center gap-2'>
                                                {isExpanded ? (
                                                    <ChevronUp className='w-5 h-5 text-text/40' />
                                                ) : (
                                                    <ChevronDown className='w-5 h-5 text-text/40' />
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className='border-t border-text/10'>
                                                {/* Changes Preview */}
                                                <div className='p-4 bg-text/5'>
                                                    <h4 className='text-sm font-semibold mb-3'>
                                                        Proposed Changes
                                                    </h4>
                                                    <div className='space-y-2'>
                                                        {Object.entries(
                                                            suggestion.suggested_changes ||
                                                                {}
                                                        ).map(
                                                            ([key, value]) => (
                                                                <div
                                                                    key={key}
                                                                    className='flex items-start gap-2 text-sm'
                                                                >
                                                                    <span className='font-medium text-text/60 capitalize min-w-[120px]'>
                                                                        {key.replace(
                                                                            /_/g,
                                                                            " "
                                                                        )}
                                                                        :
                                                                    </span>
                                                                    <span className='text-text break-all'>
                                                                        {typeof value ===
                                                                        "boolean"
                                                                            ? value
                                                                                ? "Yes"
                                                                                : "No"
                                                                            : typeof value ===
                                                                                "object"
                                                                              ? JSON.stringify(
                                                                                    value,
                                                                                    null,
                                                                                    2
                                                                                )
                                                                              : String(
                                                                                    value
                                                                                )}
                                                                    </span>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className='p-4 flex items-center gap-3 justify-end'>
                                                    <Link
                                                        href={`/cafes/${suggestion.cafe?.slug || ""}`}
                                                        target='_blank'
                                                        className='flex items-center gap-2 px-3 py-1.5 text-sm bg-text/5 border border-text/10 rounded-lg hover:bg-text/10 transition'
                                                    >
                                                        <Eye className='w-4 h-4' />
                                                        View Cafe
                                                    </Link>
                                                    <button
                                                        onClick={async () => {
                                                            setProcessing(
                                                                suggestion.id
                                                            )
                                                            const result =
                                                                await rejectSuggestion(
                                                                    suggestion.id
                                                                )
                                                            if (
                                                                result.success
                                                            ) {
                                                                setSuggestions(
                                                                    (prev) =>
                                                                        prev.filter(
                                                                            (
                                                                                s
                                                                            ) =>
                                                                                s.id !==
                                                                                suggestion.id
                                                                        )
                                                                )
                                                            }
                                                            setProcessing(null)
                                                        }}
                                                        disabled={
                                                            processing ===
                                                            suggestion.id
                                                        }
                                                        className='flex items-center gap-2 px-4 py-1.5 text-sm bg-red-500/10 text-red-500 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition disabled:opacity-50'
                                                    >
                                                        <X className='w-4 h-4' />
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            setProcessing(
                                                                suggestion.id
                                                            )
                                                            const result =
                                                                await approveSuggestion(
                                                                    suggestion.id
                                                                )
                                                            if (
                                                                result.success
                                                            ) {
                                                                setSuggestions(
                                                                    (prev) =>
                                                                        prev.filter(
                                                                            (
                                                                                s
                                                                            ) =>
                                                                                s.id !==
                                                                                suggestion.id
                                                                        )
                                                                )
                                                            }
                                                            setProcessing(null)
                                                        }}
                                                        disabled={
                                                            processing ===
                                                            suggestion.id
                                                        }
                                                        className='flex items-center gap-2 px-4 py-1.5 text-sm bg-green-500/10 text-green-500 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition disabled:opacity-50'
                                                    >
                                                        {processing ===
                                                        suggestion.id ? (
                                                            <Loader2 className='w-4 h-4 animate-spin' />
                                                        ) : (
                                                            <Check className='w-4 h-4' />
                                                        )}
                                                        Approve
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Badge Modal */}
            {showBadgeModal && (
                <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
                    <div className='bg-background border border-text/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto'>
                        <div className='p-6 border-b border-text/10'>
                            <h2 className='text-xl font-semibold font-serif'>
                                {editingBadge ? "Edit Badge" : "Create Badge"}
                            </h2>
                        </div>

                        <div className='p-6 space-y-4'>
                            {/* Badge Type Toggle */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Badge Type
                                </label>
                                <div className='grid grid-cols-2 gap-2'>
                                    <button
                                        type='button'
                                        onClick={() => {
                                            setUseIconMode(false)
                                            setSelectedIconName(null)
                                        }}
                                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                                            !useIconMode
                                                ? "bg-primary/10 border-primary text-primary"
                                                : "bg-text/5 border-text/10 text-text/60 hover:bg-text/10"
                                        }`}
                                    >
                                        <Upload className='w-4 h-4 inline-block mr-2' />
                                        Image Upload
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => {
                                            setUseIconMode(true)
                                            setBadgeImageFile(null)
                                            setBadgeImagePreview(null)
                                        }}
                                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                                            useIconMode
                                                ? "bg-primary/10 border-primary text-primary"
                                                : "bg-text/5 border-text/10 text-text/60 hover:bg-text/10"
                                        }`}
                                    >
                                        <Award className='w-4 h-4 inline-block mr-2' />
                                        Lucide Icon
                                    </button>
                                </div>
                            </div>

                            {/* Badge Image or Icon Picker */}
                            {useIconMode ? (
                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Select Icon
                                    </label>
                                    <IconPicker
                                        selectedIcon={selectedIconName}
                                        selectedColor={selectedIconColor}
                                        onIconChange={setSelectedIconName}
                                        onColorChange={setSelectedIconColor}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className='block text-sm font-medium mb-2'>
                                        Badge Image (512×512 PNG)
                                    </label>
                                    <div className='flex items-center gap-4'>
                                        {/* Preview */}
                                        <div className='w-20 h-20 rounded-xl border-2 border-dashed border-text/20 flex items-center justify-center overflow-hidden bg-text/5'>
                                            {badgeImagePreview ? (
                                                <Image
                                                    src={badgeImagePreview}
                                                    alt='Badge preview'
                                                    width={80}
                                                    height={80}
                                                    className='object-contain'
                                                    unoptimized
                                                />
                                            ) : (
                                                <Upload className='w-8 h-8 text-text/30' />
                                            )}
                                        </div>

                                        {/* Upload Button */}
                                        <div className='flex-1'>
                                            <label className='block'>
                                                <span className='inline-flex items-center gap-2 px-4 py-2 bg-text/5 border border-text/10 rounded-lg cursor-pointer hover:bg-text/10 transition'>
                                                    <Upload className='w-4 h-4' />
                                                    {badgeImageFile
                                                        ? "Change Image"
                                                        : "Upload Image"}
                                                </span>
                                                <input
                                                    type='file'
                                                    accept='image/png'
                                                    onChange={
                                                        handleBadgeImageChange
                                                    }
                                                    className='hidden'
                                                />
                                            </label>
                                            <p className='text-xs text-text/40 mt-1'>
                                                PNG only, auto-resized to
                                                512×512px, max 500KB
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Name */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Badge Name
                                </label>
                                <input
                                    type='text'
                                    value={badgeForm.name}
                                    onChange={(e) =>
                                        setBadgeForm((prev) => ({
                                            ...prev,
                                            name: e.target.value,
                                        }))
                                    }
                                    placeholder='e.g., First Scout'
                                    className='w-full px-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50'
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Description
                                </label>
                                <textarea
                                    value={badgeForm.description}
                                    onChange={(e) =>
                                        setBadgeForm((prev) => ({
                                            ...prev,
                                            description: e.target.value,
                                        }))
                                    }
                                    placeholder='What does this badge represent?'
                                    rows={2}
                                    className='w-full px-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none'
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Category
                                </label>
                                <select
                                    value={badgeForm.category}
                                    onChange={(e) =>
                                        setBadgeForm((prev) => ({
                                            ...prev,
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Form category value
                                            category: e.target.value as any,
                                        }))
                                    }
                                    className='w-full px-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50'
                                >
                                    <option value='achievement'>
                                        Achievement
                                    </option>
                                    <option value='monetary'>Supporter</option>
                                    <option value='social'>Social</option>
                                </select>
                            </div>

                            {/* Rarity */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Rarity
                                </label>
                                <div className='grid grid-cols-3 gap-2'>
                                    {(
                                        ["common", "rare", "legendary"] as const
                                    ).map((rarity) => (
                                        <button
                                            key={rarity}
                                            type='button'
                                            onClick={() =>
                                                setBadgeForm((prev) => ({
                                                    ...prev,
                                                    rarity,
                                                }))
                                            }
                                            className={`px-3 py-2 rounded-lg border text-sm font-medium capitalize transition ${
                                                badgeForm.rarity === rarity
                                                    ? rarity === "legendary"
                                                        ? "bg-amber-500/20 border-amber-500 text-amber-500"
                                                        : rarity === "rare"
                                                          ? "bg-blue-500/20 border-blue-500 text-blue-500"
                                                          : "bg-text/10 border-text/30 text-text"
                                                    : "bg-text/5 border-text/10 text-text/60 hover:bg-text/10"
                                            }`}
                                        >
                                            {rarity}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Error */}
                            {badgeError && (
                                <div className='p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500'>
                                    {badgeError}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className='p-6 border-t border-text/10 flex justify-end gap-3'>
                            <button
                                onClick={closeBadgeModal}
                                disabled={badgeLoading}
                                className='px-4 py-2 bg-text/5 border border-text/10 rounded-lg hover:bg-text/10 transition disabled:opacity-50'
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveBadge}
                                disabled={
                                    badgeLoading || !badgeForm.name.trim()
                                }
                                className='flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50'
                            >
                                {badgeLoading && (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                )}
                                {editingBadge ? "Update Badge" : "Create Badge"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Award Badge Modal */}
            {showAwardModal && awardingBadge && (
                <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
                    <div className='bg-background border border-text/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col'>
                        <div className='p-6 border-b border-text/10'>
                            <h2 className='text-xl font-semibold font-serif'>
                                Award Badge
                            </h2>
                            <p className='text-text/60 text-sm mt-1'>
                                Award &quot;{awardingBadge.name}&quot; to users
                            </p>
                        </div>

                        <div className='p-6 space-y-6 overflow-y-auto flex-1'>
                            {/* Search Users */}
                            <div>
                                <label className='block text-sm font-medium mb-2'>
                                    Search Users
                                </label>
                                <div className='relative'>
                                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                                    <input
                                        type='text'
                                        value={userSearchQuery}
                                        onChange={(e) =>
                                            handleUserSearch(e.target.value)
                                        }
                                        placeholder='Search by username or display name...'
                                        className='w-full pl-10 pr-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50'
                                    />
                                    {searchLoading && (
                                        <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-text/40' />
                                    )}
                                </div>

                                {/* Search Results */}
                                {userSearchResults.length > 0 && (
                                    <div className='mt-2 border border-text/10 rounded-lg divide-y divide-text/10'>
                                        {userSearchResults.map((user) => (
                                            <div
                                                key={user.id}
                                                className='flex items-center gap-3 p-3 hover:bg-text/5'
                                            >
                                                <div className='w-8 h-8 rounded-full bg-text/10 overflow-hidden'>
                                                    {user.avatar_url ? (
                                                        <Image
                                                            src={
                                                                user.avatar_url
                                                            }
                                                            alt={
                                                                user.display_name
                                                            }
                                                            width={32}
                                                            height={32}
                                                            className='object-cover w-full h-full'
                                                        />
                                                    ) : (
                                                        <div className='w-full h-full flex items-center justify-center text-text/30 text-sm'>
                                                            {user.display_name?.[0]?.toUpperCase() ||
                                                                "?"}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className='flex-1 min-w-0'>
                                                    <p className='font-medium truncate'>
                                                        {user.display_name}
                                                    </p>
                                                    <p className='text-xs text-text/40'>
                                                        @{user.username}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        handleAwardBadge(
                                                            user.id
                                                        )
                                                    }
                                                    disabled={awardLoading}
                                                    className='px-3 py-1 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition text-sm disabled:opacity-50'
                                                >
                                                    Award
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {userSearchQuery.length >= 2 &&
                                    userSearchResults.length === 0 &&
                                    !searchLoading && (
                                        <p className='mt-2 text-text/40 text-sm'>
                                            No users found
                                        </p>
                                    )}
                            </div>

                            {/* Bulk Actions */}
                            <div className='pt-4 border-t border-text/10'>
                                <h3 className='text-sm font-medium mb-3'>
                                    Bulk Actions
                                </h3>
                                <button
                                    onClick={handleAwardAll}
                                    disabled={awardLoading || isAwardingAll}
                                    className='w-full px-4 py-3 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition flex items-center justify-center gap-2 font-medium disabled:opacity-50'
                                >
                                    {isAwardingAll ? (
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                    ) : (
                                        <Users className='w-4 h-4' />
                                    )}
                                    Award to All Users
                                </button>
                                <p className='text-xs text-text/40 mt-2 text-center'>
                                    This will grant the badge to every
                                    registered user who doesn&apos;t have it
                                    yet.
                                </p>
                            </div>

                            {/* Users with this Badge */}
                            <div>
                                <h3 className='text-sm font-medium mb-2'>
                                    Users with this Badge ({badgeUsersTotal})
                                </h3>
                                {usersWithBadge.length === 0 ? (
                                    <p className='text-text/40 text-sm'>
                                        No users have this badge yet
                                    </p>
                                ) : (
                                    <>
                                        <div className='border border-text/10 rounded-lg divide-y divide-text/10 max-h-60 overflow-y-auto'>
                                            {usersWithBadge.map((user) => (
                                                <div
                                                    key={user.user_id}
                                                    className='flex items-center gap-3 p-3 hover:bg-text/5'
                                                >
                                                    <div className='w-8 h-8 rounded-full bg-text/10 overflow-hidden'>
                                                        {user.avatar_url ? (
                                                            <Image
                                                                src={
                                                                    user.avatar_url
                                                                }
                                                                alt={
                                                                    user.display_name
                                                                }
                                                                width={32}
                                                                height={32}
                                                                className='object-cover w-full h-full'
                                                            />
                                                        ) : (
                                                            <div className='w-full h-full flex items-center justify-center text-text/30 text-sm'>
                                                                {user.display_name?.[0]?.toUpperCase() ||
                                                                    "?"}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className='flex-1 min-w-0'>
                                                        <p className='font-medium truncate'>
                                                            {user.display_name}
                                                        </p>
                                                        <p className='text-xs text-text/40'>
                                                            @{user.username} •{" "}
                                                            {user.awarded_at &&
                                                                new Date(
                                                                    user.awarded_at
                                                                ).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            handleRevokeBadge(
                                                                user.user_id
                                                            )
                                                        }
                                                        disabled={awardLoading}
                                                        className='px-3 py-1 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition text-sm disabled:opacity-50'
                                                    >
                                                        Revoke
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        {badgeUsersHasMore && (
                                            <button
                                                onClick={loadMoreBadgeUsers}
                                                className='mt-2 w-full text-sm text-primary hover:underline'
                                            >
                                                Load more (
                                                {usersWithBadge.length} of{" "}
                                                {badgeUsersTotal})
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Close Button */}
                        <div className='p-6 border-t border-text/10'>
                            <button
                                onClick={closeAwardModal}
                                className='w-full px-4 py-2 bg-text/5 border border-text/10 rounded-lg hover:bg-text/10 transition'
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Featured Schedule Management */}
            {activeTab === "featured" && (
                <FeaturedScheduleManager
                    initialSchedules={initialFeaturedSchedules}
                />
            )}

            {/* Claims Management */}
            {activeTab === "claims" && (
                <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                        <h2 className='text-xl font-semibold'>
                            Cafe Claim Requests
                        </h2>
                        <p className='text-sm text-text/60'>
                            {claims.length} pending{" "}
                            {claims.length === 1 ? "claim" : "claims"}
                        </p>
                    </div>

                    {claims.length === 0 ? (
                        <div className='text-center py-12 bg-text/5 border border-text/10 rounded-xl'>
                            <Store className='w-12 h-12 mx-auto mb-4 text-text/30' />
                            <p className='text-text/60 font-medium'>
                                No pending claims
                            </p>
                            <p className='text-text/40 text-sm mt-1'>
                                Cafe ownership claims will appear here
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {claims.map((claim) => (
                                <div
                                    key={claim.id}
                                    className='bg-text/5 border border-text/10 rounded-xl overflow-hidden'
                                >
                                    <div
                                        className='p-4 cursor-pointer hover:bg-text/10 transition-colors'
                                        onClick={() =>
                                            setExpandedClaim(
                                                expandedClaim === claim.id
                                                    ? null
                                                    : claim.id
                                            )
                                        }
                                    >
                                        <div className='flex items-start justify-between'>
                                            <div className='flex items-center gap-3'>
                                                {claim.cafe?.thumbnail ? (
                                                    <Image
                                                        src={
                                                            claim.cafe.thumbnail
                                                        }
                                                        alt={
                                                            claim.cafe.name ||
                                                            "Cafe"
                                                        }
                                                        width={48}
                                                        height={48}
                                                        className='rounded-lg object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-12 h-12 bg-text/10 rounded-lg flex items-center justify-center'>
                                                        <Store className='w-6 h-6 text-text/40' />
                                                    </div>
                                                )}
                                                <div>
                                                    <Link
                                                        href={`/cafes/${claim.cafe?.slug || claim.cafe_id}`}
                                                        className='font-semibold hover:text-primary transition-colors'
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        {claim.cafe?.name ||
                                                            "Unknown Cafe"}
                                                    </Link>
                                                    <div className='text-sm text-text/60 flex items-center gap-2'>
                                                        <span>
                                                            Claimed by @
                                                            {claim.user
                                                                ?.username ||
                                                                "unknown"}
                                                        </span>
                                                        <span className='text-text/30'>
                                                            •
                                                        </span>
                                                        <span>
                                                            {claim.created_at
                                                                ? new Date(
                                                                      claim.created_at
                                                                  ).toLocaleDateString()
                                                                : "Unknown date"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className='flex items-center gap-2'>
                                                {processing === claim.id ? (
                                                    <Loader2 className='w-5 h-5 animate-spin' />
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={async (
                                                                e
                                                            ) => {
                                                                e.stopPropagation()
                                                                setProcessing(
                                                                    claim.id
                                                                )
                                                                const result =
                                                                    await approveClaim(
                                                                        claim.id
                                                                    )
                                                                if (
                                                                    result.success
                                                                ) {
                                                                    setClaims(
                                                                        (
                                                                            prev
                                                                        ) =>
                                                                            prev.filter(
                                                                                (
                                                                                    c
                                                                                ) =>
                                                                                    c.id !==
                                                                                    claim.id
                                                                            )
                                                                    )
                                                                } else {
                                                                    alert(
                                                                        result.error ||
                                                                            "Failed to approve"
                                                                    )
                                                                }
                                                                setProcessing(
                                                                    null
                                                                )
                                                            }}
                                                            className='p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition-colors'
                                                            title='Approve claim'
                                                        >
                                                            <Check className='w-4 h-4' />
                                                        </button>
                                                        <button
                                                            onClick={async (
                                                                e
                                                            ) => {
                                                                e.stopPropagation()
                                                                if (
                                                                    !confirm(
                                                                        "Reject this claim?"
                                                                    )
                                                                )
                                                                    return
                                                                setProcessing(
                                                                    claim.id
                                                                )
                                                                const result =
                                                                    await rejectClaim(
                                                                        claim.id
                                                                    )
                                                                if (
                                                                    result.success
                                                                ) {
                                                                    setClaims(
                                                                        (
                                                                            prev
                                                                        ) =>
                                                                            prev.filter(
                                                                                (
                                                                                    c
                                                                                ) =>
                                                                                    c.id !==
                                                                                    claim.id
                                                                            )
                                                                    )
                                                                } else {
                                                                    alert(
                                                                        result.error ||
                                                                            "Failed to reject"
                                                                    )
                                                                }
                                                                setProcessing(
                                                                    null
                                                                )
                                                            }}
                                                            className='p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors'
                                                            title='Reject claim'
                                                        >
                                                            <X className='w-4 h-4' />
                                                        </button>
                                                    </>
                                                )}
                                                {expandedClaim === claim.id ? (
                                                    <ChevronUp className='w-5 h-5 text-text/40' />
                                                ) : (
                                                    <ChevronDown className='w-5 h-5 text-text/40' />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded proof section */}
                                    {expandedClaim === claim.id && (
                                        <div className='border-t border-text/10 p-4 bg-text/5'>
                                            <div className='mb-3'>
                                                <h4 className='text-sm font-medium mb-1'>
                                                    Claimant Details
                                                </h4>
                                                <div className='flex items-center gap-2'>
                                                    {claim.user?.avatar_url ? (
                                                        <Image
                                                            src={
                                                                claim.user
                                                                    .avatar_url
                                                            }
                                                            alt={
                                                                claim.user
                                                                    .display_name ||
                                                                "User"
                                                            }
                                                            width={32}
                                                            height={32}
                                                            className='rounded-full'
                                                        />
                                                    ) : (
                                                        <div className='w-8 h-8 bg-text/20 rounded-full' />
                                                    )}
                                                    <div>
                                                        <p className='font-medium text-sm'>
                                                            {claim.user
                                                                ?.display_name ||
                                                                "Unknown"}
                                                        </p>
                                                        <p className='text-xs text-text/50'>
                                                            @
                                                            {claim.user
                                                                ?.username ||
                                                                "unknown"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className='text-sm font-medium mb-1'>
                                                    Proof of Ownership
                                                </h4>
                                                <p className='text-sm text-text/70 whitespace-pre-wrap bg-background/50 p-3 rounded-lg border border-text/10'>
                                                    {claim.proof_text}
                                                </p>
                                            </div>
                                            {claim.proof_document_url && (
                                                <div className='mt-3'>
                                                    <a
                                                        href={
                                                            claim.proof_document_url
                                                        }
                                                        target='_blank'
                                                        rel='noopener noreferrer'
                                                        className='text-sm text-primary hover:underline flex items-center gap-1'
                                                    >
                                                        <FileText className='w-4 h-4' />
                                                        View attached document
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Team Tab */}
            {activeTab === "team" && (
                <div className='space-y-6'>
                    <div className='flex items-center justify-between'>
                        <h2 className='text-xl font-semibold flex items-center gap-2'>
                            <Users className='w-5 h-5' />
                            Team Management
                        </h2>
                        <button
                            onClick={loadTeamMembers}
                            disabled={teamLoading}
                            className='flex items-center gap-2 px-3 py-2 bg-text/5 border border-text/10 rounded-lg hover:bg-text/10 transition disabled:opacity-50'
                        >
                            {teamLoading ? (
                                <Loader2 className='w-4 h-4 animate-spin' />
                            ) : (
                                <RefreshCw className='w-4 h-4' />
                            )}
                            Refresh
                        </button>
                    </div>

                    {/* Search for users to add */}
                    <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                        <h3 className='font-medium mb-4'>Add Team Member</h3>
                        <div className='relative'>
                            <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40' />
                            <input
                                type='text'
                                value={teamSearchQuery}
                                onChange={(e) =>
                                    handleTeamSearch(e.target.value)
                                }
                                placeholder='Search users by username or display name...'
                                className='w-full pl-12 pr-4 py-3 bg-background border border-text/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                            />
                            {teamSearchLoading && (
                                <Loader2 className='absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40 animate-spin' />
                            )}
                        </div>

                        {/* Search results */}
                        {teamSearchResults.length > 0 && (
                            <div className='mt-4 space-y-2'>
                                {teamSearchResults.map((user) => (
                                    <div
                                        key={user.id}
                                        className='flex items-center justify-between p-3 bg-background border border-text/10 rounded-lg'
                                    >
                                        <div className='flex items-center gap-3'>
                                            {user.avatar_url ? (
                                                <Image
                                                    src={user.avatar_url}
                                                    alt={user.display_name}
                                                    width={40}
                                                    height={40}
                                                    className='rounded-full'
                                                />
                                            ) : (
                                                <div className='w-10 h-10 rounded-full bg-text/10 flex items-center justify-center'>
                                                    <Users className='w-5 h-5 text-text/40' />
                                                </div>
                                            )}
                                            <div>
                                                <p className='font-medium'>
                                                    {user.display_name}
                                                </p>
                                                <p className='text-sm text-text/60'>
                                                    @{user.username}
                                                </p>
                                            </div>
                                            {user.role && (
                                                <span className='px-2 py-1 text-xs rounded-full bg-text/10'>
                                                    {user.role}
                                                </span>
                                            )}
                                        </div>
                                        <div className='flex gap-2'>
                                            <button
                                                onClick={() =>
                                                    handlePromoteUser(
                                                        user.id,
                                                        "moderator"
                                                    )
                                                }
                                                disabled={teamLoading}
                                                className='px-3 py-1.5 text-sm bg-blue-500/20 text-blue-500 rounded-lg hover:bg-blue-500/30 transition disabled:opacity-50'
                                            >
                                                Make Moderator
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Current team members */}
                    <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                        <h3 className='font-medium mb-4'>
                            Current Team ({teamMembers.length})
                        </h3>
                        {teamLoading && teamMembers.length === 0 ? (
                            <div className='flex items-center justify-center py-8'>
                                <Loader2 className='w-6 h-6 animate-spin text-text/40' />
                            </div>
                        ) : teamMembers.length === 0 ? (
                            <p className='text-text/60 text-center py-8'>
                                No team members found
                            </p>
                        ) : (
                            <div className='space-y-2'>
                                {teamMembers.map((member) => (
                                    <div
                                        key={member.id}
                                        className='flex items-center justify-between p-4 bg-background border border-text/10 rounded-lg'
                                    >
                                        <div className='flex items-center gap-3'>
                                            {member.avatar_url ? (
                                                <Image
                                                    src={member.avatar_url}
                                                    alt={member.display_name}
                                                    width={48}
                                                    height={48}
                                                    className='rounded-full'
                                                />
                                            ) : (
                                                <div className='w-12 h-12 rounded-full bg-text/10 flex items-center justify-center'>
                                                    <Users className='w-6 h-6 text-text/40' />
                                                </div>
                                            )}
                                            <div>
                                                <p className='font-medium'>
                                                    {member.display_name}
                                                </p>
                                                <p className='text-sm text-text/60'>
                                                    @{member.username}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-3 py-1 text-sm rounded-full ${
                                                    member.role === "admin"
                                                        ? "bg-red-500/20 text-red-500"
                                                        : "bg-blue-500/20 text-blue-500"
                                                }`}
                                            >
                                                {member.role}
                                            </span>
                                        </div>
                                        {member.role === "moderator" && (
                                            <button
                                                onClick={() =>
                                                    handleDemoteUser(member.id)
                                                }
                                                disabled={teamLoading}
                                                className='px-3 py-1.5 text-sm bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
