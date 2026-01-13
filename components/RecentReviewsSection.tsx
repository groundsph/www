import Link from "next/link"
import Image from "next/image"
import { CoffeeIcon, StarIcon, UserIcon } from "lucide-react"

interface RecentReview {
    id: string
    rating: number
    comment: string
    created_at: string | null
    author: {
        display_name: string
        username: string
        avatar_url: string | null
    }
    cafe: { name: string; slug: string; thumbnail: string | null }
}

export default function RecentReviewsSection({
    reviews,
}: {
    reviews: RecentReview[]
}) {
    if (reviews.length === 0) return null

    return (
        <section className='w-full min-h-max flex flex-col mt-4'>
            <div className='flex items-center justify-between px-6 mb-2'>
                <h2 className='font-semibold font-serif text-2xl'>
                    Recent Reviews
                </h2>
                <p className='text-sm text-text/60'>
                    What the community is saying
                </p>
            </div>

            {/* Horizontal scrollable container */}
            <div className='flex flex-row gap-4 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-4 pb-10 snap-x snap-mandatory scroll-px-4'>
                {reviews.map((review) => (
                    <Link
                        key={review.id}
                        href={`/cafes/${review.cafe.slug}`}
                        className='group shrink-0 w-[320px] bg-text/5 rounded-xl p-4 hover:bg-text/10 transition-colors border border-text/5 hover:border-text/10 snap-start'
                    >
                        {/* Cafe info */}
                        <div className='flex items-center gap-3 mb-3'>
                            {review.cafe.thumbnail !== "placeholder" ? (
                                <Image
                                    src={review.cafe.thumbnail || "placeholder"}
                                    alt={review.cafe.name}
                                    width={48}
                                    height={48}
                                    className='w-12 h-12 rounded-lg object-cover'
                                />
                            ) : (
                                <div className='w-12 h-12 rounded-lg bg-secondary/30 flex items-center justify-center'>
                                    <CoffeeIcon className='opacity-30' />
                                </div>
                            )}
                            <div className='flex-1 min-w-0'>
                                <p className='font-semibold text-sm group-hover:text-primary transition-colors truncate'>
                                    {review.cafe.name}
                                </p>
                                <div className='flex items-center gap-0.5'>
                                    {[...Array(5)].map((_, i) => (
                                        <StarIcon
                                            key={i}
                                            className={`w-3 h-3 ${
                                                i < review.rating
                                                    ? "fill-amber-400 text-amber-400"
                                                    : "text-text/20"
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Review comment */}
                        <p className='text-sm text-text/80 line-clamp-2 mb-3 min-h-10'>
                            &ldquo;{review.comment}&rdquo;
                        </p>

                        {/* Author */}
                        <div className='flex items-center gap-2 pt-2 border-t border-text/5'>
                            {review.author.avatar_url ? (
                                <Image
                                    src={review.author.avatar_url}
                                    alt={review.author.display_name}
                                    width={24}
                                    height={24}
                                    className='w-6 h-6 rounded-full object-cover'
                                />
                            ) : (
                                <div className='w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center'>
                                    <UserIcon className='w-3 h-3 text-primary' />
                                </div>
                            )}
                            <span className='text-xs text-text/60 truncate'>
                                {review.author.display_name}
                            </span>
                            {review.created_at && (
                                <span className='text-xs text-text/40 ml-auto'>
                                    {new Date(
                                        review.created_at
                                    ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
