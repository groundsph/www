"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { authClient } from "@/lib/auth-client"
import { useNotification } from "@/components/NotificationProvider"
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
} from "lucide-react"

type User = {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image?: string | null
    createdAt: Date
    role?: string | null
    banned?: boolean | null
}

export default function UsersManagePage() {
    const { addNotification } = useNotification()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [totalUsers, setTotalUsers] = useState(0)
    const limit = 20

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const res = await authClient.admin.listUsers({
                query: {
                    limit,
                    offset: (page - 1) * limit,
                    ...(searchQuery
                        ? { searchField: "email", searchValue: searchQuery }
                        : {}),
                },
            })
            if (res.data) {
                setUsers(res.data.users as User[])
                setTotalUsers(res.data.total ?? res.data.users.length)
            }
        } catch (err: any) {
            addNotification(err.message || "Failed to fetch users", "error")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
        fetchUsers()
    }

    const handleDelete = async (userId: string, userName: string) => {
        if (
            !confirm(
                `Are you sure you want to delete user "${userName}"? This action cannot be undone.`
            )
        ) {
            return
        }

        setDeletingId(userId)
        try {
            await authClient.admin.removeUser({ userId })
            setUsers((prev) => prev.filter((u) => u.id !== userId))
            setTotalUsers((prev) => prev - 1)
            addNotification(
                `User "${userName}" deleted successfully`,
                "success"
            )
        } catch (err: any) {
            addNotification(`Failed to delete user: ${err.message}`, "error")
        } finally {
            setDeletingId(null)
        }
    }

    const totalPages = Math.ceil(totalUsers / limit)

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
                    onClick={fetchUsers}
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
            <div className='grid grid-cols-2 gap-4'>
                <div className='bg-background shadow-sm rounded-xl p-4 border border-tertiary/50'>
                    <div className='text-2xl font-bold'>{totalUsers}</div>
                    <div className='text-text/60 text-sm'>Total Users</div>
                </div>
                <div className='bg-background shadow-sm rounded-xl p-4 border border-tertiary/50'>
                    <div className='text-2xl font-bold'>
                        {users.filter((u) => u.role === "admin").length}
                    </div>
                    <div className='text-text/60 text-sm'>Admins</div>
                </div>
            </div>

            {/* Search */}
            <form
                onSubmit={handleSearch}
                className='flex gap-2'
            >
                <div className='relative flex-1'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                    <input
                        type='text'
                        placeholder='Search by email...'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className='w-full pl-10 pr-4 py-2 bg-tertiary/20 border border-tertiary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm'
                    />
                </div>
                <button
                    type='submit'
                    className='px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-medium'
                >
                    Search
                </button>
            </form>

            {/* Table */}
            <div className='bg-background border border-tertiary/50 rounded-xl overflow-hidden shadow-sm'>
                <div className='overflow-x-auto'>
                    <table className='w-full'>
                        <thead>
                            <tr className='border-b border-tertiary/50 text-left text-xs text-text/40 uppercase'>
                                <th className='px-4 py-3 font-medium'>User</th>
                                <th className='px-4 py-3 font-medium'>Email</th>
                                <th className='px-4 py-3 font-medium'>Role</th>
                                <th className='px-4 py-3 font-medium'>
                                    Verified
                                </th>
                                <th className='px-4 py-3 font-medium'>
                                    Joined
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
                                        colSpan={6}
                                        className='px-4 py-16 text-center'
                                    >
                                        <Loader2 className='w-6 h-6 mx-auto animate-spin text-text opacity-40' />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className='px-4 py-16 text-center'
                                    >
                                        <Users className='w-10 h-10 mx-auto text-text opacity-30 mb-2' />
                                        <p className='text-text/60'>
                                            No users found
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr
                                        key={user.id}
                                        className='border-b border-tertiary/30 hover:bg-tertiary/10 transition'
                                    >
                                        <td className='px-4 py-3'>
                                            <div className='flex items-center gap-3'>
                                                <div className='relative w-10 h-10 rounded-full overflow-hidden bg-tertiary/30 shrink-0'>
                                                    {user.image ? (
                                                        <Image
                                                            src={user.image}
                                                            alt={user.name}
                                                            fill
                                                            className='object-cover'
                                                        />
                                                    ) : (
                                                        <div className='w-full h-full flex items-center justify-center text-text opacity-30 text-lg font-semibold'>
                                                            {user.name
                                                                ?.charAt(0)
                                                                .toUpperCase() ||
                                                                "?"}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className='font-medium truncate max-w-[150px]'>
                                                    {user.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className='px-4 py-3 text-text/60 text-sm'>
                                            {user.email}
                                        </td>
                                        <td className='px-4 py-3'>
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    user.role === "admin"
                                                        ? "bg-amber-500/20 text-amber-600"
                                                        : user.role ===
                                                            "moderator"
                                                          ? "bg-blue-500/20 text-blue-600"
                                                          : "bg-tertiary/50 text-text/70"
                                                }`}
                                            >
                                                {user.role === "admin" ? (
                                                    <ShieldCheck className='w-3 h-3' />
                                                ) : user.role ===
                                                  "moderator" ? (
                                                    <Shield className='w-3 h-3' />
                                                ) : null}
                                                {user.role || "user"}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3'>
                                            <span
                                                className={`w-2 h-2 rounded-full inline-block ${
                                                    user.emailVerified
                                                        ? "bg-green-500"
                                                        : "bg-tertiary"
                                                }`}
                                            />
                                        </td>
                                        <td className='px-4 py-3 text-text/40 text-sm'>
                                            {new Date(
                                                user.createdAt
                                            ).toLocaleDateString()}
                                        </td>
                                        <td className='px-4 py-3 text-right'>
                                            <button
                                                onClick={() =>
                                                    handleDelete(
                                                        user.id,
                                                        user.name
                                                    )
                                                }
                                                disabled={
                                                    deletingId === user.id ||
                                                    user.role === "admin"
                                                }
                                                className='p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed'
                                                title={
                                                    user.role === "admin"
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
                            {Math.min(page * limit, totalUsers)} of {totalUsers}
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
        </div>
    )
}
