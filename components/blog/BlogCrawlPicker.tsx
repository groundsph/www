"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, Search, Loader2, ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { searchCafeCrawls } from "@/app/api/actions/cafe-crawls"

interface CrawlSearchResult {
    id: string
    title: string
    slug: string
    coverImage: string | null
}

interface BlogCrawlPickerProps {
    selectedCrawlId: string | null
    onChange: (crawlId: string | null) => void
}

export default function BlogCrawlPicker({
    selectedCrawlId,
    onChange,
}: BlogCrawlPickerProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<CrawlSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [selectedCrawl, setSelectedCrawl] = useState<CrawlSearchResult | null>(null)

    // Fetch selected crawl on mount
    useEffect(() => {
        const fetchSelectedCrawl = async () => {
            if (!selectedCrawlId) {
                setSelectedCrawl(null)
                return
            }

            // Search by ID to get crawl details
            const results = await searchCafeCrawls(selectedCrawlId)
            const crawl = results.find((c) => c.id === selectedCrawlId)
            if (crawl) {
                setSelectedCrawl(crawl)
            }
        }

        fetchSelectedCrawl()
    }, [selectedCrawlId])

    // Search crawls when query changes
    useEffect(() => {
        const debounceTimeout = setTimeout(async () => {
            if (searchQuery.length < 2) {
                setSearchResults([])
                return
            }

            setIsSearching(true)
            setSearchError(null)
            try {
                const results = await searchCafeCrawls(searchQuery)
                // Filter out already selected crawl
                const filtered = results.filter(
                    (crawl) => crawl.id !== selectedCrawlId
                )
                setSearchResults(filtered)
            } catch (err) {
                console.error("Failed to search crawls:", err)
                setSearchError("Failed to search crawls. Please try again.")
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => clearTimeout(debounceTimeout)
    }, [searchQuery, selectedCrawlId])

    const handleSelectCrawl = (crawl: CrawlSearchResult) => {
        onChange(crawl.id)
        setSelectedCrawl(crawl)
        setSearchQuery("")
        setSearchResults([])
        setIsOpen(false)
    }

    const handleClearCrawl = () => {
        onChange(null)
        setSelectedCrawl(null)
        setSearchQuery("")
        setSearchResults([])
    }

    if (selectedCrawl) {
        return (
            <div className="bg-white border border-text/10 rounded-xl p-3 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-text/5 flex-shrink-0">
                        {selectedCrawl.coverImage ? (
                            <Image
                                src={selectedCrawl.coverImage}
                                alt={selectedCrawl.title}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                <span className="text-lg">🗺️</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">
                            {selectedCrawl.title}
                        </p>
                        <p className="text-xs text-text/50 truncate">
                            /crawls/{selectedCrawl.slug}
                        </p>
                    </div>
                    <button
                        onClick={handleClearCrawl}
                        className="p-2 hover:bg-red-50 text-text/50 hover:text-red-500 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-text/15 bg-background hover:border-primary/50 transition-all text-left"
            >
                <span className="text-sm text-text/60">
                    Select a crawl to link...
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-text/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-background border border-text/15 rounded-xl shadow-lg z-50 overflow-hidden"
                    >
                        <div className="p-3 border-b border-text/10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search crawls..."
                                    autoFocus
                                    className="w-full pl-10 pr-10 py-2 rounded-lg border border-text/15 bg-background focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all"
                                />
                                {isSearching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                                )}
                            </div>
                        </div>

                        <div className="max-h-60 overflow-auto">
                            {searchError ? (
                                <div className="px-4 py-4 text-sm text-red-600 bg-red-50">
                                    {searchError}
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="px-4 py-6 text-center">
                                    {searchQuery.length >= 2 ? (
                                        <p className="text-sm text-text/50">
                                            No crawls found
                                        </p>
                                    ) : (
                                        <p className="text-sm text-text/40">
                                            Type at least 2 characters to search
                                        </p>
                                    )}
                                </div>
                            ) : (
                                searchResults.map((crawl) => (
                                    <button
                                        key={crawl.id}
                                        onClick={() => handleSelectCrawl(crawl)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-text/5 transition-colors text-left"
                                    >
                                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-text/5 flex-shrink-0">
                                            {crawl.coverImage ? (
                                                <Image
                                                    src={crawl.coverImage}
                                                    alt={crawl.title}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                                    <span>🗺️</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-text truncate">
                                                {crawl.title}
                                            </p>
                                            <p className="text-xs text-text/50 truncate">
                                                /crawls/{crawl.slug}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
