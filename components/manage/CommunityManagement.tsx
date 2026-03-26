"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { UserAvatar } from "@/components/ui/UserAvatar"
import Link from "next/link"
import {
    Check,
    X,
    ChevronDown,
    ChevronUp,
    EyeOff,
    Trash2,
    Loader2,
    Flag,
    Star,
    Users,
    ExternalLink,
    Search,
    Shield,
    ShieldCheck,
    PenTool,
    Calendar,
    MapPin,
    History,
    Filter,
    LayoutGrid,
    List,
    FileText,
} from "lucide-react"
import {
    moderateReview,
    deleteReviewAsAdmin,
    type ReviewForModeration,
    type TeamMember,
    searchUsersForRoleAssignment,
    updateUserRole,
    getAdminsAndModerators,
} from "@/app/api/actions/admin"
import {
    getPendingEvents,
    approveCommunityEvent,
    rejectCommunityEvent,
} from "@/app/api/actions/events"
import {
    getSystemLogs,
    type SystemLog,
} from "@/app/api/actions/system-logs"
import { EventWithCafe } from "@/utils/types/extra"
import { format } from "date-fns"
import { PHILIPPINES_LOCATIONS } from "@/utils/data/philippines"
import { updateModeratorRegions } from "@/app/api/actions/admin"
import ActionConfirmationModal from "@/components/ui/ActionConfirmationModal"
import { useActionConfirmation } from "@/hooks/useActionConfirmation"
import { type SensitiveAction } from "@/lib/action-confirmation"

interface CommunityManagementProps {
    userRole: "admin" | "moderator"
    reportedReviews: ReviewForModeration[]
    isFullAdmin: boolean
}

type TabType = "reviews" | "events" | "team"
type RoleType = "all" | "admin" | "moderator" | "writer" | "user"
type ViewMode = "list" | "grid"

// Permissions matrix definition
interface Permission {
    name: string
    user: boolean
    writer: boolean
    moderator: boolean
    admin: boolean
}

const PERMISSIONS: Permission[] = [
    { name: "View cafes", user: true, writer: true, moderator: true, admin: true },
    { name: "Submit reviews", user: true, writer: true, moderator: true, admin: true },
    { name: "Create blog posts", user: false, writer: true, moderator: true, admin: true },
    { name: "Edit own content", user: false, writer: true, moderator: true, admin: true },
    { name: "Moderate reviews", user: false, writer: false, moderator: true, admin: true },
    { name: "Manage events", user: false, writer: false, moderator: true, admin: true },
    { name: "Assign regions", user: false, writer: false, moderator: true, admin: true },
    { name: "Manage users", user: false, writer: false, moderator: false, admin: true },
    { name: "Change roles", user: false, writer: false, moderator: false, admin: true },
    { name: "View system logs", user: false, writer: false, moderator: false, admin: true },
    { name: "Delete any content", user: false, writer: false, moderator: false, admin: true },
]

const ACTION_COLORS: Record<string, string> = {
    create: "text-green-600 bg-green-500/20",
    update: "text-blue-600 bg-blue-500/20",
    delete: "text-red-600 bg-red-500/20",
    approve: "text-emerald-600 bg-emerald-500/20",
    reject: "text-orange-600 bg-orange-500/20",
    role_change: "text-purple-600 bg-purple-500/20",
}

const ACTION_LABELS: Record<string, string> = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    approve: "Approved",
    reject: "Rejected",
    role_change: "Role Changed",
}

const ENTITY_ICONS: Record<string, string> = {
    cafe: "☕",
    blog: "📝",
    event: "📅",
    user: "👤",
    featured: "⭐",
    review: "💬",
}

