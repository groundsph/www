import { Metadata } from "next"
import { getFollowedUsersCheckIns } from "@/app/api/actions/social"
import Link from "next/link"
import Image from "next/image"
import { Coffee, ArrowLeft, Users, MapPin, Clock } from "lucide-react"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { formatDistanceToNow } from "date-fns"

export const metadata: Metadata = {
    title: "Activity Feed",
    description: "See check-ins from people you follow.",
}

export default async function ActivityPage() {
    const { checkIns } = await getFollowedUsersCheckIns(50)

    return (
        <main className='w-full max-w-7xl mx-auto px-4 py-8'>
            {/* Header */}
            <div className='flex items-center gap-4 mb-8'>
                <Link
                    href='/profile'
                    className='p-2 rounded-lg bg-text/5 hover:bg-text/10 transition-colors'
                >
                    <ArrowLeft className='w-5 h-5' />
                </Link>
                <div>
                    <h1 className='text-2xl font-bold font-serif'>
                        Activity Feed
                    </h1>
                    <p className='text-text/60 text-sm'>
                        Check-ins from people you follow
                    </p>
                </div>
            </div>

            {checkIns.length === 0 ? (
                <div className='bg-text/5 border border-text/10 rounded-xl p-12 flex flex-col items-center justify-center'>
                    <Users className='w-16 h-16 text-text/20 mb-4' />
                    <p className='text-text/60 font-medium text-lg'>
                        No activity yet
                    </p>
                    <p className='text-text/40 text-sm mt-1 text-center max-w-sm'>
                        Follow other coffee lovers to see their check-ins here!
                    </p>
                    <Link
                        href='/community'
                        className='mt-6 px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                    >
                        Discover People
                    </Link>
                </div>
            ) : (
                <div className='space-y-4'>
                    {checkIns.map((checkIn) => (
                        <article
                            key={checkIn.id}
                            className='bg-text/5 border border-text/10 rounded-xl p-4 hover:bg-text/[0.07] transition-colors'
                        >
                            {/* User info */}
                            <div className='flex items-start gap-3 mb-3'>
                                <Link href={`/profile/${checkIn.username}`}>
                                    <UserAvatar
                                        src={checkIn.avatarUrl}
                                        alt={checkIn.displayName}
                                        size={44}
                                    />
                                </Link>
                                <div className='flex-1 min-w-0'>
                                    <div className='flex items-center gap-2 flex-wrap'>
                                        <Link
                                            href={`/profile/${checkIn.username}`}
                                            className='font-semibold hover:text-primary transition-colors'
                                        >
                                            {checkIn.displayName}
                                        </Link>
                                        <span className='text-text/50 text-sm'>
                                            checked in at
                                        </span>
                                    </div>
                                    <div className='flex items-center gap-1.5 text-xs text-text/50 mt-0.5'>
                                        <Clock className='w-3 h-3' />
                                        {formatDistanceToNow(
                                            new Date(checkIn.visitedAt),
                                            {
                                                addSuffix: true,
                                            }
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Cafe info */}
                            <Link
                                href={`/cafes/${checkIn.cafeSlug}`}
                                className='flex items-center gap-3 p-3 bg-background rounded-lg border border-text/10 hover:border-primary/30 transition-colors group'
                            >
                                <div className='w-14 h-14 rounded-lg overflow-hidden bg-text/5 shrink-0'>
                                    {checkIn.cafeThumbnail ? (
                                        <Image
                                            src={getCafeThumbnailUrl(
                                                checkIn.cafeThumbnail
                                            )}
                                            alt={checkIn.cafeName}
                                            width={56}
                                            height={56}
                                            className='w-full h-full object-cover'
                                        />
                                    ) : (
                                        <div className='w-full h-full flex items-center justify-center'>
                                            <Coffee className='w-6 h-6 text-text opacity-30' />
                                        </div>
                                    )}
                                </div>
                                <div className='flex-1 min-w-0'>
                                    <h3 className='font-semibold text-text group-hover:text-primary transition-colors truncate'>
                                        {checkIn.cafeName}
                                    </h3>
                                    <p className='text-text/50 text-sm flex items-center gap-1'>
                                        <MapPin className='w-3.5 h-3.5' />
                                        View cafe →
                                    </p>
                                </div>
                            </Link>

                            {/* Companions */}
                            {checkIn.companions.length > 0 && (
                                <div className='mt-3 flex items-center gap-2'>
                                    <Users className='w-4 h-4 text-text/40' />
                                    <span className='text-sm text-text/50'>
                                        with
                                    </span>
                                    <div className='flex items-center gap-1'>
                                        {checkIn.companions
                                            .slice(0, 3)
                                            .map((companion) => (
                                                <Link
                                                    key={companion.id}
                                                    href={`/profile/${companion.username}`}
                                                    className='flex items-center gap-1 px-2 py-0.5 bg-text/5 rounded-full hover:bg-text/10 transition-colors'
                                                >
                                                    <UserAvatar
                                                        src={companion.avatarUrl}
                                                        alt={companion.displayName}
                                                        size={18}
                                                        className="shrink-0"
                                                    />
                                                    <span className='text-xs font-medium'>
                                                        {companion.displayName}
                                                    </span>
                                                </Link>
                                            ))}
                                        {checkIn.companions.length > 3 && (
                                            <span className='text-xs text-text/50'>
                                                +{checkIn.companions.length - 3}{" "}
                                                more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </main>
    )
}
