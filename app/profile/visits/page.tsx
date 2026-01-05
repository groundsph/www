import { Metadata } from "next"
import { getUserVisitHistory } from "@/app/api/actions/profile"
import Link from "next/link"
import Image from "next/image"
import { Coffee, ArrowLeft, MapPin, Calendar } from "lucide-react"
import { getCafeThumbnailUrl } from "@/utils/extras"

export const metadata: Metadata = {
    title: "Visit History",
    description: "View your cafe check-in history and visit counts.",
}

export default async function VisitsPage() {
    const { visits } = await getUserVisitHistory()

    // Group visits by month-year for timeline display
    const groupedVisits = visits.reduce(
        (acc, visit) => {
            const date = new Date(visit.lastVisit)
            const key = date.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
            })
            if (!acc[key]) acc[key] = []
            acc[key].push(visit)
            return acc
        },
        {} as Record<string, typeof visits>
    )

    return (
        <main className='w-full max-w-4xl mx-auto px-4 py-8'>
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
                        Visit History
                    </h1>
                    <p className='text-text/60 text-sm'>
                        {visits.length} {visits.length === 1 ? "cafe" : "cafes"}{" "}
                        visited
                    </p>
                </div>
            </div>

            {visits.length === 0 ? (
                <div className='bg-text/5 border border-text/10 rounded-xl p-12 flex flex-col items-center justify-center'>
                    <Coffee className='w-16 h-16 text-text/20 mb-4' />
                    <p className='text-text/60 font-medium text-lg'>
                        No visits yet
                    </p>
                    <p className='text-text/40 text-sm mt-1'>
                        Start checking in to cafes to build your history!
                    </p>
                    <Link
                        href='/cafes'
                        className='mt-6 px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                    >
                        Explore Cafes
                    </Link>
                </div>
            ) : (
                <div className='space-y-8'>
                    {Object.entries(groupedVisits).map(
                        ([monthYear, monthVisits]) => (
                            <section key={monthYear}>
                                <h2 className='text-lg font-semibold text-text/70 mb-4 flex items-center gap-2'>
                                    <Calendar className='w-4 h-4' />
                                    {monthYear}
                                </h2>
                                <div className='grid gap-3'>
                                    {monthVisits.map((visit) => (
                                        <Link
                                            key={visit.cafeId}
                                            href={`/cafes/${visit.cafeSlug}`}
                                            className='flex items-center gap-4 p-4 bg-text/5 hover:bg-text/10 border border-text/10 rounded-xl transition-colors group'
                                        >
                                            {/* Thumbnail */}
                                            <div className='w-16 h-16 rounded-lg overflow-hidden bg-text/5 shrink-0'>
                                                {visit.cafeThumbnail ? (
                                                    <Image
                                                        src={getCafeThumbnailUrl(
                                                            visit.cafeThumbnail
                                                        )}
                                                        alt={visit.cafeName}
                                                        width={64}
                                                        height={64}
                                                        className='w-full h-full object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full flex items-center justify-center'>
                                                        <Coffee className='w-6 h-6 text-text opacity-30' />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className='flex-1 min-w-0'>
                                                <h3 className='font-semibold text-text group-hover:text-primary transition-colors truncate'>
                                                    {visit.cafeName}
                                                </h3>
                                                <p className='text-text/50 text-sm flex items-center gap-1 mt-1'>
                                                    <MapPin className='w-3.5 h-3.5' />
                                                    Last visit:{" "}
                                                    {new Date(
                                                        visit.lastVisit
                                                    ).toLocaleDateString(
                                                        "en-US",
                                                        {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        }
                                                    )}
                                                </p>
                                            </div>

                                            {/* Visit count badge */}
                                            <div className='shrink-0 flex flex-col items-center'>
                                                <span className='text-2xl font-bold text-primary'>
                                                    {visit.visitCount}
                                                </span>
                                                <span className='text-xs text-text/50'>
                                                    {visit.visitCount === 1
                                                        ? "visit"
                                                        : "visits"}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )
                    )}
                </div>
            )}
        </main>
    )
}
