"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Trophy, Medal, Crown, Star, Info, Users, ChevronDown } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { getCafeMonthlyLeaderboard } from "@/app/api/actions/leaderboard"
import { getCafeThumbnailUrl } from "@/utils/extras"

import { groupByRank } from "./leaderboard-utils"
import { CafeLeaderboardEntry } from "@/utils/types/leaderboard"

interface CafeLeaderboardProps {
    region: string | null
    yearMonth: string
}

function CafeRankCard({
    rank,
    entries,
    rankColor,
    rankIcon,
    currentRegion,
}: {
    rank: number
    entries: CafeLeaderboardEntry[]
    rankColor: string
    rankIcon: React.ReactNode
    currentRegion: string | null
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
                        <Image
                            src={getCafeThumbnailUrl(entries[0].thumbnail)}
                            alt={entries[0].name}
                            width={56}
                            height={56}
                            className="w-14 h-14 rounded-xl object-cover border-2 border-white/50"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-lg truncate">
                            {entries[0].name}
                        </p>
                        <div className="flex items-center gap-2">
                            <p className="text-white/70 text-sm truncate">
                                {entries[0].region}
                            </p>
                            {entries[0].nationwideRank && currentRegion && (
                                <span className="text-xs text-white/60">
                                    #{entries[0].nationwideRank} nationwide
                                </span>
                            )}
                        </div>
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
                                            <Image
                                                src={getCafeThumbnailUrl(entry.thumbnail)}
                                                alt={entry.name}
                                                width={40}
                                                height={40}
                                                className="w-10 h-10 rounded-lg object-cover border border-white/30"
                                            />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">
                                                {entry.name}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-white/60 text-sm truncate">
                                                    {entry.region}
                                                </p>
                                                {entry.nationwideRank && currentRegion && (
                                                    <span className="text-xs text-white/40">
                                                        #{entry.nationwideRank} nationwide
                                                    </span>
                                                )}
                                            </div>
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
    const [isLoading, setIsLoading] = useState(true)

    // Fetch leaderboard when region or month changes
    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoading(true)
            try {
                const result = await getCafeMonthlyLeaderboard(region, 20, yearMonth)
                setLeaderboard(result.leaderboard)
            } catch (error) {
                console.error("Failed to fetch cafe leaderboard:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchLeaderboard()
    }, [region, yearMonth])

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

    return (
        <div>
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
                                        currentRegion={region}
                                    />
                                    )
                                })}
                            </div>
                        )
                    })()}

                    {/* Rest of Leaderboard */}
                    {leaderboard.length > 3 && (
                        <div className="bg-background border border-secondary/20 rounded-2xl overflow-hidden">
                            {/* Header Row with Labels */}
                            <div className="flex items-center gap-4 px-4 py-3 bg-secondary/5 border-b border-secondary/10 text-xs font-medium text-text/50 uppercase tracking-wider">
                                <div className="w-8 text-center">Rank</div>
                                <div className="w-12"></div>
                                <div className="flex-1">Cafe</div>
                                <div className="hidden sm:flex items-center gap-6 text-right">
                                    <div className="w-16 text-center">Rating</div>
                                    <div className="w-16 text-center">Visits</div>
                                    <div className="w-16 text-center">Reviews</div>
                                </div>
                                <div className="flex items-center gap-1" title="Composite score based on visits, reviews, and engagement">
                                    <span>Score</span>
                                    <Info className="w-3 h-3 text-text/30" />
                                </div>
                            </div>
                            <div className="divide-y divide-secondary/10">
                                {leaderboard.slice(3).map((entry) => (
                                    <Link
                                        key={entry.cafeId}
                                        href={`/cafes/${entry.slug}`}
                                        className="flex items-center gap-4 p-4 hover:bg-secondary/5 transition-colors group"
                                    >
                                        {/* Rank */}
                                        <div className="w-8 h-8 flex items-center justify-center text-base font-bold text-text/60">
                                            {entry.rank}
                                        </div>

                                        {/* Thumbnail */}
                                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/20 shrink-0">
                                            <Image
                                                src={getCafeThumbnailUrl(entry.thumbnail)}
                                                alt={entry.name}
                                                width={48}
                                                height={48}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Name and Region */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-text truncate group-hover:text-primary transition-colors">
                                                {entry.name}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-text/50 truncate">
                                                    {entry.region}
                                                </p>
                                                {entry.nationwideRank && region && (
                                                    <span className="text-xs text-text/40">
                                                        #{entry.nationwideRank} nationwide
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="hidden sm:flex items-center gap-6 text-right">
                                            {/* Rating */}
                                            <div className="w-16 flex items-center justify-center gap-1">
                                                {entry.avgRating ? (
                                                    <>
                                                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                                        <span className="text-sm font-medium text-text">
                                                            {entry.avgRating.toFixed(1)}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-text/30">—</span>
                                                )}
                                            </div>

                                            {/* Visits */}
                                            <div className="w-16">
                                                <span className="text-sm font-semibold text-text">
                                                    {entry.visitCount}
                                                </span>
                                            </div>

                                            {/* Reviews */}
                                            <div className="w-16">
                                                <span className="text-sm font-semibold text-text">
                                                    {entry.reviewCount}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className="w-16 text-right">
                                            <span className="text-lg font-bold text-primary">
                                                {entry.score.toLocaleString()}
                                            </span>
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
