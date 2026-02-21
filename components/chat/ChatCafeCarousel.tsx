"use client"

import { Coffee, MapPin, Star } from "lucide-react"
import { getCafeThumbnailUrl } from "@/utils/extras"
import type { ChatCafeCard, ChatCardContext } from "@/utils/types/chat"

interface ChatCafeCarouselProps {
    cafes: ChatCafeCard[]
    cardContext?: ChatCardContext
}

export default function ChatCafeCarousel({ cafes, cardContext }: ChatCafeCarouselProps) {
    if (!cafes.length) return null
    return (
        <div className="mt-3">
            {cardContext?.title && (
                <p className="text-xs text-text/60 mb-2">{cardContext.title}</p>
            )}
            <div className="flex flex-row gap-4 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-2 pb-4 snap-x snap-mandatory scroll-px-4">
                {cafes.map((cafe) => (
                    <a
                        key={cafe.id}
                        href={`/cafes/${cafe.slug}`}
                        className="group shrink-0 w-[320px] max-w-[85svw] bg-text/5 rounded-xl p-4 hover:bg-text/10 transition-colors border border-text/5 hover:border-text/10 snap-start flex flex-col gap-3"
                    >
                        <div className="flex items-center gap-3 bg-background rounded-lg p-2">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-text/5 shrink-0">
                                {cafe.coverImageUrl ? (
                                    <img
                                        src={getCafeThumbnailUrl(cafe.coverImageUrl)}
                                        alt={cafe.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Coffee className="w-6 h-6 text-text opacity-30" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-text group-hover:text-primary transition-colors truncate">
                                    {cafe.title}
                                </h3>
                                {(cafe.city || cafe.province) && (
                                    <p className="flex items-center gap-1 text-xs text-text/60 truncate">
                                        <MapPin className="w-3 h-3" />
                                        {cafe.city ?? cafe.province}
                                    </p>
                                )}
                                {cafe.rating != null && (
                                    <div className="flex items-center gap-1 text-xs text-text/60 mt-1">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        <span>{cafe.rating.toFixed(1)}</span>
                                        {cafe.reviewCount != null && (
                                            <span className="text-text/40">({cafe.reviewCount})</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {(cafe.filters?.length || cafe.flags?.length) && (
                            <div className="flex flex-wrap gap-2">
                                {cafe.flags?.map((flag) => (
                                    <span key={flag} className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
                                        {flag}
                                    </span>
                                ))}
                                {cafe.filters?.slice(0, 3).map((filter) => (
                                    <span key={filter} className="text-xs px-2 py-1 rounded-full bg-text/5 text-text/60">
                                        {filter}
                                    </span>
                                ))}
                            </div>
                        )}
                    </a>
                ))}
            </div>
        </div>
    )
}
