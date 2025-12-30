import { redirect } from "next/navigation"
import {
    isAdmin,
    getUserRole,
    getPaginatedCafes,
} from "@/app/api/actions/admin"
import StatsCards from "./StatsCards"
import Link from "next/link"
import {
    Store,
    Users,
    FileText,
    Settings,
    ArrowRight,
    BarChart3,
} from "lucide-react"

export default async function ManageOverviewPage() {
    // The layout already handles access control, but we need the role
    const hasAccess = await isAdmin()
    if (!hasAccess) {
        redirect("/")
    }

    const userRole = await getUserRole()
    const isFullAdmin = userRole === "admin"

    // Fetch pending cafes count
    const pendingResult = await getPaginatedCafes({
        isPublished: false,
        page: 1,
        pageSize: 1,
    })
    const pendingCount = pendingResult.total

    const categories = [
        {
            name: "Cafes",
            description:
                "Manage pending submissions, published cafes, suggestions, and ownership claims.",
            href: "/manage/cafes",
            icon: <Store className='w-6 h-6' />,
            color: "bg-amber-500/10 text-amber-700",
            badge: pendingCount > 0 ? pendingCount : undefined,
        },
        {
            name: "Community",
            description: "Review reported content and manage team members.",
            href: "/manage/community",
            icon: <Users className='w-6 h-6' />,
            color: "bg-blue-500/10 text-blue-700",
        },
        {
            name: "Content",
            description:
                "Create and manage blog posts, events, and featured schedules.",
            href: "/manage/content",
            icon: <FileText className='w-6 h-6' />,
            color: "bg-green-500/10 text-green-700",
            adminOnly: true,
        },
        {
            name: "Analytics",
            description:
                "View site-wide traffic insights and cafe performance metrics.",
            href: "/manage/analytics",
            icon: <BarChart3 className='w-6 h-6' />,
            color: "bg-indigo-500/10 text-indigo-700",
            adminOnly: true,
        },
        {
            name: "System",
            description:
                "Manage badges, platform settings, and maintenance tools.",
            href: "/manage/system",
            icon: <Settings className='w-6 h-6' />,
            color: "bg-purple-500/10 text-purple-700",
            adminOnly: true,
        },
    ]

    const visibleCategories = categories.filter(
        (cat) => !cat.adminOnly || isFullAdmin
    )

    return (
        <div className='space-y-8'>
            {/* Header */}
            <div>
                <h1 className='text-2xl md:text-3xl font-bold text-text'>
                    Manage Dashboard
                </h1>
                <p className='text-text/60 mt-1'>
                    Welcome back! Here&apos;s an overview of your platform.
                </p>
            </div>

            {/* Quick Access Cards */}
            <div>
                <h2 className='text-lg font-semibold text-text mb-4'>
                    Quick Access
                </h2>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    {visibleCategories.map((category) => (
                        <Link
                            key={category.href}
                            href={category.href}
                            className='group bg-background rounded-xl p-5 shadow-sm border border-tertiary/50 hover:shadow-md hover:border-primary/30 transition-all'
                        >
                            <div className='flex items-start justify-between'>
                                <div className='relative'>
                                    <div
                                        className={`p-3 rounded-lg ${category.color}`}
                                    >
                                        {category.icon}
                                    </div>
                                    {category.badge && (
                                        <span className='absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center'>
                                            {category.badge > 9
                                                ? "9+"
                                                : category.badge}
                                        </span>
                                    )}
                                </div>
                                <ArrowRight className='w-5 h-5 text-text opacity-30 group-hover:text-primary group-hover:translate-x-1 transition-all' />
                            </div>
                            <h3 className='font-semibold text-text mt-4'>
                                {category.name}
                                {category.badge && (
                                    <span className='ml-2 text-sm font-normal text-red-500'>
                                        {category.badge} pending
                                    </span>
                                )}
                            </h3>
                            <p className='text-sm text-text/60 mt-1'>
                                {category.description}
                            </p>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            {isFullAdmin && <StatsCards />}
        </div>
    )
}
