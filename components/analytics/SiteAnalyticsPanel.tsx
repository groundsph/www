"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts"
import {
    TrendingUp,
    Eye,
    Users,
    Monitor,
    Smartphone,
    Tablet,
    Globe,
    ChevronDown,
    BarChart3,
    AlertCircle,
} from "lucide-react"
import {
    getSiteAnalytics,
    SiteAnalytics,
} from "@/app/api/actions/site-analytics"
import Link from "next/link"

const DEVICE_COLORS = {
    desktop: "#6366f1",
    mobile: "#22c55e",
    tablet: "#f59e0b",
}

const DATE_RANGE_OPTIONS = [
    { value: 7, label: "Last 7 days" },
    { value: 30, label: "Last 30 days" },
    { value: 90, label: "Last 90 days" },
]

export default function SiteAnalyticsPanel() {
    const [analytics, setAnalytics] = useState<SiteAnalytics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [days, setDays] = useState(30)
    const [dropdownOpen, setDropdownOpen] = useState(false)

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true)
            try {
                const data = await getSiteAnalytics(days)
                if (data) {
                    setAnalytics(data)
                    setError(null)
                } else {
                    setError("Failed to load analytics")
                }
            } catch {
                setError("An unexpected error occurred")
            } finally {
                setLoading(false)
            }
        }

        fetchAnalytics()
    }, [days])

    if (loading) {
        return (
            <div className='space-y-4 animate-pulse'>
                <div className='h-8 bg-text/5 rounded w-48'></div>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className='h-24 bg-text/5 rounded-xl'
                        ></div>
                    ))}
                </div>
                <div className='h-64 bg-text/5 rounded-xl'></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className='p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2'>
                <AlertCircle className='w-5 h-5' />
                <span>{error}</span>
            </div>
        )
    }

    if (!analytics) return null

    const deviceData = [
        {
            name: "Desktop",
            value: analytics.deviceBreakdown.desktop,
            color: DEVICE_COLORS.desktop,
        },
        {
            name: "Mobile",
            value: analytics.deviceBreakdown.mobile,
            color: DEVICE_COLORS.mobile,
        },
        {
            name: "Tablet",
            value: analytics.deviceBreakdown.tablet,
            color: DEVICE_COLORS.tablet,
        },
    ].filter((d) => d.value > 0)

    const totalDevices = deviceData.reduce((sum, d) => sum + d.value, 0)

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 },
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
            {/* Header with Date Range Picker */}
            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
                <h2 className='text-xl font-bold font-serif flex items-center gap-2'>
                    <BarChart3 className='w-6 h-6 text-primary' />
                    Site Analytics
                </h2>

                <div className='relative'>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className='flex items-center gap-2 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm hover:border-primary/30 transition-colors cursor-pointer'
                    >
                        {
                            DATE_RANGE_OPTIONS.find((o) => o.value === days)
                                ?.label
                        }
                        <ChevronDown
                            className={`w-4 h-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                        />
                    </button>
                    {dropdownOpen && (
                        <div className='absolute right-0 mt-1 w-36 bg-background border border-text/10 rounded-lg shadow-lg z-10'>
                            {DATE_RANGE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setDays(option.value)
                                        setDropdownOpen(false)
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-text/5 first:rounded-t-lg last:rounded-b-lg cursor-pointer ${
                                        days === option.value
                                            ? "bg-primary/10 text-primary"
                                            : ""
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Overview Stats */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-blue-100 text-blue-700 rounded-lg'>
                            <Eye className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Total Views
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>
                        {analytics.totalViews.toLocaleString()}
                    </div>
                    <div className='text-xs text-text/40 mt-1'>
                        {analytics.avgViewsPerDay} avg/day
                    </div>
                </motion.div>

                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-green-100 text-green-700 rounded-lg'>
                            <Users className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Unique Visitors
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>
                        {analytics.uniqueVisitors.toLocaleString()}
                    </div>
                </motion.div>

                <motion.div
                    variants={item}
                    className='p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm'
                >
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='p-2 bg-purple-100 text-purple-700 rounded-lg'>
                            <TrendingUp className='w-5 h-5' />
                        </div>
                        <span className='text-sm font-medium text-text/60'>
                            Views Per Visitor
                        </span>
                    </div>
                    <div className='text-2xl font-bold'>
                        {analytics.uniqueVisitors > 0
                            ? (
                                  analytics.totalViews /
                                  analytics.uniqueVisitors
                              ).toFixed(1)
                            : "0"}
                    </div>
                </motion.div>
            </div>

            {/* Charts Row */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                {/* Views Over Time Chart */}
                <motion.div
                    variants={item}
                    className='lg:col-span-2 p-6 bg-background border border-text/10 rounded-xl shadow-sm'
                >
                    <h3 className='font-semibold mb-4 text-text/80'>
                        Views Over Time
                    </h3>
                    <div className='h-64'>
                        <ResponsiveContainer
                            width='100%'
                            height='100%'
                        >
                            <AreaChart data={analytics.viewsByDay}>
                                <defs>
                                    <linearGradient
                                        id='viewsGradient'
                                        x1='0'
                                        y1='0'
                                        x2='0'
                                        y2='1'
                                    >
                                        <stop
                                            offset='5%'
                                            stopColor='#6366f1'
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset='95%'
                                            stopColor='#6366f1'
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray='3 3'
                                    stroke='#e5e7eb'
                                />
                                <XAxis
                                    dataKey='date'
                                    tickFormatter={(value) => {
                                        const date = new Date(value)
                                        return `${date.getMonth() + 1}/${date.getDate()}`
                                    }}
                                    tick={{ fontSize: 12 }}
                                    stroke='#9ca3af'
                                />
                                <YAxis
                                    tick={{ fontSize: 12 }}
                                    stroke='#9ca3af'
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                    }}
                                    labelFormatter={(value) =>
                                        new Date(value).toLocaleDateString()
                                    }
                                />
                                <Area
                                    type='linear'
                                    dataKey='views'
                                    stroke='#6366f1'
                                    strokeWidth={2}
                                    fill='url(#viewsGradient)'
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Device Breakdown */}
                <motion.div
                    variants={item}
                    className='p-6 bg-background border border-text/10 rounded-xl shadow-sm'
                >
                    <h3 className='font-semibold mb-4 text-text/80'>Devices</h3>
                    {totalDevices > 0 ? (
                        <>
                            <div className='h-40'>
                                <ResponsiveContainer
                                    width='100%'
                                    height='100%'
                                >
                                    <PieChart>
                                        <Pie
                                            data={deviceData}
                                            cx='50%'
                                            cy='50%'
                                            innerRadius={40}
                                            outerRadius={60}
                                            paddingAngle={2}
                                            dataKey='value'
                                        >
                                            {deviceData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.color}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "#fff",
                                                border: "1px solid #e5e7eb",
                                                borderRadius: "8px",
                                                fontSize: "12px",
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className='space-y-2 mt-4'>
                                <div className='flex items-center justify-between text-sm'>
                                    <span className='flex items-center gap-2'>
                                        <Monitor
                                            className='w-4 h-4'
                                            style={{
                                                color: DEVICE_COLORS.desktop,
                                            }}
                                        />
                                        Desktop
                                    </span>
                                    <span className='font-medium'>
                                        {(
                                            (analytics.deviceBreakdown.desktop /
                                                totalDevices) *
                                            100
                                        ).toFixed(0)}
                                        %
                                    </span>
                                </div>
                                <div className='flex items-center justify-between text-sm'>
                                    <span className='flex items-center gap-2'>
                                        <Smartphone
                                            className='w-4 h-4'
                                            style={{
                                                color: DEVICE_COLORS.mobile,
                                            }}
                                        />
                                        Mobile
                                    </span>
                                    <span className='font-medium'>
                                        {(
                                            (analytics.deviceBreakdown.mobile /
                                                totalDevices) *
                                            100
                                        ).toFixed(0)}
                                        %
                                    </span>
                                </div>
                                <div className='flex items-center justify-between text-sm'>
                                    <span className='flex items-center gap-2'>
                                        <Tablet
                                            className='w-4 h-4'
                                            style={{
                                                color: DEVICE_COLORS.tablet,
                                            }}
                                        />
                                        Tablet
                                    </span>
                                    <span className='font-medium'>
                                        {(
                                            (analytics.deviceBreakdown.tablet /
                                                totalDevices) *
                                            100
                                        ).toFixed(0)}
                                        %
                                    </span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className='flex items-center justify-center h-40 text-text/40'>
                            No device data available
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Bottom Row: Top Referrers and Top Cafes */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                {/* Top Referrers */}
                <motion.div
                    variants={item}
                    className='p-6 bg-background border border-text/10 rounded-xl shadow-sm'
                >
                    <h3 className='font-semibold mb-4 text-text/80 flex items-center gap-2'>
                        <Globe className='w-5 h-5 text-primary' />
                        Top Referrers
                    </h3>
                    {analytics.topReferrers.length > 0 ? (
                        <div className='space-y-3'>
                            {analytics.topReferrers
                                .slice(0, 5)
                                .map((ref, index) => (
                                    <div
                                        key={index}
                                        className='flex items-center justify-between text-sm'
                                    >
                                        <span className='text-text/70 truncate max-w-[200px]'>
                                            {ref.referrer}
                                        </span>
                                        <span className='font-medium'>
                                            {ref.count.toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className='text-text/40 text-sm'>
                            No referrer data available
                        </div>
                    )}
                </motion.div>

                {/* Top Cafes */}
                <motion.div
                    variants={item}
                    className='p-6 bg-background border border-text/10 rounded-xl shadow-sm'
                >
                    <h3 className='font-semibold mb-4 text-text/80 flex items-center gap-2'>
                        <TrendingUp className='w-5 h-5 text-primary' />
                        Top Cafes by Views
                    </h3>
                    {analytics.topCafes.length > 0 ? (
                        <div className='space-y-3'>
                            {analytics.topCafes
                                .slice(0, 5)
                                .map((cafe, index) => (
                                    <div
                                        key={cafe.cafeId}
                                        className='flex items-center justify-between text-sm'
                                    >
                                        <Link
                                            href={`/cafes/${cafe.cafeSlug}`}
                                            className='text-text/70 hover:text-primary truncate max-w-[200px]'
                                        >
                                            <span className='text-text/40 mr-2'>
                                                #{index + 1}
                                            </span>
                                            {cafe.cafeName}
                                        </Link>
                                        <span className='font-medium'>
                                            {cafe.views.toLocaleString()} views
                                        </span>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className='text-text/40 text-sm'>
                            No cafe data available
                        </div>
                    )}
                </motion.div>
            </div>
        </motion.div>
    )
}
