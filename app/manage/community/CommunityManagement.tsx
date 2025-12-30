"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    Check,
    X,
    ChevronDown,
    ChevronUp,
    EyeOff,
    Trash2,
    Loader2,
    MessageSquare,
    Flag,
    Star,
    Users,
    ExternalLink,
    Search,
    Shield,
    ShieldCheck,
    PenTool,
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

interface CommunityManagementProps {
    userRole: "admin" | "moderator"
    reportedReviews: ReviewForModeration[]
    isFullAdmin: boolean
}

type TabType = "reviews" | "team"

export default function CommunityManagement({
    reportedReviews: initialReported,
    isFullAdmin,
}: CommunityManagementProps) {
    const [activeTab, setActiveTab] = useState<TabType>("reviews")
    const [reportedReviews, setReportedReviews] = useState(initialReported)
    const [expandedReview, setExpandedReview] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | null>(null)

    // Team management state
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [teamSearchQuery, setTeamSearchQuery] = useState("")
    const [teamSearchResults, setTeamSearchResults] = useState<TeamMember[]>([])
    const [teamLoading, setTeamLoading] = useState(false)
    const [teamSearchLoading, setTeamSearchLoading] = useState(false)

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

    const handlePromoteUser = async (
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
        if (activeTab === "team" && teamMembers.length === 0 && isFullAdmin) {
            // Use an IIFE to avoid lint warning about calling setState in effect
            void loadTeamMembers()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, isFullAdmin])

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
                                            <div className='relative w-12 h-12 shrink-0 rounded-full overflow-hidden bg-tertiary/30'>
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
                                                    <div className='w-full h-full flex items-center justify-center text-text opacity-30'>
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
                                        <div className='relative w-10 h-10 rounded-full overflow-hidden bg-tertiary/30 shrink-0'>
                                            {user.avatar_url ? (
                                                <Image
                                                    src={user.avatar_url}
                                                    alt={user.display_name}
                                                    fill
                                                    className='object-cover'
                                                />
                                            ) : (
                                                <div className='w-full h-full flex items-center justify-center text-text opacity-30 text-lg font-semibold'>
                                                    {user.display_name?.[0]?.toUpperCase() ||
                                                        "?"}
                                                </div>
                                            )}
                                        </div>
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

                    {/* Current Team Members */}
                    <div>
                        <h3 className='font-semibold mb-3'>Current Team</h3>
                        {teamLoading && teamMembers.length === 0 ? (
                            <div className='flex items-center justify-center py-8'>
                                <Loader2 className='w-6 h-6 animate-spin text-text opacity-40' />
                            </div>
                        ) : teamMembers.length === 0 ? (
                            <div className='text-center py-8 bg-background rounded-xl border border-tertiary/50'>
                                <Users className='w-10 h-10 mx-auto text-text opacity-30 mb-2' />
                                <p className='text-text/60'>No team members</p>
                            </div>
                        ) : (
                            <div className='space-y-2'>
                                {teamMembers.map((member) => (
                                    <div
                                        key={member.id}
                                        className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-background rounded-xl border border-tertiary/50'
                                    >
                                        <div className='relative w-10 h-10 rounded-full overflow-hidden bg-tertiary/30 shrink-0'>
                                            {member.avatar_url ? (
                                                <Image
                                                    src={member.avatar_url}
                                                    alt={member.display_name}
                                                    fill
                                                    className='object-cover'
                                                />
                                            ) : (
                                                <div className='w-full h-full flex items-center justify-center text-text opacity-30 text-lg font-semibold'>
                                                    {member.display_name?.[0]?.toUpperCase() ||
                                                        "?"}
                                                </div>
                                            )}
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <div className='font-medium truncate flex items-center gap-2'>
                                                {member.display_name}
                                                {member.role === "admin" ? (
                                                    <ShieldCheck className='w-4 h-4 text-amber-500' />
                                                ) : member.role ===
                                                  "moderator" ? (
                                                    <Shield className='w-4 h-4 text-blue-500' />
                                                ) : (
                                                    <PenTool className='w-4 h-4 text-green-500' />
                                                )}
                                            </div>
                                            <div className='text-sm text-text/60 truncate'>
                                                @{member.username}
                                            </div>
                                        </div>
                                        <div className='flex items-center gap-2 self-end sm:self-center'>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    member.role === "admin"
                                                        ? "bg-amber-500/20 text-amber-600"
                                                        : member.role ===
                                                            "moderator"
                                                          ? "bg-blue-500/20 text-blue-600"
                                                          : "bg-green-500/20 text-green-600"
                                                }`}
                                            >
                                                {member.role === "admin"
                                                    ? "Admin"
                                                    : member.role ===
                                                        "moderator"
                                                      ? "Moderator"
                                                      : "Writer"}
                                            </span>
                                            <button
                                                onClick={() =>
                                                    handleDemoteUser(member.id)
                                                }
                                                disabled={teamLoading}
                                                className='p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50'
                                                title='Remove from team'
                                            >
                                                <X className='w-4 h-4' />
                                            </button>
                                        </div>
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
