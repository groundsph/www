import { redirect } from "next/navigation"
import { isAdmin, getUserRole } from "@/app/api/actions/admin"
import SiteAnalyticsPanel from "@/components/analytics/SiteAnalyticsPanel"
import CafeAnalyticsPanel from "@/components/analytics/CafeAnalyticsPanel"
import { Suspense } from "react"
import { BarChart3 } from "lucide-react"

export default async function AnalyticsPage() {
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const userRole = await getUserRole()
    if (userRole !== "admin") {
        redirect("/manage")
    }

    return (
        <div className='space-y-8'>
            {/* Header */}
            <div>
                <div className='flex items-center gap-3'>
                    <div className='p-2 bg-indigo-100 text-indigo-700 rounded-lg'>
                        <BarChart3 className='w-6 h-6' />
                    </div>
                    <div>
                        <h1 className='text-2xl md:text-3xl font-bold text-text'>
                            Analytics
                        </h1>
                        <p className='text-text/60 mt-0.5'>
                            Site-wide traffic and cafe performance insights.
                        </p>
                    </div>
                </div>
            </div>

            {/* Site Analytics */}
            <Suspense
                fallback={
                    <div className='space-y-4 animate-pulse'>
                        <div className='h-8 bg-text/5 rounded w-48'></div>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className='h-24 bg-text/5 rounded-xl'
                                ></div>
                            ))}
                        </div>
                        <div className='h-64 bg-text/5 rounded-xl'></div>
                    </div>
                }
            >
                <SiteAnalyticsPanel />
            </Suspense>

            {/* Cafe Analytics */}
            <Suspense
                fallback={
                    <div className='space-y-4 animate-pulse'>
                        <div className='h-8 bg-text/5 rounded w-48'></div>
                        <div className='h-96 bg-text/5 rounded-xl'></div>
                    </div>
                }
            >
                <CafeAnalyticsPanel />
            </Suspense>
        </div>
    )
}
