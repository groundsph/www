import { Metadata } from "next"
import { getProfileByUsername } from "@/app/api/actions/profile"
import {
    getFollowers,
    isFollowing as checkIsFollowing,
} from "@/app/api/actions/social"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, User } from "lucide-react"
import { notFound } from "next/navigation"
import FollowButton from "@/components/social/FollowButton"
import { getCurrentUser } from "@/lib/auth"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ username: string }>
}): Promise<Metadata> {
    const { username } = await params
    return {
        title: `Followers of @${username}`,
        description: `See who follows @${username}`,
    }
}

export default async function FollowersPage({
    params,
}: {
    params: Promise<{ username: string }>
}) {
    const { username } = await params
    const profile = await getProfileByUsername(username)

    if (!profile) {
        notFound()
    }

    const currentUser = await getCurrentUser()
    const { users: followers } = await getFollowers(profile.id, 100)

    // Check which users the current user follows
    const followingStatus: Record<string, boolean> = {}
    if (currentUser) {
        for (const follower of followers) {
            if (follower.id !== currentUser.id) {
                followingStatus[follower.id] = await checkIsFollowing(
                    follower.id
                )
            }
        }
    }

    return (
        <main className='w-full max-w-7xl mx-auto px-4 py-8'>
            {/* Header */}
            <div className='flex items-center gap-4 mb-8'>
                <Link
                    href={`/profile/${username}`}
                    className='p-2 rounded-lg bg-text/5 hover:bg-text/10 transition-colors'
                >
                    <ArrowLeft className='w-5 h-5' />
                </Link>
                <div>
                    <h1 className='text-2xl font-bold font-serif'>Followers</h1>
                    <p className='text-text/60 text-sm'>
                        People following @{username}
                    </p>
                </div>
            </div>

            {followers.length === 0 ? (
                <div className='bg-text/5 border border-text/10 rounded-xl p-12 flex flex-col items-center justify-center'>
                    <User className='w-16 h-16 text-text/20 mb-4' />
                    <p className='text-text/60 font-medium text-lg'>
                        No followers yet
                    </p>
                </div>
            ) : (
                <div className='space-y-2'>
                    {followers.map((follower) => (
                        <div
                            key={follower.id}
                            className='flex items-center gap-3 p-3 bg-text/5 border border-text/10 rounded-xl hover:bg-text/[0.07] transition-colors'
                        >
                            <Link href={`/profile/${follower.username}`}>
                                {follower.avatarUrl ? (
                                    <Image
                                        src={follower.avatarUrl}
                                        alt={follower.displayName}
                                        width={48}
                                        height={48}
                                        className='w-12 h-12 rounded-full object-cover'
                                    />
                                ) : (
                                    <div className='w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center'>
                                        <span className='text-primary font-bold text-lg'>
                                            {follower.displayName.charAt(0)}
                                        </span>
                                    </div>
                                )}
                            </Link>
                            <div className='flex-1 min-w-0'>
                                <Link
                                    href={`/profile/${follower.username}`}
                                    className='font-semibold hover:text-primary transition-colors block truncate'
                                >
                                    {follower.displayName}
                                </Link>
                                <p className='text-sm text-text/50 truncate'>
                                    @{follower.username}
                                </p>
                            </div>
                            {currentUser && currentUser.id !== follower.id && (
                                <FollowButton
                                    targetUserId={follower.id}
                                    initialIsFollowing={
                                        followingStatus[follower.id] ?? false
                                    }
                                    size='sm'
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </main>
    )
}
