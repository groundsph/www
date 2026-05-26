import { Metadata } from "next"
import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getUserPendingSubmissions } from "@/app/api/actions/cafe"
import Link from "next/link"
import { Store, ArrowLeft, Coffee } from "lucide-react"
import Image from "next/image"
import { getCafeThumbnailUrl } from "@/utils/extras"

export const metadata: Metadata = {
    title: "Pending Submissions",
    description: "Track your cafe submissions awaiting review.",
}

export default async function PendingSubmissionsPage() {
    const user = await getCurrentUser()
    if (!user) redirect("/auth?redirect=/profile/pending-submissions")

    const submissions = await getUserPendingSubmissions()

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="mx-auto max-w-2xl px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/profile"
                        className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Profile
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Pending Submissions
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Cafes you&apos;ve submitted that are awaiting review
                    </p>
                </div>

                {/* Submissions list */}
                {submissions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-600">
                        <Store className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                        <h2 className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">
                            No pending submissions
                        </h2>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                            You haven&apos;t submitted any cafes yet. Start scouting!
                        </p>
                        <Link
                            href="/submit"
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                        >
                            <Coffee className="h-4 w-4" />
                            Submit a Cafe
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {submissions.map((submission) => (
                            <div
                                key={submission.id}
                                className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                            >
                                {/* Thumbnail */}
                                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                                    {submission.thumbnail ? (
                                        <Image
                                            src={getCafeThumbnailUrl(submission.thumbnail)}
                                            alt={submission.name}
                                            width={64}
                                            height={64}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <Store className="h-6 w-6 text-gray-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Details */}
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate font-medium text-gray-900 dark:text-gray-100">
                                        {submission.name}
                                    </h3>
                                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                                        {submission.city_municipality}, {submission.province}
                                    </p>
                                    {submission.created_at && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            Submitted {new Date(submission.created_at).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>

                                {/* Status pill */}
                                <span className="inline-flex flex-shrink-0 items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                    Pending Review
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
