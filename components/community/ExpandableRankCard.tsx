"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ChevronDown, MedalIcon, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface LeaderboardEntry {
    rank: number
    userId: string
    username: string
    displayName: string
    avatarUrl: string | null
    visitCount: number
    score: number
}

interface ExpandableRankCardProps {
    rank: number
    entries: LeaderboardEntry[]
    rankColor: string
    rankIcon: React.ReactNode
}

export default function ExpandableRankCard({
    rank,
    entries,
    rankColor,
    rankIcon,
}: ExpandableRankCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const hasMultiple = entries.length > 1

    return (
        <div className={`relative rounded-2xl p-6 ${rankColor} border-2 border-white/20 shadow-lg overflow-clip`}>
            {/* Rank Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                        {rankIcon ?? <MedalIcon className="w-6 h-6" />}
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg">
                            {rank === 1 ? "1st Place" : rank === 2 ? "2nd Place" : "3rd Place"}
                        </h3>
                        {hasMultiple && (
                            <p className="text-white/80 text-sm flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {entries.length} people tied
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
                    href={`/profile/${entries[0].username}`}
                    className="flex items-center gap-4"
                >
                    <div className="relative">
                        {entries[0].avatarUrl ? (
                            <Image
                                src={entries[0].avatarUrl}
                                alt={entries[0].displayName}
                                width={56}
                                height={56}
                                className="w-14 h-14 rounded-full object-cover border-2 border-white/50"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-xl border-2 border-white/50">
                                {entries[0].displayName.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-semibold text-lg">
                            {entries[0].displayName}
                        </p>
                        <p className="text-white/70 text-sm">@{entries[0].username}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-white font-bold text-2xl">{entries[0].score}</p>
                        <p className="text-white/70 text-sm">points</p>
                        <p className="text-white/60 text-xs">{entries[0].visitCount} visits</p>
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
                                    key={entry.userId}
                                    className="bg-white/10 rounded-xl p-3 backdrop-blur-sm"
                                >
                                    <Link
                                        href={`/profile/${entry.username}`}
                                        className="flex items-center gap-3"
                                    >
                                        {entry.avatarUrl ? (
                                            <Image
                                                src={entry.avatarUrl}
                                                alt={entry.displayName}
                                                width={40}
                                                height={40}
                                                className="w-10 h-10 rounded-full object-cover border border-white/30"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold border border-white/30">
                                                {entry.displayName.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="text-white font-medium">
                                                {entry.displayName}
                                            </p>
                                            <p className="text-white/60 text-sm">
                                                @{entry.username}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-bold">{entry.score}</p>
                                            <p className="text-white/60 text-xs">{entry.visitCount} visits</p>
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
