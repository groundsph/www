"use client"

import { useState, useEffect, useCallback } from "react"
import { useNotification } from "@/components/layout/NotificationProvider"
import { UserAvatar } from "@/components/ui/UserAvatar"
import {
    getProfilesForAdmin,
    deleteUserAsAdmin,
    ProfileForAdmin,
    ProfileSortField,
    ProfileSortDirection,
} from "@/app/api/actions/admin"
import {
    Trash2,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
    Users,
    Loader2,
    ShieldCheck,
    Shield,
    Heart,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from "lucide-react"
import { useRouter } from "next/navigation"
import ActionConfirmationModal from "@/components/ui/ActionConfirmationModal"
import { useActionConfirmation } from "@/hooks/useActionConfirmation"
import { type SensitiveAction } from "@/lib/action-confirmation"

export default function UsersManagePage() {
    const { addNotification } = useNotification()
    const [profiles, setProfiles] = useState<ProfileForAdmin[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [totalProfiles, setTotalProfiles] = useState(0)
    const [totalSupporters, setTotalSupporters] = useState(0)
    const [totalContribution, setTotalContribution] = useState(0)
    const [sortField, setSortField] = useState<ProfileSortField>("created_at")
    const [sortDirection, setSortDirection] =
        useState<ProfileSortDirection>("desc")
    const limit = 20
    const router = useRouter()

    // Action confirmation hook
    const { requestConfirmation, isModalOpen, pendingAction, closeModal, handleConfirmed } = useActionConfirmation()

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setPage(1) // Reset to first page on new search
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery])

    const fetchProfiles = useCallback(async () => {
        setLoading(true)
        try {
            const result = await getProfilesForAdmin({
                limit,
                offset: (page - 1) * limit,
                search: debouncedSearch,
                sortField,
                sortDirection,
            })
            setProfiles(result.profiles)
            setTotalProfiles(result.total)
            setTotalSupporters(result.totalSupporters)
            setTotalContribution(result.totalContribution)
        } catch (err: unknown) {
            addNotification(
                err instanceof Error ? err.message : "Failed to fetch profiles",
                "error",
            )
        } finally {
            setLoading(false)
        }
    }, [page, debouncedSearch, sortField, sortDirection, addNotification])

    useEffect(() => {
        fetchProfiles()
    }, [fetchProfiles])

    const handleSort = (field: ProfileSortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
        } else {
            setSortField(field)
            setSortDirection("desc")
        }
        setPage(1)
    }

    const getSortIcon = (field: ProfileSortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className='w-3.5 h-3.5 opacity-40' />
        }
        return sortDirection === "asc" ? (
            <ArrowUp className='w-3.5 h-3.5' />
        ) : (
            <ArrowDown className='w-3.5 h-3.5' />
        )
    }

    const executeDelete = async (userId: string, userName: string) => {
        setDeletingId(userId)
        try {
            const result = await deleteUserAsAdmin(userId)
            if (result.success) {
                setProfiles((prev) => prev.filter((u) => u.id !== userId))
                setTotalProfiles((prev) => prev - 1)
                addNotification(
                    `User "${userName}" deleted successfully`,
                    "success",
                )
            } else {
                throw new Error(result.error || "Failed to delete user")
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown error"
            addNotification(`Failed to delete user: ${message}`, "error")
        } finally {
            setDeletingId(null)
        }
    }

    const handleDelete = async (userId: string, userName: string) => {
        const confirmed = await requestConfirmation(
            "user:delete" as SensitiveAction,
            "Delete User",
            `You are about to permanently delete user "${userName}". This action cannot be undone and will remove all user data, including reviews, contributions, and profile information.`
        )
        if (confirmed) {
            await executeDelete(userId, userName)
        }
    }

    const totalPages = Math.ceil(totalProfiles / limit)

    return (
        <div className='space-y-6'>
            {/* Header */}
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <div>
                    <h1 className='text-2xl md:text-3xl font-bold text-text'>
                        User Management
                    </h1>
                    <p className='text-text/60 mt-1'>
                        View and manage all registered users.
                    </p>
                </div>
                <button
                    onClick={fetchProfiles}
                    disabled={loading}
                    className='flex items-center gap-2 px-4 py-2 bg-tertiary/30 hover:bg-tertiary rounded-lg transition text-sm font-medium disabled:opacity-50 self-start'
                >
                    <RefreshCw
                        className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className='grid grid-cols-3 gap-4'>
                <div className='bg-background shadow-sm rounded-xl p-4 border border-tertiary/50'>
                    <div className='text-2xl font-bold'>{totalProfiles}</div>
                    <div className='text-text/60 text-sm'>Total Users</div>
                </div>
                <div className='bg-background shadow-sm rounded-xl p-4 border border-tertiary/50'>
                    <div className='flex items-center gap-2'>
                        <Heart className='w-5 h-5 text-pink-500' />
                        <span className='text-2xl font-bold'>
                            {totalSupporters}
                        </span>
                    </div>
                    <div className='text-text/60 text-sm'>Supporters</div>
                </div>
                <div className='bg-background shadow-sm rounded-xl p-4 border border-tertiary/50'>
                    <div className='text-2xl font-bold'>
                        {totalContribution.toFixed(0)}
                    </div>
                    <div className='text-text/60 text-sm'>
                        Total Contribution
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                <input
                    type='text'
                    placeholder='Search by username, display name, or email...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='w-full pl-10 pr-4 py-2 bg-tertiary/20 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm'
                />
            </div>

            {/* Table */}
            <div className='bg-background border border-tertiary/50 rounded-xl overflow-hidden shadow-sm'>
                <div className='overflow-x-auto'>
                    <table className='w-full'>
                        <thead>
                            <tr className='border-b border-tertiary/50 text-left text-xs text-text/40 uppercase'>
                                <th className='px-4 py-3 font-medium'>User</th>
                                <th className='px-4 py-3 font-medium'>
                                    <button
                                        onClick={() => handleSort("username")}
                                        className='flex items-center gap-1 hover:text-text/60 transition'
                                    >
                                        Username
                                        {getSortIcon("username")}
                                    </button>
                                </th>
                                <th className='px-4 py-3 font-medium'>
                                    <button
                                        onClick={() => handleSort("email")}
                                        className='flex items-center gap-1 hover:text-text/60 transition'
                                    >
                                        Email
                                        {getSortIcon("email")}
                                    </button>
                                </th>
                                <th className='px-4 py-3 font-medium'>
                                    <button
                                        onClick={() => handleSort("role")}
                                        className='flex items-center gap-1 hover:text-text/60 transition'
                                    >
                                        Role
                                        {getSortIcon("role")}
                                    </button>
                                </th>
                                <th className='px-4 py-3 font-medium'>
                                    Supporter
                                </th>
                                <th className='px-4 py-3 font-medium'>
                                    <button
                                        onClick={() =>
                                            handleSort("total_contribution")
                                        }
                                        className='flex items-center gap-1 hover:text-text/60 transition'
                                    >
                                        Contribution
                                        {getSortIcon("total_contribution")}
                                    </button>
                                </th>
                                <th className='px-4 py-3 font-medium'>
                                    <button
                                        onClick={() => handleSort("created_at")}
                                        className='flex items-center gap-1 hover:text-text/60 transition'
                                    >
                                        Joined
                                        {getSortIcon("created_at")}
                                    </button>
                                </th>
                                <th className='px-4 py-3 font-medium text-right'>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className='px-4 py-16 text-center'
                                    >
                                        <Loader2 className='w-6 h-6 mx-auto animate-spin text-text opacity-40' />
                                    </td>
                                </tr>
                            ) : profiles.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className='px-4 py-16 text-center'
                                    >
                                        <Users className='w-10 h-10 mx-auto text-text opacity-30 mb-2' />
                                        <p className='text-text/60'>
                                            No users found
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                profiles.map((profile) => (
                                    <tr
                                        key={profile.id}
                                        className='border-b border-tertiary/30 hover:bg-tertiary/10 transition'
                                    >
                                        <td className='px-4 py-3'>
                                            <div className='flex items-center gap-3'>
                                                <div className='relative w-10 h-10 rounded-full overflow-hidden shrink-0'>
                                                    <UserAvatar
                                                        src={profile.avatarUrl}
                                                        alt={profile.displayName}
                                                        size={40}
                                                    />
                                                </div>
                                                <span className='font-medium truncate max-w-[150px]'>
                                                    {profile.displayName}
                                                </span>
                                            </div>
                                        </td>
                                        <td
                                            onClick={() =>
                                                router.push(
                                                    `/profile/${profile.username}`,
                                                )
                                            }
                                            className='px-4 py-3 text-text/60 text-sm hover:underline cursor-pointer'
                                        >
                                            @{profile.username}
                                        </td>
                                        <td className='px-4 py-3 text-text/60 text-sm max-w-[250px] truncate'>
                                            {profile.email}
                                        </td>
                                        <td className='px-4 py-3'>
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    profile.role === "admin"
                                                        ? "bg-amber-500/20 text-amber-600"
                                                        : profile.role ===
                                                            "moderator"
                                                          ? "bg-blue-500/20 text-blue-600"
                                                          : "bg-tertiary/50 text-text/70"
                                                }`}
                                            >
                                                {profile.role === "admin" ? (
                                                    <ShieldCheck className='w-3 h-3' />
                                                ) : profile.role ===
                                                  "moderator" ? (
                                                    <Shield className='w-3 h-3' />
                                                ) : null}
                                                {profile.role || "user"}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3'>
                                            {profile.isSupporter && (
                                                <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-500/20 text-pink-600'>
                                                    <Heart className='w-3 h-3' />
                                                    Supporter
                                                </span>
                                            )}
                                        </td>
                                        <td className='px-4 py-3 text-text/60 text-sm'>
                                            {profile.totalContribution?.toFixed(
                                                0,
                                            ) || 0}
                                        </td>
                                        <td className='px-4 py-3 text-text/40 text-sm'>
                                            {profile.createdAt
                                                ? new Date(
                                                      profile.createdAt,
                                                  ).toLocaleDateString()
                                                : "-"}
                                        </td>
                                        <td className='px-4 py-3 text-right'>
                                            <button
                                                onClick={() =>
                                                    handleDelete(
                                                        profile.id,
                                                        profile.displayName,
                                                    )
                                                }
                                                disabled={
                                                    deletingId === profile.id ||
                                                    profile.role === "admin"
                                                }
                                                className='p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed'
                                                title={
                                                    profile.role === "admin"
                                                        ? "Cannot delete admins"
                                                        : "Delete user"
                                                }
                                            >
                                                <Trash2 className='w-4 h-4' />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className='flex items-center justify-between px-4 py-3 border-t border-tertiary/50'>
                        <span className='text-sm text-text/40'>
                            Showing {(page - 1) * limit + 1} -{" "}
                            {Math.min(page * limit, totalProfiles)} of{" "}
                            {totalProfiles}
                        </span>
                        <div className='flex gap-2'>
                            <button
                                onClick={() =>
                                    setPage((p) => Math.max(1, p - 1))
                                }
                                disabled={page === 1}
                                className='p-2 bg-tertiary/30 hover:bg-tertiary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition'
                            >
                                <ChevronLeft className='w-4 h-4' />
                            </button>
                            <button
                                onClick={() =>
                                    setPage((p) => Math.min(totalPages, p + 1))
                                }
                                disabled={page === totalPages}
                                className='p-2 bg-tertiary/30 hover:bg-tertiary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition'
                            >
                                <ChevronRight className='w-4 h-4' />
                            </button>
                        </div>
                    </div>
                )}
            </div>

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
