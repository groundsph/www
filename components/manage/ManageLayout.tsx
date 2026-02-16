"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Store,
    Users,
    FileText,
    Settings,
    LayoutDashboard,
    BarChart3,
} from "lucide-react"

interface NavItem {
    name: string
    href: string
    icon: React.ReactNode
    adminOnly?: boolean
}

const navItems: NavItem[] = [
    {
        name: "Overview",
        href: "/manage",
        icon: <LayoutDashboard className='w-5 h-5' />,
    },
    {
        name: "Cafes",
        href: "/manage/cafes",
        icon: <Store className='w-5 h-5' />,
    },
    {
        name: "Community",
        href: "/manage/community",
        icon: <Users className='w-5 h-5' />,
    },
    {
        name: "Content",
        href: "/manage/content",
        icon: <FileText className='w-5 h-5' />,
    },
    {
        name: "Analytics",
        href: "/manage/analytics",
        icon: <BarChart3 className='w-5 h-5' />,
        adminOnly: true,
    },
    {
        name: "Users",
        href: "/manage/users",
        icon: <Users className='w-5 h-5' />,
        adminOnly: true,
    },
    {
        name: "System",
        href: "/manage/system",
        icon: <Settings className='w-5 h-5' />,
        adminOnly: true,
    },
]

interface ManageLayoutProps {
    children: React.ReactNode
    userRole: "admin" | "moderator"
}

export default function ManageLayout({
    children,
    userRole,
}: ManageLayoutProps) {
    const pathname = usePathname()
    const isFullAdmin = userRole === "admin"

    const filteredNavItems = navItems.filter(
        (item) => !item.adminOnly || isFullAdmin
    )

    return (
        <div className='min-h-screen w-full bg-background [&_button]:cursor-pointer'>
            <div className='flex flex-col md:flex-row w-full mx-auto px-4 py-6 gap-6'>
                {/* Sidebar Navigation */}
                <aside className='w-full md:w-56 shrink-0'>
                    <nav className='bg-tertiary/30 rounded-xl p-3 md:sticky shadow-inner top-0'>
                        <ul className='flex md:flex-col gap-1 overflow-x-auto md:overflow-visible'>
                            {filteredNavItems.map((item) => {
                                const isActive =
                                    pathname === item.href ||
                                    (item.href !== "/manage" &&
                                        pathname.startsWith(item.href))

                                const isCafePreview =
                                    pathname.startsWith("/manage/preview") &&
                                    item.href === "/manage/cafes"
                                return (
                                    <li
                                        key={item.href}
                                        className='shrink-0'
                                    >
                                        <Link
                                            href={item.href}
                                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${
                                                isActive || isCafePreview
                                                    ? "bg-primary text-white shadow-md"
                                                    : "text-text/70 hover:bg-tertiary hover:text-text"
                                            }`}
                                        >
                                            {item.icon}
                                            {item.name}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className='flex-1 min-w-0'>{children}</main>
            </div>
        </div>
    )
}
