"use client"

import { motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { MapPin, Star } from "lucide-react"
import { CafeWithRatings } from "@/utils/types/extra"

interface ChatCafeCarouselProps {
	cafes: CafeWithRatings[]
}

export default function ChatCafeCarousel({ cafes }: ChatCafeCarouselProps) {
	if (!cafes || cafes.length === 0) return null

	return (
		<div className="mt-4 -mx-2">
			<div className="flex gap-3 overflow-x-auto pb-2 px-2 scrollbar-hide">
				{cafes.map((cafe) => (
					<motion.div
						key={cafe.id}
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						className="flex-shrink-0 w-64"
					>
						<Link
							href={`/cafes/${cafe.slug}`}
							className="block bg-text/5 rounded-lg overflow-hidden border border-text/10 hover:border-primary/30 transition-colors"
						>
							<div className="relative aspect-[16/10]">
								<Image
									src={cafe.thumbnail || "/placeholder-cafe.jpg"}
									alt={cafe.name}
									fill
									className="object-cover"
								/>
								{cafe.is_halal_certified && (
									<div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
										Halal
									</div>
									)}
							</div>
							<div className="p-3">
								<h3 className="font-semibold text-sm truncate">
									{cafe.name}
								</h3>
								<div className="flex items-center gap-1 text-xs text-text/60 mt-1">
									<MapPin className="w-3 h-3" />
									<span className="truncate">
										{cafe.city_municipality}, {cafe.province}
									</span>
								</div>

								{cafe.average_rating && (
									<div className="flex items-center gap-1 mt-2">
										<Star className="w-3 h-3 fill-amber-400 text-amber-400" />
										<span className="text-xs font-medium">
											{cafe.average_rating.toFixed(1)}
										</span>
										<span className="text-xs text-text/40">
											({cafe.total_reviews} reviews)
										</span>
									</div>
								)}
							</div>
						</Link>
					</motion.div>
				))}
			</div>
		</div>
	)
}
