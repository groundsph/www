"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, Search, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { searchCafesForBlog, getCafesByIds } from "@/app/api/actions/cafe"

interface CafeSearchResult {
    id: string
    name: string
    slug: string
    thumbnail: string
}

interface BlogCafePickerProps {
    selectedCafeIds: string[]
    onChange: (cafeIds: string[]) => void
    maxCafes?: number
}

export default function BlogCafePicker({
    selectedCafeIds,
    onChange,
    maxCafes = 5,
}: BlogCafePickerProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<CafeSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const [selectedCafes, setSelectedCafes] = useState<CafeSearchResult[]>([])

    // Stable key so array props with fresh identities don't refetch every render.
    const selectedKey = selectedCafeIds.join(",")

    // Fetch selected cafes when the selection set changes
    useEffect(() => {
        const ids = selectedKey ? selectedKey.split(",") : []
        const fetchSelectedCafes = async () => {
            if (ids.length === 0) {
                setSelectedCafes([])
                return
            }

            try {
                // Resolve by id — searching by id as a name substring never matches.
                const results = await getCafesByIds(ids)
                const byId = new Map(results.map((c) => [c.id, c]))
                setSelectedCafes(
                    ids
                        .map((id) => byId.get(id))
                        .filter((c): c is NonNullable<typeof c> => Boolean(c))
                        .map((c) => ({
                            id: c.id,
                            name: c.name,
                            slug: c.slug,
                            thumbnail: c.thumbnail,
                        }))
                )
            } catch (err) {
                console.error("Failed to load selected cafes:", err)
            }
        }

        fetchSelectedCafes()
    }, [selectedKey])

    // Search cafes when query changes
    useEffect(() => {
        const selected = selectedKey ? selectedKey.split(",") : []
        const debounceTimeout = setTimeout(async () => {
            if (searchQuery.length < 2) {
                setSearchResults([])
                return
            }

            setIsSearching(true)
            setSearchError(null)
            try {
                const results = await searchCafesForBlog(searchQuery)
                // Filter out already selected cafes
                const filtered = results.filter(
                    (cafe) => !selected.includes(cafe.id)
                )
                setSearchResults(filtered)
            } catch (err) {
                console.error("Failed to search cafes:", err)
                setSearchError("Failed to search cafes. Please try again.")
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => clearTimeout(debounceTimeout)
    }, [searchQuery, selectedKey])

    const handleAddCafe = (cafe: CafeSearchResult) => {
        if (selectedCafeIds.length >= maxCafes) return
        onChange([...selectedCafeIds, cafe.id])
        setSelectedCafes([...selectedCafes, cafe])
        setSearchQuery("")
        setSearchResults([])
    }

    const handleRemoveCafe = (cafeId: string) => {
        onChange(selectedCafeIds.filter((id) => id !== cafeId))
        setSelectedCafes(selectedCafes.filter((c) => c.id !== cafeId))
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                            selectedCafeIds.length >= maxCafes
                                ? `Maximum ${maxCafes} cafes reached`
                                : "Search cafes by name..."
                        }
                        disabled={selectedCafeIds.length >= maxCafes}
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                    )}
                </div>

                <AnimatePresence>
                    {(searchResults.length > 0 || searchError) && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-background border border-text/15 rounded-xl shadow-lg z-50 max-h-60 overflow-auto"
                        >
                            {searchError ? (
                                <div className="px-4 py-3 text-sm text-red-600 bg-red-50">
                                    {searchError}
                                </div>
                            ) : (
                                searchResults.map((cafe) => (
                                <button
                                    key={cafe.id}
                                    onClick={() => handleAddCafe(cafe)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-text/5 transition-colors text-left"
                                >
                                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-text/5 flex-shrink-0">
                                        <Image
                                            src={cafe.thumbnail}
                                            alt={cafe.name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text truncate">
                                            {cafe.name}
                                        </p>
                                        <p className="text-xs text-text/50 truncate">
                                            @{cafe.slug}
                                        </p>
                                    </div>
                                </button>
                            ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Selected Cafes */}
            <div className="flex flex-wrap gap-2">
                {selectedCafes.length === 0 && (
                    <span className="text-xs text-text/40 italic px-1">
                        No cafes tagged yet
                    </span>
                )}
                <AnimatePresence mode="popLayout">
                    {selectedCafes.map((cafe) => (
                        <motion.span
                            key={cafe.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            layout
                            className="flex items-center gap-2 pl-1 pr-1 py-1 bg-white border border-text/10 text-text/80 text-xs font-medium rounded-full shadow-sm"
                        >
                            <div className="relative w-6 h-6 rounded-full overflow-hidden bg-text/5 flex-shrink-0">
                                <Image
                                    src={cafe.thumbnail}
                                    alt={cafe.name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <span className="max-w-[120px] truncate">{cafe.name}</span>
                            <button
                                onClick={() => handleRemoveCafe(cafe.id)}
                                className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </motion.span>
                    ))}
                </AnimatePresence>
            </div>

            <p className="text-xs text-text/40 text-right">
                {selectedCafeIds.length}/{maxCafes} cafes
            </p>
        </div>
    )
}
