"use client"

import { useState, useEffect, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Trophy, MapPin, Users, ChevronDown, Medal, Crown, Calendar, Star } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { getCafeMonthlyLeaderboard } from "@/app/api/actions/leaderboard"
import { getLastNMonths, formatYearMonth } from "@/utils/date/leaderboard-months"
import { groupByRank } from "./leaderboard-utils"
import { CafeLeaderboardEntry } from "@/utils/types/leaderboard"

interface CafeLeaderboardProps {
    region?: string | null
    yearMonth?: string
}

function CafeRankCard({
    rank,
    entries,
    rankColor,
    rankIcon,
}: {
    rank: number
    entries: CafeLeaderboardEntry[]
    rankColor: string
    rankIcon: React.ReactNode
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const hasMultiple = entries.length > 1

    return (
        <div className={`relative rounded-2xl p-6 ${rankColor} border-2 border-white/20 shadow-lg overflow-clip`}>
            {/* Rank Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                        {rankIcon ?? <Medal className="w-6 h-6" />}
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">
                            {rank === 1 ? "1st Place" : rank === 2 ? "2nd Place" : "3rd Place"}
                        </h3>
                        {hasMultiple && (
                            <p className="text-white/80 text-sm flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {entries.length} cafes tied
                            </p>
                        )}
                    </div>
                </div>

                {hasMultiple && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition"
                    >
                        {isExpanded ? "Show Less" : "View All"}
                        <ChevronDown
                            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                    </button>
                )}
            </div>

            {/* Primary Entry (always visible) */}
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <Link
                    href={`/cafes/${entries[0].slug}`}
                    className="flex items-center gap-4"
                >
                    <div className="relative">
                        {entries[0].thumbnail ? (
                            <Image
                                src={entries[0].thumbnail}
                                alt={entries[0].name}
                                width={56}
                                height={56}
                                className="w-14 h-14 rounded-xl object-cover border-2 border-white/50"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center text-white font-bold text-xl border-2 border-white/50">
                                {entries[0].name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-lg truncate">
                            {entries[0].name}
                        </p>
                        <p className="text-white/70 text-sm truncate">
                            {entries[0].region}
                        </p>
                        {entries[0].avgRating && (
                            <div className="flex items-center gap-1 mt-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-white/80 text-sm">
                                    {entries[0].avgRating.toFixed(1)}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-white font-bold text-2xl">{entries[0].score}</p>
                        <p className="text-white/70 text-sm">score</p>
                    </div>
                </Link>
            </div>

            {/* Additional Entries (expandable) */}
            <AnimatePresence>
                {isExpanded && hasMultiple && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-3 space-y-2">
                            {entries.slice(1).map((entry) => (
                                <div
                                    key={entry.cafeId}
                                    className="bg-white/10 rounded-xl p-3 backdrop-blur-sm"
                                >
                                    <Link
                                        href={`/cafes/${entry.slug}`}
                                        className="flex items-center gap-3"
                                    >
                                        {entry.thumbnail ? (
                                            <Image
                                                src={entry.thumbnail}
                                                alt={entry.name}
                                                width={40}
                                                height={40}
                                                className="w-10 h-10 rounded-lg object-cover border border-white/30"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold border border-white/30">
                                                {entry.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">
                                                {entry.name}
                                            </p>
                                            <p className="text-white/60 text-sm truncate">
                                                {entry.region}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-bold">{entry.score}</p>
                                        </div>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function CafeMonthlyLeaderboard({
    region,
    yearMonth,
}: CafeLeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<CafeLeaderboardEntry[]>([])
    const [selectedRegion, setSelectedRegion] = useState<string | null>(region || null)
    const [isLoading, setIsLoading] = useState(true)
    const [showRegionDropdown, setShowRegionDropdown] = useState(false)
    const [showMonthDropdown, setShowMonthDropdown] = useState(false)
    const [selectedMonth, setSelectedMonth] = useState<string>(yearMonth || "")
    const dropdownRef = useRef<HTMLDivElement>(null)
    const monthDropdownRef = useRef<HTMLDivElement>(null)

    // Get available months (last 12 months)
    const availableMonths = getLastNMonths(12)

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setShowRegionDropdown(false)
            }
            if (
                monthDropdownRef.current &&
                !monthDropdownRef.current.contains(event.target as Node)
            ) {
                setShowMonthDropdown(false)
            }
        }

        if (showRegionDropdown || showMonthDropdown) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [showRegionDropdown, showMonthDropdown])

    // Philippines regions for dropdown
    const regions = [
        "NCR - National Capital Region",
        "Region I - Ilocos Region",
        "Region II - Cagayan Valley",
        "Region III - Central Luzon",
        "Region IV-A - CALABARZON",
        "Region IV-B - MIMAROPA",
        "Region V - Bicol Region",
        "Region VI - Western Visayas",
        "Region VII - Central Visayas",
        "Region VIII - Eastern Visayas",
        "Region IX - Zamboanga Peninsula",
        "Region X - Northern Mindanao",
        "Region XI - Davao Region",
        "Region XII - SOCCSKSARGEN",
        "Region XIII - Caraga",
        "BARMM - Bangsamoro",
    ]

    // Initialize selected month to current month if not provided
    useEffect(() => {
        if (!selectedMonth) {
            const now = new Date()
            const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`
            setSelectedMonth(currentMonth)
        }
    }, [selectedMonth])

    // Fetch leaderboard when region or month changes
    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!selectedMonth) return

            setIsLoading(true)
            try {
                const result = await getCafeMonthlyLeaderboard(selectedRegion, 20, selectedMonth)
                setLeaderboard(result.leaderboard)
            } catch (error) {
                console.error("Failed to fetch cafe leaderboard:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchLeaderboard()
    }, [selectedRegion, selectedMonth])

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown className="w-6 h-6" />
            case 2:
            case 3:
                return <Medal className="w-6 h-6" />
            default:
                return null
        }
    }

    // Get formatted month name for display
    const monthName = selectedMonth ? formatYearMonth(selectedMonth) : ""

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-text">
                        Cafe Leaderboard
                    </h2>
                    <p className="text-text/60 mt-1">
                        {monthName} — Most popular cafes
                    </p>
                </div>
            </div>

            {/* Region and Month Toggle */}
            <div className="flex flex-wrap items-center gap-2 mb-8">
                <button
                    onClick={() => setSelectedRegion(null)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                        selectedRegion === null
                            ? "bg-primary text-white shadow-sm"
                            : "bg-background border border-secondary/20 text-text/70 hover:border-primary/30 hover:text-text"
                    }`}
                >
                    <Users className="w-4 h-4" />
                    Nationwide
                </button>

                <div
                    className="relative"
                    ref={dropdownRef}
                >
                    <button
                        onClick={() =>
                            setShowRegionDropdown(!showRegionDropdown)
                        }
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                            selectedRegion
                                ? "bg-primary text-white shadow-sm"
                                : "bg-background border border-secondary/20 text-text/70 hover:border-primary/30 hover:text-text"
                        }`}
                    >
                        <MapPin className="w-4 h-4" />
                        {selectedRegion || "Select Region"}
                        <ChevronDown
                            className={`w-4 h-4 transition-transform ${showRegionDropdown ? "rotate-180" : ""}`}
                        />
                    </button>

                    <AnimatePresence>
                        {showRegionDropdown && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 mt-2 w-56 bg-background border border-secondary/20 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto"
                            >
                                {regions.map((region) => (
                                    <button
                                        key={region}
                                        onClick={() => {
                                            setSelectedRegion(region)
                                            setShowRegionDropdown(false)
                                        }}
                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-secondary/10 transition-colors ${
                                            selectedRegion === region
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-text/80"
                                        }`}
                                    >
                                        {region}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Month Selector */}
                <div
                    className="relative"
                    ref={monthDropdownRef}
                >
                    <button
                        onClick={() =>
                            setShowMonthDropdown(!showMonthDropdown)
                        }
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer bg-background border border-secondary/20 text-text/70 hover:border-primary/30 hover:text-text"
                    >
                        <Calendar className="w-4 h-4" />
                        {selectedMonth ? formatYearMonth(selectedMonth) : "Select Month"}
                        <ChevronDown
                            className={`w-4 h-4 transition-transform ${showMonthDropdown ? "rotate-180" : ""}`}
                        />
                    </button>

                    <AnimatePresence>
                        {showMonthDropdown && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 mt-2 w-48 bg-background border border-secondary/20 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto"
                            >
                                {availableMonths.map((month) => (
                                    <button
                                        key={month}
                                        onClick={() => {
                                            setSelectedMonth(month)
                                            setShowMonthDropdown(false)
                                        }}
                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-secondary/10 transition-colors ${
                                            selectedMonth === month
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-text/80"
                                        }`}
                                    >
                                        {formatYearMonth(month)}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Leaderboard Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
                </div>
            ) : leaderboard.length === 0 ? (
                <div className="text-center py-16">
                    <Trophy className="w-16 h-16 text-secondary opacity-40 mx-auto mb-4" />
                    <h3 className="text-xl font-serif font-semibold text-text mb-2">
                        No cafes ranked this month
                    </h3>
                    <p className="text-text/60">
                        Check back later to see which cafes are trending!
                    </p>
                </div>
            ) : (
                <>
                    {/* Top 3 Podium */}
                    {(() => {
                        const grouped = groupByRank(leaderboard)
                        const sortedRanks = Object.keys(grouped)
                            .map(Number)
                            .sort((a, b) => a - b)
                        const topRanks = sortedRanks.slice(0, 3)

                        const getRankCardColor = (rank: number) => {
                            switch (rank) {
                                case 1:
                                    return "bg-gradient-to-br from-amber-500 to-amber-600"
                                case 2:
                                    return "bg-gradient-to-br from-gray-400 to-gray-500"
                                case 3:
                                    return "bg-gradient-to-br from-amber-700 to-amber-800"
                                default:
                                    return "bg-gradient-to-br from-secondary to-secondary/80"
                            }
                        }

                        return (
                            <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: `repeat(${topRanks.length}, minmax(0, 1fr))` }}>
                                {topRanks.map((rank) => {
                                    const entries = grouped[rank]

                                    return (
                                        <CafeRankCard
                                            key={rank}
                                            rank={rank}
                                            entries={entries}
                                            rankColor={getRankCardColor(rank)}
                                            rankIcon={getRankIcon(rank)}
                                        />
                                    )
                                })}
                            </div>
                        )
                    })()}

                    {/* Rest of Leaderboard */}
                    {leaderboard.length > 3 && (
                        <div className="bg-background border border-secondary/20 rounded-2xl overflow-hidden">
                            <div className="divide-y divide-secondary/10">
                                {leaderboard.slice(3).map((entry) => (
                                    <Link
                                        key={entry.cafeId}
                                        href={`/cafes/${entry.slug}`}
                                        className="flex items-center gap-4 p-4 hover:bg-secondary/5 transition-colors"
                                    >
                                        {/* Rank */}
                                        <div className="w-8 h-8 flex items-center justify-center text-lg font-bold text-text/40">
                                            {entry.rank}
                                        </div>

                                        {/* Thumbnail */}
                                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/20 shrink-0">
                                            {entry.thumbnail ? (
                                                <Image
                                                    src={entry.thumbnail}
                                                    alt={entry.name}
                                                    width={48}
                                                    height={48}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-text/40 font-bold">
                                                    {entry.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Name and Region */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-text truncate">
                                                {entry.name}
                                            </p>
                                            <p className="text-sm text-text/50 truncate">
                                                {entry.region}
                                            </p>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-right">
                                            {/* Rating */}
                                            {entry.avgRating ? (
                                                <div className="flex items-center gap-1">
                                                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                                    <span className="text-sm font-medium text-text">
                                                        {entry.avgRating.toFixed(1)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-text/40">—</span>
                                            )}

                                            {/* Visits */}
                                            <div className="hidden sm:block">
                                                <span className="text-sm font-medium text-text">
                                                    {entry.visitCount}
                                                </span>
                                                <span className="text-sm text-text/50 ml-1">
                                                    visits
                                                </span>
                                            </div>

                                            {/* Reviews */}
                                            <div className="hidden sm:block">
                                                <span className="text-sm font-medium text-text">
                                                    {entry.reviewCount}
                                                </span>
                                                <span className="text-sm text-text/50 ml-1">
                                                    reviews
                                                </span>
                                            </div>

                                            {/* Score */}
                                            <div>
                                                <span className="text-lg font-bold text-primary">
                                                    {entry.score}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