export default function CommunityManagement({
    reportedReviews: initialReported,
    isFullAdmin,
}: CommunityManagementProps) {
    const [activeTab, setActiveTab] = useState<TabType>("reviews")
    const [reportedReviews, setReportedReviews] = useState(initialReported)
    const [expandedReview, setExpandedReview] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | null>(null)

    // Action confirmation hook
    const { requestConfirmation, isModalOpen, pendingAction, closeModal, handleConfirmed } = useActionConfirmation()

    // Team management state
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [teamSearchQuery, setTeamSearchQuery] = useState("")
    const [teamSearchResults, setTeamSearchResults] = useState<TeamMember[]>([])
    const [teamLoading, setTeamLoading] = useState(false)
    const [teamSearchLoading, setTeamSearchLoading] = useState(false)
    const [editingRegionsFor, setEditingRegionsFor] = useState<string | null>(null)
    const [selectedRegions, setSelectedRegions] = useState<string[]>([])
    const [savingRegions, setSavingRegions] = useState(false)

    // Task 15, 16, 17: New team view state
    const [roleFilter, setRoleFilter] = useState<RoleType>("all")
    const [teamViewSearch, setTeamViewSearch] = useState("")
    const [viewMode, setViewMode] = useState<ViewMode>("list")
    const [groupByRole, setGroupByRole] = useState(false)
    const [showPermissionsMatrix, setShowPermissionsMatrix] = useState(false)

    // Activity log modal state
    const [activityLogModalOpen, setActivityLogModalOpen] = useState(false)
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
    const [selectedMemberName, setSelectedMemberName] = useState<string>("")
    const [activityLogs, setActivityLogs] = useState<SystemLog[]>([])
    const [activityLogsLoading, setActivityLogsLoading] = useState(false)
    const [activityLogsPage, setActivityLogsPage] = useState(1)
    const [activityLogsTotal, setActivityLogsTotal] = useState(0)

    const regionOptions = PHILIPPINES_LOCATIONS.regions.map((r) => r.name)

    // Filter and group team members
    const filteredMembers = teamMembers.filter((member) => {
        const matchesRole = roleFilter === "all" || member.role === roleFilter
        const matchesSearch =
            teamViewSearch === "" ||
            member.display_name?.toLowerCase().includes(teamViewSearch.toLowerCase()) ||
            member.username?.toLowerCase().includes(teamViewSearch.toLowerCase())
        return matchesRole && matchesSearch
    })

    const groupedMembers = groupByRole
        ? {
              admin: filteredMembers.filter((m) => m.role === "admin"),
              moderator: filteredMembers.filter((m) => m.role === "moderator"),
              writer: filteredMembers.filter((m) => m.role === "writer"),
          }
        : null

    // Activity log handlers
    const handleViewActivityLog = useCallback(async (member: TeamMember) => {
        setSelectedMemberId(member.id)
        setSelectedMemberName(member.display_name || member.username || "Unknown")
        setActivityLogModalOpen(true)
        setActivityLogsLoading(true)
        setActivityLogsPage(1)

        const result = await getSystemLogs({ userId: member.id }, 1, 50)
        setActivityLogs(result.logs)
        setActivityLogsTotal(result.total)
        setActivityLogsLoading(false)
    }, [])

    const loadMoreActivityLogs = useCallback(async () => {
        if (!selectedMemberId) return
        setActivityLogsLoading(true)
        const nextPage = activityLogsPage + 1
        const result = await getSystemLogs({ userId: selectedMemberId }, nextPage, 50)
        setActivityLogs((prev) => [...prev, ...result.logs])
        setActivityLogsPage(nextPage)
        setActivityLogsLoading(false)
    }, [selectedMemberId, activityLogsPage])

    const handleCloseActivityLog = () => {
        setActivityLogModalOpen(false)
        setSelectedMemberId(null)
        setSelectedMemberName("")
        setActivityLogs([])
        setActivityLogsPage(1)
        setActivityLogsTotal(0)
    }

    // Pending events state
    const [pendingEvents, setPendingEvents] = useState<EventWithCafe[]>([])
    const [eventsLoading, setEventsLoading] = useState(false)
    const [processingEvent, setProcessingEvent] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState("")
    const [showRejectModal, setShowRejectModal] = useState<string | null>(null)

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

    const executeDeleteReview = async (reviewId: string) => {
        setProcessing(reviewId)
        const result = await deleteReviewAsAdmin(reviewId)
        if (result.success) {
            setReportedReviews((prev) => prev.filter((r) => r.id !== reviewId))
        } else {
            alert(result.error || "Failed to delete review")
        }
        setProcessing(null)
    }

    const handleDeleteReview = async (reviewId: string) => {
        const confirmed = await requestConfirmation(
            "review:delete" as SensitiveAction,
            "Delete Review",
            "This will permanently delete the review and all associated images. This action cannot be undone."
        )
        if (confirmed) {
            await executeDeleteReview(reviewId)
        }
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
        const filtered = results.filter(
            (u) => !teamMembers.some((tm) => tm.id === u.id)
        )
        setTeamSearchResults(filtered)
        setTeamSearchLoading(false)
    }

    const executePromoteUser = async (
        userId: string,
        role: "writer" | "moderator" | "admin"
    ) => {
        setTeamLoading(true)
        const result = await updateUserRole(userId, role)
        if (result.success) {
            await loadTeamMembers()
            setTeamSearchResults((prev) => prev.filter((u) => u.id !== userId))
        } else {
            alert(result.error || "Failed to update user role")
        }
        setTeamLoading(false)
    }

    const handlePromoteUser = async (
        userId: string,
        role: "writer" | "moderator" | "admin"
    ) => {
        // Admin role changes require confirmation
        if (role === "admin") {
            const confirmed = await requestConfirmation(
                "user:role-change" as SensitiveAction,
                `Promote to ${role}`,
                `You are about to grant admin privileges to a user. This is a sensitive action that requires verification.`
            )
            if (confirmed) {
                await executePromoteUser(userId, role)
            }
        } else {
            // Writer and moderator don't require confirmation
            await executePromoteUser(userId, role)
        }
    }

    const executeDemoteUser = async (userId: string) => {
        setTeamLoading(true)
        const result = await updateUserRole(userId, "user")
        if (result.success) {
            await loadTeamMembers()
        } else {
            alert(result.error || "Failed to demote user")
        }
        setTeamLoading(false)
    }

    const handleDemoteUser = async (userId: string, currentRole?: string) => {
        // Demoting admins requires confirmation
        if (currentRole === "admin") {
            const confirmed = await requestConfirmation(
                "user:role-change" as SensitiveAction,
                "Remove Admin",
                "You are about to remove admin privileges from a user. This is a sensitive action that requires verification."
            )
            if (confirmed) {
                await executeDemoteUser(userId)
            }
        } else {
            // Demoting writers/moderators from search results doesn't require confirmation
            const confirmed = window.confirm("Are you sure you want to remove this user from the team?")
            if (confirmed) {
                await executeDemoteUser(userId)
            }
        }
    }

    // Region management handlers
    const handleEditRegions = (member: TeamMember) => {
        if (member.role !== "moderator") return
        setEditingRegionsFor(member.id)
        setSelectedRegions(member.moderator_regions || [])
    }

    const handleToggleRegion = (region: string) => {
        setSelectedRegions((prev) =>
            prev.includes(region)
                ? prev.filter((r) => r !== region)
                : [...prev, region]
        )
    }

    const handleSaveRegions = async (userId: string) => {
        setSavingRegions(true)
        const result = await updateModeratorRegions(userId, selectedRegions)
        if (result.success) {
            setEditingRegionsFor(null)
            setSelectedRegions([])
            await loadTeamMembers()
        } else {
            alert(result.error || "Failed to update regions")
        }
        setSavingRegions(false)
    }

    const handleClearRegions = () => {
        setSelectedRegions([])
    }

    const handleCancelEditRegions = () => {
        setEditingRegionsFor(null)
        setSelectedRegions([])
    }

    // Load team members when Team tab is selected
    useEffect(() => {
        if (activeTab === "team" && teamMembers.length === 0 && isFullAdmin) {
            // Use an IIFE to avoid lint warning about calling setState in effect
            void loadTeamMembers()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, isFullAdmin])

    // Pending events handlers
    const loadPendingEvents = async () => {
        setEventsLoading(true)
        const events = await getPendingEvents()
        setPendingEvents(events)
        setEventsLoading(false)
    }

    const handleApproveEvent = async (eventId: string) => {
        setProcessingEvent(eventId)
        const result = await approveCommunityEvent(eventId)
        if (result.success) {
            setPendingEvents((prev) => prev.filter((e) => e.id !== eventId))
        } else {
            alert(result.error || "Failed to approve event")
        }
        setProcessingEvent(null)
    }

    const handleRejectEvent = async (eventId: string) => {
        setProcessingEvent(eventId)
        const result = await rejectCommunityEvent(
            eventId,
            rejectReason || undefined
        )
        if (result.success) {
            setPendingEvents((prev) => prev.filter((e) => e.id !== eventId))
            setShowRejectModal(null)
            setRejectReason("")
        } else {
            alert(result.error || "Failed to reject event")
        }
        setProcessingEvent(null)
    }

    // Load pending events when Events tab is selected
    useEffect(() => {
        if (activeTab === "events" && pendingEvents.length === 0) {
            void loadPendingEvents()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab])

    return (
        <div className='space-y-6'>
            {/* Header */}
            <div>
                <h1 className='text-2xl md:text-3xl font-bold text-text'>
                    Community Management
                </h1>
                <p className='text-text/60 mt-1'>
                    Moderate reviews and manage team members.
                </p>
            </div>

            {/* Stats */}
            <div className='grid grid-cols-2 gap-4'>
                <div
                    className={`bg-background shadow-sm rounded-xl p-4 border ${
                        reportedReviews.length > 0
                            ? "border-red-500/30"
                            : "border-tertiary/50"
                    }`}
                >
                    <div
                        className={`text-2xl font-bold ${
                            reportedReviews.length > 0 ? "text-red-500" : ""
                        }`}
                    >
                        {reportedReviews.length}
                    </div>
                    <div className='text-text/60 text-sm'>Reported Reviews</div>
                </div>
                <div
                    className={`bg-background shadow-sm rounded-xl p-4 border ${
                        pendingEvents.length > 0
                            ? "border-orange-500/30"
                            : "border-tertiary/50"
                    }`}
                >
                    <div
                        className={`text-2xl font-bold ${
                            pendingEvents.length > 0 ? "text-orange-500" : ""
                        }`}
                    >
                        {pendingEvents.length}
                    </div>
                    <div className='text-text/60 text-sm'>Pending Events</div>
                </div>
                {isFullAdmin && (
                    <div className='bg-background rounded-xl p-4 shadow-sm border border-tertiary/50'>
                        <div className='text-2xl font-bold'>
                            {teamMembers.length}
                        </div>
                        <div className='text-text/60 text-sm'>Team Members</div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className='flex gap-2 overflow-x-auto py-1'>
                <button
                    onClick={() => setActiveTab("reviews")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "reviews"
                            ? "bg-primary text-white"
                            : reportedReviews.length > 0
                              ? "bg-red-500/20 text-red-700 hover:bg-red-500/30"
                              : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Flag className='w-4 h-4' />
                    Reviews ({reportedReviews.length})
                </button>
                <button
                    onClick={() => setActiveTab("events")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                        activeTab === "events"
                            ? "bg-primary text-white"
                            : pendingEvents.length > 0
                              ? "bg-orange-500/20 text-orange-700 hover:bg-orange-500/30"
                              : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                    }`}
                >
                    <Calendar className='w-4 h-4' />
                    Events ({pendingEvents.length})
                </button>
                {isFullAdmin && (
                    <button
                        onClick={() => setActiveTab("team")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                            activeTab === "team"
                                ? "bg-primary text-white"
                                : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                        }`}
                    >
                        <Users className='w-4 h-4' />
                        Team
                    </button>
                )}
            </div>

            {/* Reviews Tab */}
            {activeTab === "reviews" && (
                <>
                    {reportedReviews.length === 0 ? (
                        <div className='text-center py-16'>
                            <Check className='w-12 h-12 mx-auto text-green-500 mb-4' />
                            <p className='text-text/60 text-lg'>
                                No flagged reviews
                            </p>
                            <p className='text-text/40 text-sm mt-1'>
                                All reviews are in good standing!
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {reportedReviews.map((review) => {
                                const isExpanded = expandedReview === review.id
                                const isProcessingThis =
                                    processing === review.id

                                return (
                                    <div
                                        key={review.id}
                                        className='bg-background border border-red-500/20 rounded-xl overflow-hidden shadow-sm'
                                    >
                                        {/* Main Row */}
                                        <div className='p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4'>
                                            {/* Author Avatar */}
                                            <UserAvatar
                                                src={review.author?.avatar_url}
                                                alt={review.author?.display_name || "User"}
                                                size={48}
                                                className='shrink-0'
                                            />

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
                                                        className='text-primary hover:underline'
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
                                            <div className='flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap'>
                                                <button
                                                    onClick={() =>
                                                        handleApproveReview(
                                                            review.id
                                                        )
                                                    }
                                                    disabled={isProcessingThis}
                                                    className='p-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
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
                                                    className='p-2 bg-orange-500/20 text-orange-600 rounded-lg hover:bg-orange-500/30 transition disabled:opacity-50'
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
                                                    className='p-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
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
                                                    className='p-2 bg-tertiary/30 rounded-lg hover:bg-tertiary transition'
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
                                            <div className='border-t border-tertiary/50 p-4 space-y-4 bg-tertiary/10'>
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

                                                {/* Links */}
                                                {review.cafe && (
                                                    <div className='pt-2 flex gap-4 flex-wrap'>
                                                        <Link
                                                            href={`/cafes/${review.cafe.slug}`}
                                                            className='text-sm text-primary hover:underline inline-flex items-center gap-1'
                                                        >
                                                            View cafe page{" "}
                                                            <ExternalLink className='w-3 h-3' />
                                                        </Link>
                                                        {review.author && (
                                                            <Link
                                                                href={`/profile/${review.author.username}`}
                                                                className='text-sm text-primary hover:underline inline-flex items-center gap-1'
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

            {/* Events Tab */}
            {activeTab === "events" && (
                <>
                    {eventsLoading && pendingEvents.length === 0 ? (
                        <div className='flex items-center justify-center py-16'>
                            <Loader2 className='w-8 h-8 animate-spin text-text opacity-40' />
                        </div>
                    ) : pendingEvents.length === 0 ? (
                        <div className='text-center py-16'>
                            <Check className='w-12 h-12 mx-auto text-green-500 mb-4' />
                            <p className='text-text/60 text-lg'>
                                No pending event submissions
                            </p>
                            <p className='text-text/40 text-sm mt-1'>
                                All community event submissions have been
                                reviewed!
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {pendingEvents.map((event) => {
                                const isProcessingThis =
                                    processingEvent === event.id

                                return (
                                    <div
                                        key={event.id}
                                        className='bg-background border border-orange-500/20 rounded-xl overflow-hidden shadow-sm'
                                    >
                                        <div className='p-4 flex flex-col sm:flex-row gap-4'>
                                            {/* Event Image */}
                                            {event.image_url && (
                                                <div className='relative w-full sm:w-32 h-24 shrink-0 rounded-lg overflow-hidden bg-tertiary/30'>
                                                    <Image
                                                        src={event.image_url}
                                                        alt={event.title}
                                                        fill
                                                        className='object-cover'
                                                    />
                                                </div>
                                            )}

                                            {/* Event Info */}
                                            <div className='flex-1 min-w-0'>
                                                <h3 className='font-semibold text-lg'>
                                                    {event.title}
                                                </h3>
                                                <div className='flex items-center gap-2 text-sm text-text/60 mt-1'>
                                                    <Calendar className='w-4 h-4' />
                                                    {format(
                                                        new Date(
                                                            event.start_date
                                                        ),
                                                        "PPP 'at' p"
                                                    )}
                                                </div>
                                                <div className='flex items-center gap-2 text-sm text-text/60 mt-1'>
                                                    <MapPin className='w-4 h-4' />
                                                    {event.location_name}
                                                    {event.city &&
                                                        `, ${event.city}`}
                                                </div>
                                                {event.description && (
                                                    <p className='text-sm text-text/70 mt-2 line-clamp-2'>
                                                        {event.description}
                                                    </p>
                                                )}
                                                <div className='flex items-center gap-2 mt-2'>
                                                    {event.creator && (
                                                        <span className='text-xs text-text/50'>
                                                            Submitted by @
                                                            {
                                                                event.creator
                                                                    .display_name
                                                            }
                                                        </span>
                                                    )}
                                                    {event.ticket_link && (
                                                        <Link
                                                            href={
                                                                event.ticket_link
                                                            }
                                                            target='_blank'
                                                            className='text-xs text-primary hover:underline inline-flex items-center gap-1'
                                                        >
                                                            View Link{" "}
                                                            <ExternalLink className='w-3 h-3' />
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className='flex items-center gap-2 shrink-0 self-end sm:self-center'>
                                                <button
                                                    onClick={() =>
                                                        handleApproveEvent(
                                                            event.id
                                                        )
                                                    }
                                                    disabled={isProcessingThis}
                                                    className='p-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
                                                    title='Approve Event'
                                                >
                                                    {isProcessingThis ? (
                                                        <Loader2 className='w-5 h-5 animate-spin' />
                                                    ) : (
                                                        <Check className='w-5 h-5' />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setShowRejectModal(
                                                            event.id
                                                        )
                                                    }
                                                    disabled={isProcessingThis}
                                                    className='p-2 bg-red-500/20 text-red-600 rounded-lg hover:bg-red-500/30 transition disabled:opacity-50'
                                                    title='Reject Event'
                                                >
                                                    <X className='w-5 h-5' />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Reject Modal */}
                    {showRejectModal && (
                        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
                            <div className='bg-background rounded-2xl p-6 max-w-md w-full'>
                                <h3 className='text-lg font-semibold mb-4'>
                                    Reject Event
                                </h3>
                                <p className='text-sm text-text/60 mb-4'>
                                    Optionally provide a reason for rejection.
                                    This will be sent to the submitter.
                                </p>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) =>
                                        setRejectReason(e.target.value)
                                    }
                                    placeholder='Reason for rejection (optional)...'
                                    rows={3}
                                    className='w-full px-4 py-3 rounded-xl border border-text/20 focus:border-primary outline-none resize-none mb-4'
                                />
                                <div className='flex gap-3 justify-end'>
                                    <button
                                        onClick={() => {
                                            setShowRejectModal(null)
                                            setRejectReason("")
                                        }}
                                        className='px-4 py-2 rounded-lg bg-tertiary/30 hover:bg-tertiary transition'
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleRejectEvent(showRejectModal)
                                        }
                                        disabled={
                                            processingEvent === showRejectModal
                                        }
                                        className='px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2'
                                    >
                                        {processingEvent ===
                                            showRejectModal && (
                                            <Loader2 className='w-4 h-4 animate-spin' />
                                        )}
                                        Reject Event
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Team Tab */}
            {activeTab === "team" && isFullAdmin && (
                <div className='space-y-6'>
                    {/* Search for users */}
                    <div className='bg-background rounded-xl p-4 shadow-sm border border-tertiary/50'>
                        <h3 className='font-semibold mb-3'>Add Team Member</h3>
                        <div className='relative'>
                            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                            <input
                                type='text'
                                value={teamSearchQuery}
                                onChange={(e) =>
                                    handleTeamSearch(e.target.value)
                                }
                                placeholder='Search users by username or email...'
                                className='w-full pl-10 pr-4 py-2 bg-tertiary/20 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm'
                            />
                            {teamSearchLoading && (
                                <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-text opacity-40' />
                            )}
                        </div>

                        {/* Search Results */}
                        {teamSearchResults.length > 0 && (
                            <div className='mt-3 space-y-2'>
                                {teamSearchResults.map((user) => (
                                    <div
                                        key={user.id}
                                        className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-tertiary/10 rounded-lg'
                                    >
                                        <UserAvatar
                                            src={user.avatar_url}
                                            alt={user.display_name}
                                            size={40}
                                            className='shrink-0'
                                        />
                                        <div className='flex-1 min-w-0'>
                                            <div className='font-medium truncate'>
                                                {user.display_name}
                                            </div>
                                            <div className='text-sm text-text/60 truncate'>
                                                @{user.username}
                                            </div>
                                        </div>
                                        <div className='flex gap-2 self-end sm:self-center'>
                                            <button
                                                onClick={() =>
                                                    handlePromoteUser(
                                                        user.id,
                                                        "writer"
                                                    )
                                                }
                                                disabled={teamLoading}
                                                className='px-3 py-1.5 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition text-sm disabled:opacity-50'
                                            >
                                                Writer
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handlePromoteUser(
                                                        user.id,
                                                        "moderator"
                                                    )
                                                }
                                                disabled={teamLoading}
                                                className='px-3 py-1.5 bg-blue-500/20 text-blue-600 rounded-lg hover:bg-blue-500/30 transition text-sm disabled:opacity-50'
                                            >
                                                Moderator
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handlePromoteUser(
                                                        user.id,
                                                        "admin"
                                                    )
                                                }
                                                disabled={teamLoading}
                                                className='px-3 py-1.5 bg-amber-500/20 text-amber-600 rounded-lg hover:bg-amber-500/30 transition text-sm disabled:opacity-50'
                                            >
                                                Admin
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Current Team Members - Enhanced with filtering */}
                    <div>
                        {/* Header with filters */}
                        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4'>
                            <h3 className='font-semibold'>Current Team ({filteredMembers.length})</h3>
                            <div className='flex flex-wrap items-center gap-2'>
                                {/* Search */}
                                <div className='relative'>
                                    <Search className='absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text/40' />
                                    <input
                                        type='text'
                                        value={teamViewSearch}
                                        onChange={(e) => setTeamViewSearch(e.target.value)}
                                        placeholder='Search team...'
                                        className='pl-7 pr-3 py-1.5 bg-tertiary/20 border border-tertiary/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-40'
                                    />
                                </div>

                                {/* Role filter */}
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value as RoleType)}
                                    className='px-3 py-1.5 bg-tertiary/20 border border-tertiary/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
                                >
                                    <option value='all'>All Roles</option>
                                    <option value='admin'>Admin</option>
                                    <option value='moderator'>Moderator</option>
                                    <option value='writer'>Writer</option>
                                </select>

                                {/* View mode toggle */}
                                <div className='flex items-center bg-tertiary/20 rounded-lg p-0.5'>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-tertiary/30'}`}
                                        title='List view'
                                    >
                                        <List className='w-4 h-4' />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-tertiary/30'}`}
                                        title='Grid view'
                                    >
                                        <LayoutGrid className='w-4 h-4' />
                                    </button>
                                </div>

                                {/* Group by role toggle */}
                                <button
                                    onClick={() => setGroupByRole(!groupByRole)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${groupByRole ? 'bg-primary/20 text-primary' : 'bg-tertiary/20 hover:bg-tertiary/30'}`}
                                >
                                    <Filter className='w-3.5 h-3.5' />
                                    Group by Role
                                </button>

                                {/* Permissions matrix toggle */}
                                <button
                                    onClick={() => setShowPermissionsMatrix(!showPermissionsMatrix)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${showPermissionsMatrix ? 'bg-primary/20 text-primary' : 'bg-tertiary/20 hover:bg-tertiary/30'}`}
                                >
                                    <Shield className='w-3.5 h-3.5' />
                                    Permissions
                                </button>
                            </div>
                        </div>

                        {/* Permissions Matrix */}
                        {showPermissionsMatrix && (
                            <div className='bg-background rounded-xl border border-tertiary/50 p-4 mb-4 overflow-x-auto'>
                                <h4 className='font-semibold mb-3 text-sm'>Role Permissions Matrix</h4>
                                <table className='w-full text-sm'>
                                    <thead>
                                        <tr className='border-b border-tertiary/50'>
                                            <th className='text-left py-2 px-2 font-medium text-text/60'>Permission</th>
                                            <th className='text-center py-2 px-2 font-medium text-text/60'>User</th>
                                            <th className='text-center py-2 px-2 font-medium text-text/60'>Writer</th>
                                            <th className='text-center py-2 px-2 font-medium text-text/60'>Moderator</th>
                                            <th className='text-center py-2 px-2 font-medium text-amber-600'>Admin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {PERMISSIONS.map((perm) => (
                                            <tr key={perm.name} className='border-b border-tertiary/30 last:border-0'>
                                                <td className='py-2 px-2'>{perm.name}</td>
                                                <td className='text-center py-2 px-2'>
                                                    {perm.user ? <Check className='w-4 h-4 mx-auto text-green-500' /> : <X className='w-4 h-4 mx-auto text-text/20' />}
                                                </td>
                                                <td className='text-center py-2 px-2'>
                                                    {perm.writer ? <Check className='w-4 h-4 mx-auto text-green-500' /> : <X className='w-4 h-4 mx-auto text-text/20' />}
                                                </td>
                                                <td className='text-center py-2 px-2'>
                                                    {perm.moderator ? <Check className='w-4 h-4 mx-auto text-green-500' /> : <X className='w-4 h-4 mx-auto text-text/20' />}
                                                </td>
                                                <td className='text-center py-2 px-2'>
                                                    {perm.admin ? <Check className='w-4 h-4 mx-auto text-green-500' /> : <X className='w-4 h-4 mx-auto text-text/20' />}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Team Members List */}
                        {teamLoading && teamMembers.length === 0 ? (
                            <div className='flex items-center justify-center py-8'>
                                <Loader2 className='w-6 h-6 animate-spin text-text opacity-40' />
                            </div>
                        ) : filteredMembers.length === 0 ? (
                            <div className='text-center py-8 bg-background rounded-xl border border-tertiary/50'>
                                <Users className='w-10 h-10 mx-auto text-text opacity-30 mb-2' />
                                <p className='text-text/60'>No team members found</p>
                            </div>
                        ) : groupByRole && groupedMembers ? (
                            // Grouped view
                            <div className='space-y-4'>
                                {(['admin', 'moderator', 'writer'] as const).map((role) => (
                                    groupedMembers[role].length > 0 && (
                                        <div key={role}>
                                            <h4 className='text-sm font-medium text-text/60 mb-2 capitalize flex items-center gap-2'>
                                                {role === 'admin' && <ShieldCheck className='w-4 h-4 text-amber-500' />}
                                                {role === 'moderator' && <Shield className='w-4 h-4 text-blue-500' />}
                                                {role === 'writer' && <PenTool className='w-4 h-4 text-green-500' />}
                                                {role}s ({groupedMembers[role].length})
                                            </h4>
                                            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2'}>
                                                {groupedMembers[role].map((member) => (
                                                    <div
                                                        key={member.id}
                                                        className={`bg-background rounded-xl border border-tertiary/50 ${viewMode === 'grid' ? 'p-4' : 'p-3'}`}
                                                    >
                                                        {/* Member Header */}
                                                        <div className={`flex ${viewMode === 'grid' ? 'flex-col items-center text-center' : 'flex-col sm:flex-row sm:items-center'} gap-3`}>
                                                            <UserAvatar
                                                                src={member.avatar_url}
                                                                alt={member.display_name}
                                                                size={viewMode === 'grid' ? 56 : 40}
                                                                className='shrink-0'
                                                            />
                                                            <div className='flex-1 min-w-0'>
                                                                <div className={`font-medium truncate flex ${viewMode === 'grid' ? 'justify-center' : ''} items-center gap-2`}>
                                                                    {member.display_name}
                                                                    {member.role === "admin" ? (
                                                                        <ShieldCheck className='w-4 h-4 text-amber-500' />
                                                                    ) : member.role === "moderator" ? (
                                                                        <Shield className='w-4 h-4 text-blue-500' />
                                                                    ) : (
                                                                        <PenTool className='w-4 h-4 text-green-500' />
                                                                    )}
                                                                </div>
                                                                <div className='text-sm text-text/60 truncate'>
                                                                    @{member.username}
                                                                </div>
                                                                {member.created_at && (
                                                                    <div className='text-xs text-text/40 mt-1'>
                                                                        Joined {format(new Date(member.created_at), 'MMM yyyy')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className={`flex items-center gap-2 ${viewMode === 'grid' ? 'flex-wrap justify-center' : 'self-end sm:self-center'}`}>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                    member.role === "admin"
                                                                        ? "bg-amber-500/20 text-amber-600"
                                                                        : member.role === "moderator"
                                                                            ? "bg-blue-500/20 text-blue-600"
                                                                            : "bg-green-500/20 text-green-600"
                                                                }`}>
                                                                    {member.role === "admin" ? "Admin" : member.role === "moderator" ? "Moderator" : "Writer"}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleViewActivityLog(member)}
                                                                    disabled={teamLoading}
                                                                    className='p-1.5 text-primary hover:bg-primary/10 rounded-lg transition disabled:opacity-50'
                                                                    title='View activity log'
                                                                >
                                                                    <History className='w-4 h-4' />
                                                                </button>
                                                                {member.role === "moderator" && (
                                                                    <button
                                                                        onClick={() => handleEditRegions(member)}
                                                                        disabled={teamLoading}
                                                                        className='p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition disabled:opacity-50'
                                                                        title='Edit regions'
                                                                    >
                                                                        <MapPin className='w-4 h-4' />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDemoteUser(member.id, member.role || undefined)}
                                                                    disabled={teamLoading}
                                                                    className='p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50'
                                                                    title='Remove from team'
                                                                >
                                                                    <X className='w-4 h-4' />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Region display for moderators */}
                                                        {member.role === "moderator" && (
                                                            <div className={`text-sm ${viewMode === 'grid' ? 'text-center mt-3' : 'mt-2'}`}>
                                                                <span className='text-text/60'>Regions: </span>
                                                                <span className='text-text/80'>
                                                                    {!member.moderator_regions || member.moderator_regions.length === 0
                                                                        ? "All regions"
                                                                        : member.moderator_regions.join(", ")}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Region editor */}
                                                        {editingRegionsFor === member.id && (
                                                            <div className='border-t border-tertiary/50 pt-3 mt-3'>
                                                                <h4 className='text-sm font-medium mb-2'>Assign Regions</h4>
                                                                <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto mb-3'>
                                                                    {regionOptions.map((region) => (
                                                                        <label
                                                                            key={region}
                                                                            className='flex items-center gap-2 p-2 bg-tertiary/10 rounded-lg cursor-pointer hover:bg-tertiary/20 transition'
                                                                        >
                                                                            <input
                                                                                type='checkbox'
                                                                                checked={selectedRegions.includes(region)}
                                                                                onChange={() => handleToggleRegion(region)}
                                                                                className='w-4 h-4 rounded border-text/20 text-primary focus:ring-primary'
                                                                            />
                                                                            <span className='text-sm'>{region}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                                <div className='flex items-center gap-2'>
                                                                    <button
                                                                        onClick={() => handleSaveRegions(member.id)}
                                                                        disabled={savingRegions}
                                                                        className='px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm disabled:opacity-50 flex items-center gap-1.5'
                                                                    >
                                                                        {savingRegions ? (
                                                                            <Loader2 className='w-3.5 h-3.5 animate-spin' />
                                                                        ) : (
                                                                            <Check className='w-3.5 h-3.5' />
                                                                        )}
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={handleClearRegions}
                                                                        disabled={savingRegions}
                                                                        className='px-3 py-1.5 bg-tertiary/30 text-text/70 rounded-lg hover:bg-tertiary/50 transition text-sm disabled:opacity-50'
                                                                    >
                                                                        Clear
                                                                    </button>
                                                                    <button
                                                                        onClick={handleCancelEditRegions}
                                                                        disabled={savingRegions}
                                                                        className='px-3 py-1.5 text-text/60 hover:text-text transition text-sm disabled:opacity-50'
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                                <p className='text-xs text-text/40 mt-2'>
                                                                    Selecting no regions allows access to all regions.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        ) : (
                            // Flat view
                            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2'}>
                                {filteredMembers.map((member) => (
                                    <div
                                        key={member.id}
                                        className={`bg-background rounded-xl border border-tertiary/50 ${viewMode === 'grid' ? 'p-4' : 'p-3'}`}
                                    >
                                        {/* Member Header */}
                                        <div className={`flex ${viewMode === 'grid' ? 'flex-col items-center text-center' : 'flex-col sm:flex-row sm:items-center'} gap-3`}>
                                            <UserAvatar
                                                src={member.avatar_url}
                                                alt={member.display_name}
                                                size={viewMode === 'grid' ? 56 : 40}
                                                className='shrink-0'
                                            />
                                            <div className='flex-1 min-w-0'>
                                                <div className={`font-medium truncate flex ${viewMode === 'grid' ? 'justify-center' : ''} items-center gap-2`}>
                                                    {member.display_name}
                                                    {member.role === "admin" ? (
                                                        <ShieldCheck className='w-4 h-4 text-amber-500' />
                                                    ) : member.role === "moderator" ? (
                                                        <Shield className='w-4 h-4 text-blue-500' />
                                                    ) : (
                                                        <PenTool className='w-4 h-4 text-green-500' />
                                                    )}
                                                </div>
                                                <div className='text-sm text-text/60 truncate'>
                                                    @{member.username}
                                                </div>
                                                {member.created_at && (
                                                    <div className='text-xs text-text/40 mt-1'>
                                                        Joined {format(new Date(member.created_at), 'MMM yyyy')}
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`flex items-center gap-2 ${viewMode === 'grid' ? 'flex-wrap justify-center' : 'self-end sm:self-center'}`}>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    member.role === "admin"
                                                        ? "bg-amber-500/20 text-amber-600"
                                                        : member.role === "moderator"
                                                            ? "bg-blue-500/20 text-blue-600"
                                                            : "bg-green-500/20 text-green-600"
                                                }`}>
                                                    {member.role === "admin" ? "Admin" : member.role === "moderator" ? "Moderator" : "Writer"}
                                                </span>
                                                <button
                                                    onClick={() => handleViewActivityLog(member)}
                                                    disabled={teamLoading}
                                                    className='p-1.5 text-primary hover:bg-primary/10 rounded-lg transition disabled:opacity-50'
                                                    title='View activity log'
                                                >
                                                    <History className='w-4 h-4' />
                                                </button>
                                                {member.role === "moderator" && (
                                                    <button
                                                        onClick={() => handleEditRegions(member)}
                                                        disabled={teamLoading}
                                                        className='p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition disabled:opacity-50'
                                                        title='Edit regions'
                                                    >
                                                        <MapPin className='w-4 h-4' />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDemoteUser(member.id, member.role || undefined)}
                                                    disabled={teamLoading}
                                                    className='p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50'
                                                    title='Remove from team'
                                                >
                                                    <X className='w-4 h-4' />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Region display for moderators */}
                                        {member.role === "moderator" && (
                                            <div className={`text-sm ${viewMode === 'grid' ? 'text-center mt-3' : 'mt-2'}`}>
                                                <span className='text-text/60'>Regions: </span>
                                                <span className='text-text/80'>
                                                    {!member.moderator_regions || member.moderator_regions.length === 0
                                                        ? "All regions"
                                                        : member.moderator_regions.join(", ")}
                                                </span>
                                            </div>
                                        )}

                                        {/* Region editor */}
                                        {editingRegionsFor === member.id && (
                                            <div className='border-t border-tertiary/50 pt-3 mt-3'>
                                                <h4 className='text-sm font-medium mb-2'>Assign Regions</h4>
                                                <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto mb-3'>
                                                    {regionOptions.map((region) => (
                                                        <label
                                                            key={region}
                                                            className='flex items-center gap-2 p-2 bg-tertiary/10 rounded-lg cursor-pointer hover:bg-tertiary/20 transition'
                                                        >
                                                            <input
                                                                type='checkbox'
                                                                checked={selectedRegions.includes(region)}
                                                                onChange={() => handleToggleRegion(region)}
                                                                className='w-4 h-4 rounded border-text/20 text-primary focus:ring-primary'
                                                            />
                                                            <span className='text-sm'>{region}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className='flex items-center gap-2'>
                                                    <button
                                                        onClick={() => handleSaveRegions(member.id)}
                                                        disabled={savingRegions}
                                                        className='px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm disabled:opacity-50 flex items-center gap-1.5'
                                                    >
                                                        {savingRegions ? (
                                                            <Loader2 className='w-3.5 h-3.5 animate-spin' />
                                                        ) : (
                                                            <Check className='w-3.5 h-3.5' />
                                                        )}
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={handleClearRegions}
                                                        disabled={savingRegions}
                                                        className='px-3 py-1.5 bg-tertiary/30 text-text/70 rounded-lg hover:bg-tertiary/50 transition text-sm disabled:opacity-50'
                                                    >
                                                        Clear
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEditRegions}
                                                        disabled={savingRegions}
                                                        className='px-3 py-1.5 text-text/60 hover:text-text transition text-sm disabled:opacity-50'
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                                <p className='text-xs text-text/40 mt-2'>
                                                    Selecting no regions allows access to all regions.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Activity Log Modal */}
            {activityLogModalOpen && (
                <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
                    <div className='bg-background rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col'>
                        {/* Modal Header */}
                        <div className='flex items-center justify-between p-4 border-b border-tertiary/50'>
                            <div className='flex items-center gap-3'>
                                <History className='w-5 h-5 text-primary' />
                                <div>
                                    <h3 className='font-semibold'>Activity Log</h3>
                                    <p className='text-sm text-text/60'>@{selectedMemberName}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseActivityLog}
                                className='p-2 hover:bg-tertiary/30 rounded-lg transition'
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className='flex-1 overflow-y-auto p-4'>
                            {activityLogsLoading && activityLogs.length === 0 ? (
                                <div className='flex items-center justify-center py-12'>
                                    <Loader2 className='w-8 h-8 animate-spin text-text opacity-40' />
                                </div>
                            ) : activityLogs.length === 0 ? (
                                <div className='text-center py-12'>
                                    <FileText className='w-12 h-12 mx-auto text-text/30 mb-3' />
                                    <p className='text-text/60'>No activity found</p>
                                </div>
                            ) : (
                                <div className='space-y-3'>
                                    {activityLogs.map((log) => {
                                        const actionColor = ACTION_COLORS[log.action] || 'text-gray-600 bg-gray-500/20'
                                        const actionLabel = ACTION_LABELS[log.action] || log.action
                                        const entityIcon = ENTITY_ICONS[log.entityType] || '📄'

                                        return (
                                            <div key={log.id} className='bg-tertiary/10 rounded-lg p-3'>
                                                <div className='flex items-center gap-2 flex-wrap mb-1'>
                                                    <span className='text-lg'>{entityIcon}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor}`}>
                                                        {actionLabel}
                                                    </span>
                                                    <span className='text-sm text-text/60 capitalize'>{log.entityType}</span>
                                                </div>
                                                <div className='text-xs text-text/40'>
                                                    {log.createdAt && format(new Date(log.createdAt), 'PPp')}
                                                </div>
                                                {(Boolean(log.beforeValue) || Boolean(log.afterValue)) && (
                                                    <div className='mt-2 text-xs text-text/60'>
                                                        {log.beforeValue ? (
                                                            <span className='line-through opacity-50'>{JSON.stringify(log.beforeValue).slice(0, 50)}</span>
                                                        ) : null}
                                                        {log.beforeValue && log.afterValue ? <span className='mx-1'>→</span> : null}
                                                        {log.afterValue ? (
                                                            <span>{JSON.stringify(log.afterValue).slice(0, 50)}</span>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Load More */}
                            {activityLogs.length < activityLogsTotal && (
                                <button
                                    onClick={loadMoreActivityLogs}
                                    disabled={activityLogsLoading}
                                    className='w-full mt-4 py-2 bg-tertiary/30 hover:bg-tertiary/50 rounded-lg text-sm transition disabled:opacity-50'
                                >
                                    {activityLogsLoading ? 'Loading...' : `Load more (${activityLogs.length} of ${activityLogsTotal})`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Action Confirmation Modal */}
            {pendingAction && (
                <ActionConfirmationModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    action={pendingAction.action}
                    actionName={pendingAction.actionName}
                    description={pendingAction.description}
                    onConfirmed={handleConfirmed}
                    onCancel={pendingAction.onCancel}
                />
            )}
        </div>
    )
}
