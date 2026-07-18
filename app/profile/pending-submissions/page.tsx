import { Metadata } from "next"
import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getUserPendingSubmissions } from "@/app/api/actions/cafe"
import Link from "next/link"
import { Store, ArrowLeft, Coffee, MapPin, Clock } from "lucide-react"
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
        <main className="w-full max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/profile"
                    className="p-2 rounded-lg bg-text/5 hover:bg-text/10 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold font-serif">
                        Pending Submissions
                    </h1>
                    <p className="text-text/60 text-sm">
                        {submissions.length}{" "}
                        {submissions.length === 1
                            ? "cafe"
                            : "cafes"}{" "}
                        awaiting review
                    </p>
                </div>
            </div>

            {submissions.length === 0 ? (
                <div className="bg-text/5 border border-text/10 rounded-xl p-12 flex flex-col items-center justify-center">
                    <Store className="w-16 h-16 text-text opacity-20 mb-4" />
                    <p className="text-text/60 font-medium text-lg">
                        No pending submissions
                    </p>
                    <p className="text-text/40 text-sm mt-1">
                        You haven&apos;t submitted any cafes yet. Start
                        scouting!
                    </p>
                    <Link
                        href="/submit"
                        className="mt-6 px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        <Coffee className="w-4 h-4" />
                        Submit a Cafe
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {submissions.map((submission) => (
                        <div
                            key={submission.id}
                            className="flex items-center gap-4 p-2 bg-text/5 border border-text/10 rounded-xl transition-colors"
                        >
                            {/* Thumbnail */}
                            <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-text/5">
                                {submission.thumbnail ? (
                                    <Image
                                        src={getCafeThumbnailUrl(
                                            submission.thumbnail,
                                        )}
                                        alt={submission.name}
                                        width={64}
                                        height={64}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Store className="w-6 h-6 text-text opacity-40" />
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="min-w-0 flex-1">
                                <h3 className="font-semibold truncate">
                                    {submission.name}
                                </h3>
                                <p className="text-text/50 text-sm flex items-center gap-1 mt-1">
                                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">
                                        {submission.city_municipality},{" "}
                                        {submission.province}
                                    </span>
                                </p>
                                {submission.created_at && (
                                    <p className="text-text/50 text-xs flex items-center gap-1 mt-1">
                                        <Clock className="w-3 h-3 shrink-0" />
                                        Submitted{" "}
                                        {new Date(
                                            submission.created_at,
                                        ).toLocaleDateString()}
                                    </p>
                                )}
                            </div>

                            {/* Status pill */}
                            <span className="inline-flex flex-shrink-0 items-center rounded-full bg-amber-500/15 text-amber-600 px-2.5 py-0.5 text-xs font-medium">
                                Pending Review
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </main>
    )
}