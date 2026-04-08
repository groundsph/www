"use client"

import { motion } from "motion/react"
import { Coffee, UtensilsCrossed, Flame, Snowflake, Leaf, WheatOff, Check, X } from "lucide-react"
import { cn } from "@/utils/cn"
import type { ComparableMenuItem } from "@/utils/types/menu-comparison"

interface ComparisonTableProps {
	items: ComparableMenuItem[]
}

export default function ComparisonTable({ items }: ComparisonTableProps) {
	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<div className="w-16 h-16 rounded-full bg-text/5 flex items-center justify-center mb-4">
					<Coffee className="w-8 h-8 text-text/30" />
				</div>
				<h3 className="text-lg font-medium text-text/70 mb-1">
					No items to compare
				</h3>
				<p className="text-sm text-text/50 max-w-xs">
					Search and add menu items above to start comparing them side-by-side
				</p>
			</div>
		)
	}

	const formatPrice = (price: number) => `₱${price.toFixed(2)}`

	const getTypeLabel = (item: ComparableMenuItem) => {
		if (item.isFood) return "Food"
		return "Drink"
	}

	const getTypeIcon = (item: ComparableMenuItem) => {
		if (item.isFood) {
			return <UtensilsCrossed className="w-3.5 h-3.5" />
		}
		return <Coffee className="w-3.5 h-3.5" />
	}

	const getTemperatureDisplay = (item: ComparableMenuItem) => {
		if (item.isHot && item.isCold) {
			return (
				<div className="flex items-center gap-1">
					<Flame className="w-3.5 h-3.5 text-orange-500" />
					<span className="text-text/40">/</span>
					<Snowflake className="w-3.5 h-3.5 text-blue-400" />
				</div>
			)
		}
		if (item.isHot) {
			return <Flame className="w-3.5 h-3.5 text-orange-500" />
		}
		if (item.isCold) {
			return <Snowflake className="w-3.5 h-3.5 text-blue-400" />
		}
		return <span className="text-text/30">-</span>
	}

	const getDietaryDisplay = (item: ComparableMenuItem) => {
		const badges = []
		if (item.isVegan) {
			badges.push(
				<span
					key="vegan"
					className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium"
				>
					<Leaf className="w-3 h-3" />
					Vegan
				</span>
			)
		}
		if (item.isVegetarian && !item.isVegan) {
			badges.push(
				<span
					key="veg"
					className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium"
				>
					<WheatOff className="w-3 h-3" />
					Veg
				</span>
			)
		}
		if (badges.length === 0) {
			return <span className="text-text/30">-</span>
		}
		return <div className="flex flex-wrap gap-1">{badges}</div>
	}

	const getSizesDisplay = (item: ComparableMenuItem) => {
		if (!item.sizeOptions || item.sizeOptions.length === 0) {
			return <span className="text-text/30">-</span>
		}
		return (
			<div className="space-y-1">
				{item.sizeOptions.map((size, idx) => (
					<div key={idx} className="flex items-center justify-between text-xs">
						<span className="text-text/60">{size.label}</span>
						<span className="font-medium">+₱{size.price}</span>
					</div>
				))}
			</div>
		)
	}

	const getAvailabilityDisplay = (isAvailable: boolean) => {
		if (isAvailable) {
			return (
				<div className="flex items-center justify-center">
					<div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
						<Check className="w-4 h-4 text-green-600" />
					</div>
				</div>
			)
		}
		return (
			<div className="flex items-center justify-center">
				<div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
					<X className="w-4 h-4 text-red-600" />
				</div>
			</div>
		)
	}

	const getCaloriesDisplay = (calories: number | null) => {
		if (calories === null) return <span className="text-text/30">-</span>
		return <span>{calories} kcal</span>
	}

	// Define rows for the comparison table
	const rows = [
		{
			label: "Cafe",
			getValue: (item: ComparableMenuItem) => (
				<a
					href={`/cafe/${item.cafeSlug}`}
					className="text-primary hover:underline font-medium"
				>
					{item.cafeName}
				</a>
			),
		},
		{
			label: "Name",
			getValue: (item: ComparableMenuItem) => (
				<span className="font-semibold">{item.name}</span>
			),
		},
		{
			label: "Price",
			getValue: (item: ComparableMenuItem) => (
				<span className="text-lg font-bold text-primary">
					{formatPrice(item.price)}
				</span>
			),
		},
		{
			label: "Category",
			getValue: (item: ComparableMenuItem) => item.category,
		},
		{
			label: "Type",
			getValue: (item: ComparableMenuItem) => (
				<div className="flex items-center gap-1.5 text-text/70">
					{getTypeIcon(item)}
					<span>{getTypeLabel(item)}</span>
				</div>
			),
		},
		{
			label: "Calories",
			getValue: (item: ComparableMenuItem) => getCaloriesDisplay(item.calories),
		},
		{
			label: "Hot/Cold",
			getValue: (item: ComparableMenuItem) => getTemperatureDisplay(item),
		},
		{
			label: "Dietary",
			getValue: (item: ComparableMenuItem) => getDietaryDisplay(item),
		},
		{
			label: "Sizes",
			getValue: (item: ComparableMenuItem) => getSizesDisplay(item),
		},
		{
			label: "Available",
			getValue: (item: ComparableMenuItem) => getAvailabilityDisplay(item.isAvailable),
			center: true,
		},
	]

	return (
		<div className="overflow-x-auto -mx-4 px-4">
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="min-w-[600px]"
			>
				<table className="w-full border-collapse">
					<thead>
						<tr>
							<th className="text-left py-3 px-4 bg-text/5 rounded-tl-lg font-medium text-sm text-text/70 sticky left-0 z-10 min-w-[100px]">
								Property
							</th>
							{items.map((item, index) => (
								<th
									key={item.id}
									className={cn(
										"py-3 px-4 text-center min-w-[140px]",
										"bg-text/5 font-medium text-sm text-text/70",
										index === items.length - 1 && "rounded-tr-lg"
									)}
								>
									<span className="truncate block max-w-[120px] mx-auto">
										Item {index + 1}
									</span>
								</th>
							))}
							{/* Empty columns to maintain 4-column layout */}
							{Array.from({ length: Math.max(0, 4 - items.length) }).map(
								(_, index) => (
									<th
										key={`empty-${index}`}
										className={cn(
											"py-3 px-4 text-center min-w-[140px]",
											"bg-text/5 font-medium text-sm text-text/30",
											index === Math.max(0, 4 - items.length) - 1 &&
												items.length === 0 &&
												"rounded-tr-lg"
										)}
									>
										—
									</th>
								)
							)}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, rowIndex) => (
							<tr
								key={row.label}
								className={cn(
									"border-t border-text/10",
									rowIndex === rows.length - 1 && "border-b border-text/10"
								)}
							>
								<td
									className={cn(
										"py-3 px-4 text-sm text-text/60 font-medium sticky left-0 bg-background",
										rowIndex === rows.length - 1 && "rounded-bl-lg"
									)}
								>
									{row.label}
								</td>
								{items.map((item, colIndex) => (
									<td
										key={item.id}
										className={cn(
											"py-3 px-4 text-sm",
											row.center && "text-center",
											colIndex % 2 === 0 ? "bg-background" : "bg-text/[0.02]"
										)}
									>
										{row.getValue(item)}
									</td>
								))}
								{/* Empty cells to maintain layout */}
								{Array.from({ length: Math.max(0, 4 - items.length) }).map(
									(_, index) => (
										<td
											key={`empty-cell-${index}`}
											className={cn(
												"py-3 px-4 text-sm text-text/20",
												(4 - items.length) % 2 === index % 2
													? "bg-background"
													: "bg-text/[0.02]"
											)}
										>
											—
										</td>
									)
								)}
							</tr>
						))}
					</tbody>
				</table>
			</motion.div>
		</div>
	)
}
