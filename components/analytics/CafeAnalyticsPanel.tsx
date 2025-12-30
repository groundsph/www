"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "motion/react"
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Search,
    ArrowUpDown,
    Eye,
    Users,
    AlertCircle,
    CoffeeIcon,
} from "lucide-react"
import {
    getCafeAnalyticsSummary,
    CafeAnalyticsSummary,
} from "@/app/api/actions/site-analytics"
import Link from "next/link"
import Image from "next/image"
import { getCafeThumbnailUrl } from "@/utils/extras"

type SortField = "totalViews" | "uniqueVisitors" | "viewsLastWeek" | "cafeName"
type SortDirection = "asc" | "desc"

export default function CafeAnalyticsPanel() {
    const [cafes, setCafes] = useState<CafeAnalyticsSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [sortField, setSortField] = useState<SortField>("totalViews")
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    useEffect(() => {
        const fetchCafes = async () => {
            try {
                const data = await getCafeAnalyticsSummary()
                setCafes(data)
                setError(null)
            } catch {
                setError("Failed to load cafe analytics")
            } finally {
                setLoading(false)
            }
        }

        fetchCafes()
    }, [])

    const filteredAndSortedCafes = useMemo(() => {
        let result = [...cafes]

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(
                (c) =>
                    c.cafeName.toLowerCase().includes(query) ||
                    c.region.toLowerCase().includes(query)
            )
        }

        // Sort
        result.sort((a, b) => {
            let aVal: number | string
            let bVal: number | string

            switch (sortField) {
                case "cafeName":
                    aVal = a.cafeName.toLowerCase()
                    bVal = b.cafeName.toLowerCase()
                    break
                case "totalViews":
                    aVal = a.totalViews
                    bVal = b.totalViews
                    break
                case "uniqueVisitors":
                    aVal = a.uniqueVisitors
                    bVal = b.uniqueVisitors
                    break
                case "viewsLastWeek":
                    aVal = a.viewsLastWeek
                    bVal = b.viewsLastWeek
                    break
                default:
                    aVal = a.totalViews
                    bVal = b.totalViews
            }

            if (typeof aVal === "string") {
                return sortDirection === "asc"
                    ? aVal.localeCompare(bVal as string)
                    : (bVal as string).localeCompare(aVal)
            }

            return sortDirection === "asc"
                ? aVal - (bVal as number)
                : (bVal as number) - aVal
        })

        return result
    }, [cafes, searchQuery, sortField, sortDirection])

    const paginatedCafes = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredAndSortedCafes.slice(start, start + itemsPerPage)
    }, [filteredAndSortedCafes, currentPage])

    const totalPages = Math.ceil(filteredAndSortedCafes.length / itemsPerPage)

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
        } else {
            setSortField(field)
            setSortDirection("desc")
        }
        setCurrentPage(1)
    }

    const getTrendIcon = (trend: "up" | "down" | "stable") => {
        switch (trend) {
            case "up":
                return <TrendingUp className='w-4 h-4 text-green-500' />
            case "down":
                return <TrendingDown className='w-4 h-4 text-red-500' />
            default:
                return <Minus className='w-4 h-4 text-text/30' />
        }
    }

    if (loading) {
        return (
            <div className='space-y-4 animate-pulse'>
                <div className='h-8 bg-text/5 rounded w-48'></div>
                <div className='h-10 bg-text/5 rounded w-64'></div>
                <div className='h-96 bg-text/5 rounded-xl'></div>
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

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className='space-y-4'
        >
            {/* Header */}
            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
                <h2 className='text-xl font-bold font-serif flex items-center gap-2'>
                    <CoffeeIcon className='w-6 h-6 text-primary' />
                    Cafe Performance
                </h2>

                {/* Search */}
                <div className='relative w-full sm:w-64'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                    <input
                        type='text'
                        placeholder='Search cafes...'
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value)
                            setCurrentPage(1)
                        }}
                        className='w-full pl-9 pr-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:border-primary/50'
                    />
                </div>
            </div>

            {/* Stats Summary */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-sm'>
                <div className='p-3 bg-text/5 rounded-lg'>
                    <span className='text-text/60'>Total Cafes</span>
                    <div className='text-lg font-bold'>{cafes.length}</div>
                </div>
                <div className='p-3 bg-text/5 rounded-lg'>
                    <span className='text-text/60'>Total Views</span>
                    <div className='text-lg font-bold'>
                        {cafes
                            .reduce((sum, c) => sum + c.totalViews, 0)
                            .toLocaleString()}
                    </div>
                </div>
                <div className='p-3 bg-text/5 rounded-lg'>
                    <span className='text-text/60'>Avg Views/Cafe</span>
                    <div className='text-lg font-bold'>
                        {cafes.length > 0
                            ? Math.round(
                                  cafes.reduce(
                                      (sum, c) => sum + c.totalViews,
                                      0
                                  ) / cafes.length
                              )
                            : 0}
                    </div>
                </div>
                <div className='p-3 bg-text/5 rounded-lg'>
                    <span className='text-text/60'>Views This Week</span>
                    <div className='text-lg font-bold'>
                        {cafes
                            .reduce((sum, c) => sum + c.viewsLastWeek, 0)
                            .toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className='bg-background border border-text/10 rounded-xl overflow-hidden shadow-sm'>
                <div className='overflow-x-auto'>
                    <table className='w-full'>
                        <thead>
                            <tr className='bg-text/5 text-sm'>
                                <th className='text-left p-3 font-medium'>
                                    <button
                                        onClick={() => handleSort("cafeName")}
                                        className='flex items-center gap-1 hover:text-primary cursor-pointer'
                                    >
                                        Cafe
                                        <ArrowUpDown className='w-3 h-3' />
                                    </button>
                                </th>
                                <th className='text-right p-3 font-medium'>
                                    <button
                                        onClick={() => handleSort("totalViews")}
                                        className='flex items-center gap-1 ml-auto hover:text-primary cursor-pointer'
                                    >
                                        <Eye className='w-4 h-4' />
                                        Views
                                        <ArrowUpDown className='w-3 h-3' />
                                    </button>
                                </th>
                                <th className='text-right p-3 font-medium'>
                                    <button
                                        onClick={() =>
                                            handleSort("uniqueVisitors")
                                        }
                                        className='flex items-center gap-1 ml-auto hover:text-primary cursor-pointer'
                                    >
                                        <Users className='w-4 h-4' />
                                        Visitors
                                        <ArrowUpDown className='w-3 h-3' />
                                    </button>
                                </th>
                                <th className='text-right p-3 font-medium'>
                                    <button
                                        onClick={() =>
                                            handleSort("viewsLastWeek")
                                        }
                                        className='flex items-center gap-1 ml-auto hover:text-primary cursor-pointer'
                                    >
                                        Last 7d
                                        <ArrowUpDown className='w-3 h-3' />
                                    </button>
                                </th>
                                <th className='text-center p-3 font-medium w-16'>
                                    Trend
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCafes.length > 0 ? (
                                paginatedCafes.map((cafe) => (
                                    <tr
                                        key={cafe.cafeId}
                                        className='border-t border-text/5 hover:bg-text/5 transition-colors'
                                    >
                                        <td className='p-3'>
                                            <Link
                                                href={`/cafes/${cafe.cafeSlug}`}
                                                className='flex items-center gap-3 hover:text-primary'
                                            >
                                                <div className='w-10 h-10 rounded-lg overflow-hidden bg-text/10 shrink-0'>
                                                    {cafe.thumbnail ? (
                                                        <Image
                                                            src={getCafeThumbnailUrl(
                                                                cafe.thumbnail
                                                            )}
                                                            alt={cafe.cafeName}
                                                            width={40}
                                                            height={40}
                                                            className='w-full h-full object-cover'
                                                        />
                                                    ) : (
                                                        <div className='w-full h-full flex items-center justify-center'>
                                                            <CoffeeIcon className='w-5 h-5 text-text/30' />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className='font-medium line-clamp-1'>
                                                        {cafe.cafeName}
                                                    </div>
                                                    <div className='text-xs text-text/50'>
                                                        {cafe.region}
                                                    </div>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className='p-3 text-right font-medium'>
                                            {cafe.totalViews.toLocaleString()}
                                        </td>
                                        <td className='p-3 text-right text-text/70'>
                                            {cafe.uniqueVisitors.toLocaleString()}
                                        </td>
                                        <td className='p-3 text-right text-text/70'>
                                            {cafe.viewsLastWeek.toLocaleString()}
                                        </td>
                                        <td className='p-3'>
                                            <div className='flex justify-center'>
                                                {getTrendIcon(cafe.trend)}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className='p-8 text-center text-text/40'
                                    >
                                        {searchQuery
                                            ? "No cafes match your search"
                                            : "No cafe data available"}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className='flex items-center justify-between p-3 border-t border-text/10 bg-text/5'>
                        <span className='text-sm text-text/60'>
                            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                            {Math.min(
                                currentPage * itemsPerPage,
                                filteredAndSortedCafes.length
                            )}{" "}
                            of {filteredAndSortedCafes.length}
                        </span>
                        <div className='flex items-center gap-2'>
                            <button
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.max(prev - 1, 1)
                                    )
                                }
                                disabled={currentPage === 1}
                                className='px-3 py-1 text-sm bg-background border border-text/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary/30 transition-colors cursor-pointer'
                            >
                                Previous
                            </button>
                            <span className='text-sm text-text/60'>
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.min(prev + 1, totalPages)
                                    )
                                }
                                disabled={currentPage === totalPages}
                                className='px-3 py-1 text-sm bg-background border border-text/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary/30 transition-colors cursor-pointer'
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
