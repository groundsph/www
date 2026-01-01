"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import {
    UsersIcon,
    DatabaseIcon,
    HardDriveIcon,
    CoffeeIcon,
    ServerIcon,
    Loader2,
} from "lucide-react"
import { getSystemStats, SystemStats } from "@/app/api/actions/admin-stats"
import { useNotification } from "@/components/NotificationProvider"

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export default function StatsCards() {
    const { addNotification } = useNotification()
    const [stats, setStats] = useState<SystemStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const result = await getSystemStats()
                if (result.success && result.data) {
                    setStats(result.data)
                } else {
                    addNotification(
                        result.error || "Failed to load stats",
                        "error"
                    )
                }
            } catch (err) {
                addNotification("An unexpected error occurred", "error")
                console.error(err)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [addNotification])

    if (loading) {
        return (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className='h-32 bg-text/5 rounded-xl flex items-center justify-center'
                    >
                        <Loader2 className='w-6 h-6 animate-spin text-text/30' />
                    </div>
                ))}
            </div>
        )
    }

    if (!stats) return null

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    }

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
    }

    return (
        <motion.div
            variants={container}
            initial='hidden'
            animate='show'
            className='space-y-6'
        >
            <h2 className='text-xl font-bold font-serif flex items-center gap-2'>
                <ServerIcon className='w-6 h-6 text-primary' />
                System Overview
            </h2>

            {/* Main Stats Grid */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                {/* Users */}
                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-blue-100 text-blue-700 rounded-lg'>
                            <UsersIcon className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Total Users
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>
                        {stats.system.users_count.toLocaleString()}
                    </div>
                </motion.div>

                {/* Storage */}
                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-purple-100 text-purple-700 rounded-lg'>
                            <HardDriveIcon className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Storage Used
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>
                        {formatBytes(stats.storage.total_bytes)}
                    </div>
                    {stats.storage.storage_limit_bytes && (
                        <div className='mt-2'>
                            <div className='flex justify-between text-xs text-text/40 mb-1'>
                                <span>
                                    {formatBytes(
                                        stats.storage.storage_left_bytes || 0
                                    )}{" "}
                                    left
                                </span>
                                <span>
                                    {Math.round(
                                        (stats.storage.total_bytes /
                                            stats.storage.storage_limit_bytes) *
                                            100
                                    )}
                                    %
                                </span>
                            </div>
                            <div className='w-full h-1.5 bg-text/5 rounded-full overflow-hidden'>
                                <div
                                    className={`h-full rounded-full ${
                                        stats.storage.total_bytes /
                                            stats.storage.storage_limit_bytes >
                                        0.9
                                            ? "bg-red-500"
                                            : stats.storage.total_bytes /
                                                    stats.storage
                                                        .storage_limit_bytes >
                                                0.7
                                              ? "bg-amber-500"
                                              : "bg-purple-500"
                                    }`}
                                    style={{
                                        width: `${Math.min((stats.storage.total_bytes / stats.storage.storage_limit_bytes) * 100, 100)}%`,
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Database */}
                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-indigo-100 text-indigo-700 rounded-lg'>
                            <DatabaseIcon className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            DB Size
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>
                        {formatBytes(stats.system.db_size_bytes)}
                    </div>
                </motion.div>

                {/* Cafes Total */}
                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-orange-100 text-orange-700 rounded-lg'>
                            <CoffeeIcon className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Total Cafes
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>
                        {stats.business.cafes_total.toLocaleString()}
                    </div>
                    <div className='text-xs text-text/40 mt-1 flex justify-between'>
                        <span>{stats.business.cafes_published} published</span>
                        <span>{stats.business.cafes_verified} verified</span>
                    </div>
                </motion.div>
            </div>

            {/* Secondary Stats Grid */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                {/* Pending Actions */}
                <motion.div
                    variants={item}
                    className='p-6 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <h3 className='font-semibold mb-4 text-text/80'>
                        Action Items
                    </h3>
                    <div className='grid grid-cols-2 gap-4'>
                        <div className='p-3 bg-text/5 rounded-lg flex flex-col hover:border-primary/30 transition-all shadow-inner'>
                            <span className='text-sm text-text/60 mb-1'>
                                Pending Claims
                            </span>
                            <span className='text-2xl font-bold flex items-center gap-2'>
                                {stats.business.pending_claims}
                                {stats.business.pending_claims > 0 && (
                                    <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse'></span>
                                )}
                            </span>
                        </div>
                        {/* We could add more pending items here if available in the API */}
                        <div className='p-3 bg-text/5 rounded-lg flex flex-col hover:border-primary/30 transition-all shadow-inner'>
                            <span className='text-sm text-text/60 mb-1'>
                                Total Reviews
                            </span>
                            <span className='text-xl font-bold'>
                                {stats.business.reviews_total.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Storage Breakdown */}
                <motion.div
                    variants={item}
                    className='p-6 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md'
                >
                    <h3 className='font-semibold mb-4 text-text/80'>
                        Storage Usage Breakdown
                    </h3>
                    <table className='w-full'>
                        <thead>
                            <tr className='text-xs text-text/40 border-b border-text/10'>
                                <th className='text-left pb-2 font-medium'>
                                    Bucket
                                </th>
                                <th className='text-left pb-2 font-medium w-32'>
                                    Usage
                                </th>
                                <th className='text-right pb-2 font-medium w-20'>
                                    Size
                                </th>
                                <th className='text-right pb-2 font-medium w-12'>
                                    %
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(stats.storage.buckets).map(
                                ([bucket, size]) => {
                                    const percentage =
                                        stats.storage.total_bytes > 0
                                            ? (size /
                                                  stats.storage.total_bytes) *
                                              100
                                            : 0
                                    return (
                                        <tr
                                            key={bucket}
                                            className='border-b border-text/5 last:border-0'
                                        >
                                            <td className='py-2 capitalize text-sm text-text/70'>
                                                {bucket.split("_").join(" ")}
                                            </td>
                                            <td className='py-2'>
                                                <div className='w-full h-2 bg-text/10 rounded-full overflow-hidden'>
                                                    <div
                                                        className='h-full bg-primary/60 rounded-full'
                                                        style={{
                                                            width: `${Math.min(percentage, 100)}%`,
                                                        }}
                                                    ></div>
                                                </div>
                                            </td>
                                            <td className='py-2 text-sm font-mono text-text/60 text-right'>
                                                {formatBytes(size)}
                                            </td>
                                            <td className='py-2 text-xs text-text/40 text-right'>
                                                {percentage.toFixed(1)}%
                                            </td>
                                        </tr>
                                    )
                                }
                            )}
                        </tbody>
                    </table>
                </motion.div>
            </div>
        </motion.div>
    )
}
