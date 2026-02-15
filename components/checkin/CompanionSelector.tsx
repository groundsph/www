"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, X, User } from "lucide-react"
import Image from "next/image"

interface UserResult {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
}

interface CompanionSelectorProps {
    selectedCompanions: UserResult[]
    onSelect: (user: UserResult) => void
    onRemove: (userId: string) => void
    maxCompanions?: number
}

export default function CompanionSelector({
    selectedCompanions,
    onSelect,
    onRemove,
    maxCompanions = 5,
}: CompanionSelectorProps) {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<UserResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showResults, setShowResults] = useState(false)

    const [error, setError] = useState<string | null>(null)

    // Debounced search
    useEffect(() => {
        if (query.length < 2) {
            setResults([])
            setError(null)
            return
        }

        const timer = setTimeout(async () => {
            setIsLoading(true)
            setError(null)
            try {
                const { searchUsers } = await import("@/app/api/actions/social")
                const { users, error: searchError } = await searchUsers(query, 10)
                
                if (searchError) {
                    console.error("[CompanionSelector] Search error:", searchError)
                    setError(searchError)
                    setResults([])
                    return
                }
                
                // Filter out already selected users
                const filtered = users.filter(
                    (u) => !selectedCompanions.some((c) => c.id === u.id)
                )
                setResults(filtered)
            } catch (error) {
                console.error("[CompanionSelector] Search failed:", error)
                setError("Search failed")
                setResults([])
            } finally {
                setIsLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query, selectedCompanions])

    const handleSelect = useCallback(
        (user: UserResult) => {
            if (selectedCompanions.length < maxCompanions) {
                onSelect(user)
                setQuery("")
                setResults([])
                setShowResults(false)
            }
        },
        [onSelect, selectedCompanions.length, maxCompanions]
    )

    const canAddMore = selectedCompanions.length < maxCompanions

    return (
        <div className='space-y-3'>
            {/* Selected companions as chips */}
            {selectedCompanions.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                    {selectedCompanions.map((companion) => (
                        <div
                            key={companion.id}
                            className='flex items-center gap-2 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm'
                        >
                            {companion.avatarUrl ? (
                                <Image
                                    src={companion.avatarUrl}
                                    alt={companion.displayName}
                                    width={20}
                                    height={20}
                                    className='w-5 h-5 rounded-full object-cover'
                                />
                            ) : (
                                <div className='w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center'>
                                    <User className='w-3 h-3' />
                                </div>
                            )}
                            <span className='font-medium'>
                                {companion.displayName}
                            </span>
                            <button
                                type='button'
                                onClick={() => onRemove(companion.id)}
                                className='hover:bg-primary/20 rounded-full p-0.5 transition-colors'
                            >
                                <X className='w-3.5 h-3.5' />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Search input */}
            {canAddMore && (
                <div className='relative'>
                    <div className='relative'>
                        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                        <input
                            type='text'
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value)
                                setShowResults(true)
                            }}
                            onFocus={() => setShowResults(true)}
                            placeholder='Search users by name or username...'
                            className='w-full pl-9 pr-4 py-2.5 bg-text/5 border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all'
                        />
                        {isLoading && (
                            <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                                <div className='w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
                            </div>
                        )}
                    </div>

                    {/* Results dropdown */}
                    {showResults && results.length > 0 && (
                        <div className='absolute top-full left-0 right-0 mt-1 bg-background border border-text/10 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto'>
                            {results.map((user) => (
                                <button
                                    key={user.id}
                                    type='button'
                                    onClick={() => handleSelect(user)}
                                    className='w-full flex items-center gap-3 px-3 py-2.5 hover:bg-text/5 transition-colors text-left'
                                >
                                    {user.avatarUrl ? (
                                        <Image
                                            src={user.avatarUrl}
                                            alt={user.displayName}
                                            width={32}
                                            height={32}
                                            className='w-8 h-8 rounded-full object-cover'
                                        />
                                    ) : (
                                        <div className='w-8 h-8 rounded-full bg-text/10 flex items-center justify-center'>
                                            <User className='w-4 h-4 text-text opacity-40' />
                                        </div>
                                    )}
                                    <div className='flex-1 min-w-0'>
                                        <p className='font-medium text-sm truncate'>
                                            {user.displayName}
                                        </p>
                                        <p className='text-xs text-text/50 truncate'>
                                            @{user.username}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Error message */}
                    {showResults && error && (
                        <div className='absolute top-full left-0 right-0 mt-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg z-50 p-3'>
                            <p className='text-sm text-red-600 dark:text-red-400 text-center'>
                                {error}
                            </p>
                        </div>
                    )}

                    {/* No results message */}
                    {showResults &&
                        query.length >= 2 &&
                        !isLoading &&
                        !error &&
                        results.length === 0 && (
                            <div className='absolute top-full left-0 right-0 mt-1 bg-background border border-text/10 rounded-lg shadow-lg z-50 p-3'>
                                <p className='text-sm text-text/50 text-center'>
                                    No users found
                                </p>
                            </div>
                        )}
                </div>
            )}

            {/* Max companions reached */}
            {!canAddMore && (
                <p className='text-xs text-text/50 text-center'>
                    Maximum {maxCompanions} companions reached
                </p>
            )}

            {/* Helper text */}
            {canAddMore && selectedCompanions.length === 0 && (
                <p className='text-xs text-text/40 text-center'>
                    Add friends who are checking in with you (optional)
                </p>
            )}
        </div>
    )
}
