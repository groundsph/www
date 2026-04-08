"use client"

import { useState, useEffect, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Trophy, MapPin, Users, ChevronDown, Medal, Crown, Calendar, Coffee } from "lucide-react"
import Link from "next/link"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { getMonthlyLeaderboard } from "@/app/api/actions/profile"
import CafeMonthlyLeaderboard from "./CafeMonthlyLeaderboard"
import { useUserLocation } from "@/hooks/useUserLocation"
import { getLastNMonths, formatYearMonth } from "@/utils/date/leaderboard-months"
import { groupByRank } from "./leaderboard-utils"
import ExpandableRankCard from "./ExpandableRankCard"
import { PH_REGIONS } from "@/utils/ph-regions"

interface LeaderboardEntry {
    rank: number
    userId: string
    username: string
    displayName: string
    avatarUrl: string | null
    visitCount: number
    score: number
}

type LeaderboardMode = "users" | "cafes"

interface MonthlyLeaderboardProps {
    className?: string
}

export default function MonthlyLeaderboard({
    className = "",
}: MonthlyLeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [userRank, setUserRank] = useState<number | null>(null)
    const [mode, setMode] = useState<LeaderboardMode>("users")
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
    const [userPreferredRegion, setUserPreferredRegion] = useState<
        string | null
    >(null)
    const [isLoading, setIsLoading] = useState(true)
    const [showRegionDropdown, setShowRegionDropdown] = useState(false)
    const [showMonthDropdown, setShowMonthDropdown] = useState(false)
    const [selectedMonth, setSelectedMonth] = useState<string>("")
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

    // Philippines regions for dropdown (matching database format)
    const regions = PH_REGIONS

    // Mapping from geolocation region names to database region codes
    const regionMapping: Record<string, string> = {
        "Metro Manila": "NCR - National Capital Region",
        "National Capital Region": "NCR - National Capital Region",
        "Ilocos Region": "Region I - Ilocos Region",
        Ilocos: "Region I - Ilocos Region",
        "Cagayan Valley": "Region II - Cagayan Valley",
        "Central Luzon": "Region III - Central Luzon",
        CALABARZON: "Region IV-A - CALABARZON",
        Calabarzon: "Region IV-A - CALABARZON",
        MIMAROPA: "Region IV-B - MIMAROPA",
        Mimaropa: "Region IV-B - MIMAROPA",
        "Bicol Region": "Region V - Bicol Region",
        Bicol: "Region V - Bicol Region",
        "Western Visayas": "Region VI - Western Visayas",
        "Central Visayas": "Region VII - Central Visayas",
        "Eastern Visayas": "Region VIII - Eastern Visayas",
        "Zamboanga Peninsula": "Region IX - Zamboanga Peninsula",
        "Northern Mindanao": "Region X - Northern Mindanao",
        "Davao Region": "Region XI - Davao Region",
        Davao: "Region XI - Davao Region",
        SOCCSKSARGEN: "Region XII - SOCCSKSARGEN",
        Soccsksargen: "Region XII - SOCCSKSARGEN",
        Caraga: "Region XIII - Caraga",
        CARAGA: "Region XIII - Caraga",
        Bangsamoro: "BARMM - Bangsamoro",
        BARMM: "BARMM - Bangsamoro",
    }

    // Use geolocation for region detection
    const { location, loading: locationLoading } = useUserLocation()

    // Auto-select region from geolocation
    useEffect(() => {
        if (!locationLoading && location.region && !userPreferredRegion) {
            // Map geolocation region to database region code
            const mappedRegion =
                regionMapping[location.region] || location.region
            // Only set if it's a valid region
            if ((regions as readonly string[]).includes(mappedRegion)) {
                setUserPreferredRegion(mappedRegion)
                setSelectedRegion(mappedRegion)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.region, locationLoading, userPreferredRegion])

    // Initialize selected month to current month
    useEffect(() => {
        if (!selectedMonth) {
            const now = new Date()
            const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`
            setSelectedMonth(currentMonth)
        }
    }, [selectedMonth])

    // Fetch leaderboard when region, month, or mode changes
    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!selectedMonth) return

            setIsLoading(true)
            try {
                if (mode === "users") {
                    const result = await getMonthlyLeaderboard(selectedRegion, 20, selectedMonth)
                    setLeaderboard(result.leaderboard)
                    setUserRank(result.userRank)
                } else {
                    // Cafe leaderboard is handled by the CafeMonthlyLeaderboard component
                    // We just clear user-specific state when switching to cafes
                    setLeaderboard([])
                    setUserRank(null)
                }
            } catch (error) {
                console.error("Failed to fetch leaderboard:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchLeaderboard()
    }, [selectedRegion, selectedMonth, mode])

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown className='w-6 h-6' />
            case 2:
            case 3:
                return <Medal className='w-6 h-6' />
            default:
                return null
        }
    }



    // Get formatted month name for display
    const monthName = selectedMonth ? formatYearMonth(selectedMonth) : ""

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className='flex flex-col md:flex-row md:items-center gap-2 justify-between mb-6'>
                <div>
                    <h2 className='text-2xl font-serif font-bold text-text'>
                        Monthly Leaderboard
                    </h2>
                    <p className='text-text/60 mt-1'>
                        {monthName} — {mode === "users" ? "Top cafe explorers" : "Most popular cafes"}
                    </p>
                </div>

                    {/* Mode Toggle */}
                <div className='flex items-center gap-1 bg-secondary/10 rounded-lg p-1 w-max'>
                    <button
                        onClick={() => setMode("users")}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            mode === "users"
                                ? "bg-primary text-white shadow-sm"
                                : "text-text/70 hover:text-text"
                        }`}
                    >
                        <Users className='w-4 h-4' />
                        Top Users
                    </button>
                    <button
                        onClick={() => setMode("cafes")}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            mode === "cafes"
                                ? "bg-primary text-white shadow-sm"
                                : "text-text/70 hover:text-text"
                        }`}
                    >
                        <Coffee className='w-4 h-4' />
                        Top Cafes
                    </button>
                </div>
            </div>

            {/* Region and Month Toggle */}
            <div className='flex flex-wrap items-center gap-2 mb-8'>
                <button
                    onClick={() => setSelectedRegion(null)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                        selectedRegion === null
                            ? "bg-primary text-white shadow-sm"
                            : "bg-background border border-secondary/20 text-text/70 hover:border-primary/30 hover:text-text"
                    }`}
                >
                    <Users className='w-4 h-4' />
                    Nationwide
                </button>

                <div
                    className='relative'
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
                        <MapPin className='w-4 h-4' />
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
                                className='absolute top-full left-0 mt-2 w-56 bg-background border border-secondary/20 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto'
                            >
                                {userPreferredRegion && (
                                    <button
                                        onClick={() => {
                                            setSelectedRegion(
                                                userPreferredRegion
                                            )
                                            setShowRegionDropdown(false)
                                        }}
                                        className='w-full px-4 py-3 text-left text-sm hover:bg-secondary/10 flex items-center gap-2 border-b border-secondary/10 font-medium'
                                    >
                                        <MapPin className='w-4 h-4 text-primary' />
                                        Your Area ({userPreferredRegion})
                                    </button>
                                )}
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
                    className='relative'
                    ref={monthDropdownRef}
                >
                    <button
                        onClick={() =>
                            setShowMonthDropdown(!showMonthDropdown)
                        }
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer bg-background border border-secondary/20 text-text/70 hover:border-primary/30 hover:text-text"
                    >
                        <Calendar className='w-4 h-4' />
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
                                className='absolute top-full left-0 mt-2 w-48 bg-background border border-secondary/20 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto'
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

            {/* Leaderboard Content */}
            {mode === "cafes" ? (
                <CafeMonthlyLeaderboard 
                    region={selectedRegion} 
                    yearMonth={selectedMonth} 
                />
            ) : isLoading ? (
                <div className='flex items-center justify-center py-16'>
                    <div className='animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full' />
                </div>
            ) : leaderboard.length === 0 ? (
                <div className='text-center py-16'>
                    <Trophy className='w-16 h-16 text-secondary opacity-40 mx-auto mb-4' />
                    <h3 className='text-xl font-serif font-semibold text-text mb-2'>
                        No check-ins this month
                    </h3>
                    <p className='text-text/60'>
                        Be the first to top the leaderboard by exploring cafes!
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
                            <div className='md:grid flex flex-col gap-4 mb-8' style={{ gridTemplateColumns: `repeat(${topRanks.length}, minmax(0, 1fr))` }}>
                                {topRanks.map((rank) => {
                                    const entries = grouped[rank]

                                    return (
                                        <ExpandableRankCard
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
                        <div className='bg-background border border-secondary/20 rounded-2xl overflow-hidden'>
                            <div className='divide-y divide-secondary/10'>
                                {leaderboard.slice(3).map((entry) => (
                                    <Link
                                        key={entry.userId}
                                        href={`/profile/${entry.username}`}
                                        className='flex items-center gap-4 p-4 hover:bg-secondary/5 transition-colors'
                                    >
                                        {/* Rank */}
                                        <div className='w-8 h-8 flex items-center justify-center text-lg font-bold text-text/40'>
                                            {entry.rank}
                                        </div>

                                        {/* Avatar */}
                                        <UserAvatar src={entry.avatarUrl} alt={entry.displayName} size={48} />

                                        {/* Name */}
                                        <div className='flex-1 min-w-0'>
                                            <p className='font-medium text-text truncate'>
                                                {entry.displayName}
                                            </p>
                                            <p className='text-sm text-text/50'>
                                                @{entry.username}
                                            </p>
                                        </div>

                                        {/* Score */}
                                        <div className='text-right'>
                                            <span className='text-xl font-bold text-primary'>
                                                {entry.score}
                                            </span>
                                            <span className='text-sm text-text/50 ml-1'>
                                                points
                                            </span>
                                            <p className='text-xs text-text/40'>
                                                {entry.visitCount} visits
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* User's Rank if not in top 20 */}
                    {userRank && userRank > 20 && (
                        <div className='mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl text-center'>
                            <p className='text-text/80'>
                                Your rank:{" "}
                                <span className='font-bold text-primary text-xl'>
                                    #{userRank}
                                </span>
                            </p>
                            <p className='text-sm text-text/50 mt-1'>
                                Keep exploring to climb the leaderboard!
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
