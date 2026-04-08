"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Scale, Share2, Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import MenuComparisonSearch from "./MenuComparisonSearch"
import ComparisonTable from "./ComparisonTable"
import { useHaptics } from "@/hooks/useHaptics"
import { cn } from "@/utils/cn"
import type { ComparableMenuItem } from "@/utils/types/menu-comparison"

interface MenuComparisonModalProps {
	isOpen: boolean
	onClose: () => void
	initialItemIds?: string[]
}

// Mock function to fetch items by IDs - in real implementation this would be a server action
async function fetchMenuItemsByIds(ids: string[]): Promise<ComparableMenuItem[]> {
	// For now, return empty - this would need a proper server action to fetch by IDs
	// In a real implementation, you'd create a server action that queries the DB for these specific IDs
	console.log("Fetching items by IDs:", ids)
	return []
}

export default function MenuComparisonModal({
	isOpen,
	onClose,
	initialItemIds = [],
}: MenuComparisonModalProps) {
	const [selectedItems, setSelectedItems] = useState<ComparableMenuItem[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [isSharing, setIsSharing] = useState(false)
	const [shareSuccess, setShareSuccess] = useState(false)
	const searchParams = useSearchParams()
	const { trigger: hapticTrigger } = useHaptics()

	// Load initial items from URL params when modal opens
	useEffect(() => {
		if (!isOpen) return

		const loadInitialItems = async () => {
			// Check URL params for item IDs
			const compareParam = searchParams.get("compare")
			const ids = compareParam
				? compareParam.split(",").filter(Boolean)
				: initialItemIds

			if (ids.length > 0) {
				setIsLoading(true)
				try {
					const items = await fetchMenuItemsByIds(ids)
					if (items.length > 0) {
						setSelectedItems(items.slice(0, 4))
					}
				} catch (error) {
					console.error("Error loading initial items:", error)
				} finally {
					setIsLoading(false)
				}
			}
		}

		loadInitialItems()
	}, [isOpen, searchParams, initialItemIds])

	const handleAddItem = useCallback((item: ComparableMenuItem) => {
		setSelectedItems((prev) => {
			if (prev.length >= 4 || prev.some((i) => i.id === item.id)) {
				return prev
			}
			return [...prev, item]
		})
	}, [])

	const handleRemoveItem = useCallback((itemId: string) => {
		setSelectedItems((prev) => prev.filter((item) => item.id !== itemId))
	}, [])

	const handleClose = useCallback(() => {
		hapticTrigger("soft")
		onClose()
	}, [hapticTrigger, onClose])

	const handleShare = useCallback(async () => {
		if (selectedItems.length === 0) return

		setIsSharing(true)
		setShareSuccess(false)
		hapticTrigger("light")

		try {
			// Build shareable URL with item IDs
			const itemIds = selectedItems.map((item) => item.id).join(",")
			const url = new URL(window.location.href)
			url.searchParams.set("compare", itemIds)

			// Copy to clipboard
			await navigator.clipboard.writeText(url.toString())

			// Update URL without reloading
			window.history.replaceState({}, "", url.toString())

			setShareSuccess(true)
			setTimeout(() => setShareSuccess(false), 2000)
		} catch (error) {
			console.error("Error sharing:", error)
		} finally {
			setIsSharing(false)
		}
	}, [selectedItems, hapticTrigger])

	// Handle escape key
	useEffect(() => {
		if (!isOpen) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				handleClose()
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [isOpen, handleClose])

	// Prevent body scroll when modal is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden"
		} else {
			document.body.style.overflow = ""
		}
		return () => {
			document.body.style.overflow = ""
		}
	}, [isOpen])

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onClick={handleClose}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
					/>

					{/* Modal */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
						className={cn(
							"fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2",
							"md:-translate-x-1/2 md:-translate-y-1/2",
							"md:w-[90vw] md:max-w-4xl md:max-h-[85vh]",
							"bg-background rounded-2xl shadow-2xl z-50",
							"flex flex-col overflow-hidden"
						)}
					>
						{/* Header */}
						<div className="flex items-center justify-between p-4 md:p-6 border-b border-text/10 shrink-0">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
									<Scale className="w-5 h-5 text-primary" />
								</div>
								<div>
									<h2 className="font-semibold text-lg">
										Compare Menu Items
									</h2>
									<p className="text-sm text-text/60">
										Side-by-side comparison
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{selectedItems.length > 0 && (
									<button
										onClick={handleShare}
										disabled={isSharing}
										className={cn(
											"flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
											"transition-colors cursor-pointer",
											shareSuccess
												? "bg-green-100 text-green-700"
												: "bg-primary/10 text-primary hover:bg-primary/20"
										)}
									>
										{isSharing ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<Share2 className="w-4 h-4" />
										)}
										{shareSuccess ? "Copied!" : "Share"}
									</button>
								)}
								<button
									onClick={handleClose}
									className="p-2 rounded-lg hover:bg-text/10 transition-colors cursor-pointer"
									aria-label="Close modal"
								>
									<X className="w-5 h-5" />
								</button>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-4 md:p-6">
							{isLoading ? (
								<div className="flex flex-col items-center justify-center py-12">
									<Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
									<p className="text-sm text-text/60">Loading items...</p>
								</div>
							) : (
								<div className="space-y-6">
									{/* Search Section */}
									<section>
										<h3 className="text-sm font-medium text-text/70 mb-3">
											Add Items to Compare
										</h3>
										<MenuComparisonSearch
											selectedItems={selectedItems}
											onAddItem={handleAddItem}
											onRemoveItem={handleRemoveItem}
											maxItems={4}
										/>
									</section>

									{/* Divider */}
									{selectedItems.length > 0 && (
										<hr className="border-text/10" />
									)}

									{/* Comparison Table */}
									<section>
										{selectedItems.length > 0 && (
											<div className="flex items-center justify-between mb-4">
												<h3 className="text-sm font-medium text-text/70">
													Comparison
												</h3>
												<span className="text-xs text-text/50">
													{selectedItems.length}/4 items
												</span>
											</div>
										)}
										<ComparisonTable items={selectedItems} />
									</section>
								</div>
							)}
						</div>

						{/* Footer */}
						<div className="px-4 md:px-6 py-3 border-t border-text/10 bg-text/[0.02] shrink-0">
							<div className="flex items-center justify-between text-xs text-text/50">
								<span>
									{selectedItems.length > 0
										? `${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"} selected`
										: "Select items to compare"}
								</span>
								<span className="hidden sm:inline">
									Press ESC to close
								</span>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	)
}
