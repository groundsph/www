"use client"

import { useState, useEffect, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Trophy, MapPin, Users, ChevronDown, Medal, Crown, Calendar } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { getMonthlyLeaderboard } from "@/app/api/actions/profile"
import { useUserLocation } from "@/hooks/useUserLocation"
import { getLastNMonths, formatYearMonth } from "@/utils/date/leaderboard-months"
import { groupByRank } from "./leaderboard-utils"

interface LeaderboardEntry {
    rank: number
    userId: string
    username: string
    displayName: string
    avatarUrl: string | null
    visitCount: number
}

interface MonthlyLeaderboardProps {
    className?: string
}

export default function MonthlyLeaderboard({
    className = "",
}: MonthlyLeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [userRank, setUserRank] = useState<number | null>(null)
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
            if (regions.includes(mappedRegion)) {
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

    // Fetch leaderboard when region or month changes
    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!selectedMonth) return

            setIsLoading(true)
            try {
                const result = await getMonthlyLeaderboard(selectedRegion, 20, selectedMonth)
                setLeaderboard(result.leaderboard)
                setUserRank(result.userRank)
            } catch (error) {
                console.error("Failed to fetch leaderboard:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchLeaderboard()
    }, [selectedRegion, selectedMonth])

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown className='w-6 h-6 text-amber-500' />
            case 2:
                return <Medal className='w-6 h-6 text-gray-400' />
            case 3:
                return <Medal className='w-6 h-6 text-amber-700' />
            default:
                return null
        }
    }

    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 1:
                return "bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border-amber-500/20"
            case 2:
                return "bg-gradient-to-r from-gray-400/10 via-gray-300/5 to-transparent border-gray-400/20"
            case 3:
                return "bg-gradient-to-r from-amber-700/10 via-amber-600/5 to-transparent border-amber-700/20"
            default:
                return "bg-background border-secondary/20 hover:border-primary/30"
        }
    }

    // Get formatted month name for display
    const monthName = selectedMonth ? formatYearMonth(selectedMonth) : ""

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className='flex items-center justify-between mb-6'>
                <div>
                    <h2 className='text-2xl font-serif font-bold text-text'>
                        Monthly Leaderboard
                    </h2>
                    <p className='text-text/60 mt-1'>
                        {monthName} — Top cafe explorers
                    </p>
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

            {/* Leaderboard Grid */}
            {isLoading ? (
                <div className='flex items-center justify-center py-16'>
                    <div className='animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full' />
                </div>
            ) : leaderboard.length === 0 ? (
                <div className='text-center py-16'>
                    <Trophy className='w-16 h-16 text-secondary/40 mx-auto mb-4' />
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

                        return (
                            <div className='grid gap-4 mb-8' style={{ gridTemplateColumns: `repeat(${topRanks.length}, minmax(0, 1fr))` }}>
                                {topRanks.map((rank) => {
                                    const entries = grouped[rank]
                                    const isTied = entries.length > 1

                                    return (
                                        <div key={rank} className={`flex ${isTied ? 'flex-row gap-2' : 'flex-col'} items-stretch`}>
                                            {entries.map((entry) => (
                                                <Link
                                                    key={entry.userId}
                                                    href={`/profile/${entry.username}`}
                                                    className={`group block bg-background border rounded-2xl p-6 text-center hover:shadow-lg transition-all ${getRankStyle(entry.rank)} ${isTied ? 'flex-1' : ''}`}
                                                >
                                                    {/* Rank Badge */}
                                                    <div className='flex justify-center mb-4'>
                                                        <div
                                                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                                                entry.rank === 1
                                                                    ? "bg-amber-500/20"
                                                                    : entry.rank === 2
                                                                        ? "bg-gray-400/20"
                                                                        : "bg-amber-700/20"
                                                            }`}
                                                        >
                                                            {getRankIcon(entry.rank)}
                                                        </div>
                                                    </div>

                                                    {/* Avatar */}
                                                    <div className='relative w-20 h-20 mx-auto mb-3'>
                                                        {entry.avatarUrl ? (
                                                            <Image
                                                                src={entry.avatarUrl}
                                                                alt={entry.displayName}
                                                                width={80}
                                                                height={80}
                                                                className='rounded-full object-cover w-full h-full ring-4 ring-background'
                                                            />
                                                        ) : (
                                                            <div className='w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary'>
                                                                {entry.displayName
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Name */}
                                                    <h4 className='font-semibold text-text group-hover:text-primary transition-colors'>
                                                        {entry.displayName}
                                                    </h4>
                                                    <p className='text-sm text-text/50'>
                                                        @{entry.username}
                                                    </p>

                                                    {/* Visit Count */}
                                                    <div className='mt-3 inline-block px-4 py-1.5 bg-primary/10 rounded-full'>
                                                        <span className='text-lg font-bold text-primary'>
                                                            {entry.visitCount}
                                                        </span>
                                                        <span className='text-sm text-text/60 ml-1'>
                                                            visits
                                                        </span>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
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
                                        <div className='w-12 h-12 rounded-full overflow-hidden bg-secondary/20 shrink-0'>
                                            {entry.avatarUrl ? (
                                                <Image
                                                    src={entry.avatarUrl}
                                                    alt={entry.displayName}
                                                    width={48}
                                                    height={48}
                                                    className='w-full h-full object-cover'
                                                />
                                            ) : (
                                                <div className='w-full h-full flex items-center justify-center text-text/40 font-bold'>
                                                    {entry.displayName
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Name */}
                                        <div className='flex-1 min-w-0'>
                                            <p className='font-medium text-text truncate'>
                                                {entry.displayName}
                                            </p>
                                            <p className='text-sm text-text/50'>
                                                @{entry.username}
                                            </p>
                                        </div>

                                        {/* Visit Count */}
                                        <div className='text-right'>
                                            <span className='text-xl font-bold text-primary'>
                                                {entry.visitCount}
                                            </span>
                                            <span className='text-sm text-text/50 ml-1'>
                                                visits
                                            </span>
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
