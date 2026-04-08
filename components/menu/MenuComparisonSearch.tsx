"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Search, X, Loader2, Coffee, UtensilsCrossed } from "lucide-react"
import { useDebounce } from "@/utils/hooks/useDebounce"
import { searchMenuItemsForComparison } from "@/utils/menu-comparison"
import { useHaptics } from "@/hooks/useHaptics"
import { cn } from "@/utils/cn"
import type { ComparableMenuItem } from "@/utils/types/menu-comparison"

interface MenuComparisonSearchProps {
	selectedItems: ComparableMenuItem[]
	onAddItem: (item: ComparableMenuItem) => void
	onRemoveItem: (itemId: string) => void
	maxItems?: number
}

interface SearchResult {
	item: ComparableMenuItem
}

export default function MenuComparisonSearch({
	selectedItems,
	onAddItem,
	onRemoveItem,
	maxItems = 4,
}: MenuComparisonSearchProps) {
	const [query, setQuery] = useState("")
	const [results, setResults] = useState<SearchResult[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [isDropdownOpen, setIsDropdownOpen] = useState(false)
	const debouncedQuery = useDebounce(query, 300)
	const inputRef = useRef<HTMLInputElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const { trigger: hapticTrigger } = useHaptics()

	const canAddMore = selectedItems.length < maxItems

	// Perform search when debounced query changes
	useEffect(() => {
		const performSearch = async () => {
			if (debouncedQuery.trim().length < 2) {
				setResults([])
				setIsDropdownOpen(false)
				return
			}

			setIsLoading(true)
			try {
				const items = await searchMenuItemsForComparison(debouncedQuery, 10)
				// Filter out already selected items
				const selectedIds = new Set(selectedItems.map((item) => item.id))
				const filtered = items
					.filter((item) => !selectedIds.has(item.id))
					.map((item) => ({ item }))
				setResults(filtered)
				setIsDropdownOpen(true)
			} catch (error) {
				console.error("Search error:", error)
				setResults([])
			} finally {
				setIsLoading(false)
			}
		}

		performSearch()
	}, [debouncedQuery, selectedItems])

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				inputRef.current &&
				!inputRef.current.contains(event.target as Node)
			) {
				setIsDropdownOpen(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	const handleAddItem = useCallback(
		(item: ComparableMenuItem) => {
			if (!canAddMore) return
			hapticTrigger("light")
			onAddItem(item)
			setQuery("")
			setResults([])
			setIsDropdownOpen(false)
			inputRef.current?.focus()
		},
		[canAddMore, hapticTrigger, onAddItem]
	)

	const handleRemoveItem = useCallback(
		(itemId: string) => {
			hapticTrigger("soft")
			onRemoveItem(itemId)
		},
		[hapticTrigger, onRemoveItem]
	)

	const formatPrice = (price: number) => {
		return `₱${price.toFixed(2)}`
	}

	return (
		<div className="space-y-3">
			{/* Selected Items Chips */}
			{selectedItems.length > 0 && (
				<div className="flex flex-wrap gap-2">
					<AnimatePresence mode="popLayout">
						{selectedItems.map((item) => (
							<motion.div
								key={item.id}
								layout
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.8 }}
								className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
							>
								<span className="truncate max-w-[150px]">{item.name}</span>
								<span className="text-text/50">·</span>
								<span className="text-xs text-text/70">{item.cafeName}</span>
								<button
									onClick={() => handleRemoveItem(item.id)}
									className="ml-1 p-0.5 hover:bg-primary/20 rounded-full transition-colors"
									aria-label={`Remove ${item.name}`}
								>
									<X className="w-3.5 h-3.5" />
								</button>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			)}

			{/* Search Input */}
			<div className="relative" ref={dropdownRef}>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={
							canAddMore
								? `Search menu items (${selectedItems.length}/${maxItems})...`
								: `Maximum ${maxItems} items reached`
						}
						disabled={!canAddMore}
						className={cn(
							"w-full pl-10 pr-10 py-2.5 bg-text/5 border border-text/20 rounded-xl",
							"focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
							"placeholder:text-text/40 text-sm",
							!canAddMore && "opacity-50 cursor-not-allowed"
						)}
					/>
					{isLoading && (
						<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 animate-spin" />
					)}
					{!isLoading && query && (
						<button
							onClick={() => {
								setQuery("")
								inputRef.current?.focus()
							}}
							className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-text/10 rounded-full transition-colors"
						>
							<X className="w-4 h-4 text-text/40" />
						</button>
					)}
				</div>

				{/* Dropdown Results */}
				<AnimatePresence>
					{isDropdownOpen && results.length > 0 && (
						<motion.div
							initial={{ opacity: 0, y: -8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							className="absolute top-full left-0 right-0 mt-2 bg-background rounded-xl border border-text/10 shadow-lg overflow-hidden z-50 max-h-[280px] overflow-y-auto"
						>
							{results.map(({ item }, index) => (
								<button
									key={item.id}
									onClick={() => handleAddItem(item)}
									className={cn(
										"w-full flex items-center gap-3 px-4 py-3 text-left",
										"hover:bg-primary/5 transition-colors",
										index !== results.length - 1 && "border-b border-text/5"
									)}
								>
									<div className="w-8 h-8 rounded-lg bg-tertiary flex items-center justify-center shrink-0">
										{item.isFood ? (
											<UtensilsCrossed className="w-4 h-4 text-text/60" />
										) : (
											<Coffee className="w-4 h-4 text-text/60" />
										)}
									</div>
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm truncate">
											{item.name}
										</p>
										<p className="text-xs text-text/50 truncate">
											{item.cafeName} · {item.category}
										</p>
									</div>
									<span className="text-sm font-semibold text-primary shrink-0">
										{formatPrice(item.price)}
									</span>
								</button>
							))}
						</motion.div>
					)}
				</AnimatePresence>

				{/* No Results State */}
				<AnimatePresence>
					{isDropdownOpen &&
						debouncedQuery.trim().length >= 2 &&
						!isLoading &&
						results.length === 0 && (
							<motion.div
								initial={{ opacity: 0, y: -8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -8 }}
								className="absolute top-full left-0 right-0 mt-2 bg-background rounded-xl border border-text/10 shadow-lg p-4 text-center z-50"
							>
								<p className="text-sm text-text/50">
									No menu items found for &quot;{debouncedQuery}&quot;
								</p>
							</motion.div>
						)}
				</AnimatePresence>
			</div>

			{/* Helper Text */}
			{selectedItems.length === 0 && (
				<p className="text-xs text-text/40">
					Search for menu items to compare. You can add up to {maxItems}{" "}
					items.
				</p>
			)}
		</div>
	)
}
