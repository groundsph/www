"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { BellIcon, CheckIcon, XIcon, Loader2 } from "lucide-react"
import Link from "next/link"
import { useHaptics } from "@/hooks/useHaptics"
import { UserAvatar } from "@/components/ui/UserAvatar"

interface FollowRequest {
    id: string
    requester: {
        id: string
        username: string
        displayName: string
        avatarUrl: string | null
    }
    createdAt: string
}

interface FollowRequestsDropdownProps {
    className?: string
    isMobile?: boolean
}

export default function FollowRequestsDropdown({
    className = "",
    isMobile = false,
}: FollowRequestsDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [requests, setRequests] = useState<FollowRequest[]>([])
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
    const dropdownRef = useRef<HTMLDivElement>(null)
    const { trigger: hapticTrigger } = useHaptics()

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    // Fetch pending requests
    const fetchRequests = useCallback(async () => {
        setIsRefreshing(true)
        try {
            const { getPendingFollowRequests } =
                await import("@/app/api/actions/social")
            const result = await getPendingFollowRequests()
            if (result.requests) {
                setRequests(result.requests)
            }
        } catch (error) {
            console.error("Error fetching follow requests:", error)
        } finally {
            setIsRefreshing(false)
        }
    }, [])

    // Load requests when dropdown opens
    useEffect(() => {
        if (isOpen) {
            fetchRequests()
        }
    }, [isOpen, fetchRequests])

    // Initial load to get badge count
    useEffect(() => {
        fetchRequests()
    }, [fetchRequests])

    const handleToggle = () => {
        hapticTrigger("light")
        setIsOpen(!isOpen)
    }

    const handleAccept = async (requestId: string) => {
        hapticTrigger("medium")
        setProcessingIds((prev) => new Set(prev).add(requestId))
        try {
            const { acceptFollowRequest } =
                await import("@/app/api/actions/social")
            const result = await acceptFollowRequest(requestId)
            if (result.success) {
                setRequests((prev) => prev.filter((r) => r.id !== requestId))
            }
        } catch (error) {
            console.error("Error accepting follow request:", error)
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev)
                next.delete(requestId)
                return next
            })
        }
    }

    const handleDecline = async (requestId: string) => {
        hapticTrigger("soft")
        setProcessingIds((prev) => new Set(prev).add(requestId))
        try {
            const { declineFollowRequest } =
                await import("@/app/api/actions/social")
            const result = await declineFollowRequest(requestId)
            if (result.success) {
                setRequests((prev) => prev.filter((r) => r.id !== requestId))
            }
        } catch (error) {
            console.error("Error declining follow request:", error)
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev)
                next.delete(requestId)
                return next
            })
        }
    }

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffInMs = now.getTime() - date.getTime()
        const diffInSecs = Math.floor(diffInMs / 1000)
        const diffInMins = Math.floor(diffInSecs / 60)
        const diffInHours = Math.floor(diffInMins / 60)
        const diffInDays = Math.floor(diffInHours / 24)

        if (diffInSecs < 60) return "just now"
        if (diffInMins < 60) return `${diffInMins}m ago`
        if (diffInHours < 24) return `${diffInHours}h ago`
        if (diffInDays < 7) return `${diffInDays}d ago`
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        })
    }

    const pendingCount = requests.length
    const hasPendingRequests = pendingCount > 0

    return (
        <div
            ref={dropdownRef}
            className={`relative ${className}`}
        >
            {/* Bell Button */}
            <button
                onClick={handleToggle}
                className={`${
                    isMobile
                        ? `relative flex items-center justify-center w-full py-3 text-lg font-medium transition-colors ${
                              isOpen
                                  ? "text-text bg-text/10"
                                  : "text-text/80 hover:text-text hover:bg-text/5"
                          }`
                        : `relative p-2 rounded-md transition-colors ${
                              isOpen
                                  ? "bg-text/10 text-text"
                                  : "text-text/60 hover:text-text hover:bg-text/5"
                          }`
                }`}
                aria-label='Follow requests'
                aria-expanded={isOpen}
                aria-haspopup='true'
            >
                <BellIcon size={isMobile ? 24 : 20} />
                {hasPendingRequests && (
                    <span className={`absolute min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full ${isMobile ? 'top-2 right-auto ml-6' : '-top-0.5 -right-0.5'}`}>
                        {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: isMobile ? 0 : -10, scale: isMobile ? 1 : 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: isMobile ? 0 : -10, scale: isMobile ? 1 : 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={`${isMobile 
                            ? 'fixed inset-x-0 top-16 mx-4 mt-2 bg-background border border-text/10 rounded-lg shadow-lg overflow-hidden z-50 max-h-[calc(100vh-6rem)]' 
                            : 'absolute top-full right-0 mt-2 w-80 bg-background border border-text/10 rounded-lg shadow-lg overflow-hidden z-50'}`}
                    >
                        {/* Header */}
                        <div className='px-4 py-3 border-b border-text/10 flex items-center justify-between'>
                            <h3 className='font-semibold text-sm'>
                                Follow Requests
                            </h3>
                            {isRefreshing && (
                                <Loader2
                                    size={14}
                                    className='animate-spin text-text/40'
                                />
                            )}
                        </div>

                        {/* Content */}
                        <div className='max-h-96 overflow-y-auto'>
                            {requests.length === 0 ? (
                                <div className='px-4 py-8 text-center'>
                                    <BellIcon
                                        size={32}
                                        className='mx-auto text-text/20 mb-2'
                                    />
                                    <p className='text-sm text-text/60'>
                                        No pending requests
                                    </p>
                                </div>
                            ) : (
                                <ul className='divide-y divide-text/5'>
                                    {requests.map((request) => (
                                        <li
                                            key={request.id}
                                            className='px-4 py-3 hover:bg-text/[0.02] transition-colors'
                                        >
                                            <div className='flex items-start gap-3'>
                                                {/* Avatar */}
                                                <Link
                                                    href={`/u/${request.requester.username}`}
                                                    className='flex-shrink-0'
                                                    onClick={() =>
                                                        setIsOpen(false)
                                                    }
                                                >
                                                    <UserAvatar
                                                        src={
                                                            request.requester
                                                                .avatarUrl
                                                        }
                                                        alt={
                                                            request.requester
                                                                .displayName
                                                        }
                                                        size={40}
                                                        className='border border-text/10'
                                                    />
                                                </Link>

                                                {/* Request Info */}
                                                <div className='flex-1 min-w-0'>
                                                    <Link
                                                        href={`/u/${request.requester.username}`}
                                                        className='block hover:underline'
                                                        onClick={() =>
                                                            setIsOpen(false)
                                                        }
                                                    >
                                                        <p className='font-medium text-sm truncate'>
                                                            {
                                                                request
                                                                    .requester
                                                                    .displayName
                                                            }
                                                        </p>
                                                        <p className='text-xs text-text/50 truncate'>
                                                            @
                                                            {
                                                                request
                                                                    .requester
                                                                    .username
                                                            }
                                                        </p>
                                                    </Link>
                                                    <p className='text-[10px] text-text/40 mt-0.5'>
                                                        {formatTimeAgo(
                                                            request.createdAt,
                                                        )}
                                                    </p>
                                                </div>

                                                {/* Actions */}
                                                <div className='flex items-center gap-1.5'>
                                                    <button
                                                        onClick={() =>
                                                            handleAccept(
                                                                request.id,
                                                            )
                                                        }
                                                        disabled={processingIds.has(
                                                            request.id,
                                                        )}
                                                        className='p-1.5 rounded-full bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                                                        aria-label='Accept follow request'
                                                    >
                                                        {processingIds.has(
                                                            request.id,
                                                        ) ? (
                                                            <Loader2
                                                                size={14}
                                                                className='animate-spin'
                                                            />
                                                        ) : (
                                                            <CheckIcon
                                                                size={14}
                                                                strokeWidth={3}
                                                            />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleDecline(
                                                                request.id,
                                                            )
                                                        }
                                                        disabled={processingIds.has(
                                                            request.id,
                                                        )}
                                                        className='p-1.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                                                        aria-label='Decline follow request'
                                                    >
                                                        {processingIds.has(
                                                            request.id,
                                                        ) ? (
                                                            <Loader2
                                                                size={14}
                                                                className='animate-spin'
                                                            />
                                                        ) : (
                                                            <XIcon
                                                                size={14}
                                                                strokeWidth={3}
                                                            />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Footer */}
                        {requests.length > 0 && (
                            <div className='px-4 py-2 border-t border-text/10 bg-text/[0.02]'>
                                <p className='text-[10px] text-text/40 text-center'>
                                    {requests.length} pending request
                                    {requests.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
