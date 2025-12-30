"use client"

import { useAuth } from "@/components/AuthProvider"
import { routes } from "@/utils/routes"
import {
    ChevronRightIcon,
    LogOutIcon,
    MenuIcon,
    UserRoundIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Navbar() {
    // Context
    const { user, isWriter, isAdmin } = useAuth()

    // Constants
    const curPath = usePathname()
    return (
        <nav className='w-full bg-background text-text px-4 py-2 flex items-center justify-between z-50 relative overflow-x-clip'>
            <Link
                href='/'
                className={`font-semibold font-serif text-2xl select-none`}
                draggable={false}
                title='Go to Home'
            >
                Grounds
            </Link>
            {/* Pages */}
            <ul className='gap-4 hidden md:flex'>
                {routes.map((route) => (
                    <li key={route.title}>
                        <Link
                            href={route.href}
                            className={`${
                                curPath === route.href
                                    ? "text-text/80"
                                    : "hover:text-text/60"
                            } font-semibold transition-colors relative group`}
                        >
                            {route.title}
                            <div className='absolute bottom-0 left-0 w-full h-0.5 bg-transparent group-hover:bg-text/60 transition-colors' />
                        </Link>
                    </li>
                ))}
                {user && (
                    <li>
                        <Link
                            href='/profile'
                            className={`${
                                curPath === "/profile"
                                    ? "text-text/80"
                                    : "hover:text-text/60"
                            } font-semibold transition-colors relative group`}
                        >
                            profile
                            <div className='absolute bottom-0 left-0 w-full h-0.5 bg-transparent group-hover:bg-text/60 transition-colors' />
                        </Link>
                    </li>
                )}
                {isAdmin && (
                    <li>
                        <Link
                            href='/manage'
                            className={`${
                                curPath === "/manage"
                                    ? "text-text/80"
                                    : "hover:text-text/60"
                            } font-semibold transition-colors relative group`}
                        >
                            dashboard
                            <div className='absolute bottom-0 left-0 w-full h-0.5 bg-transparent group-hover:bg-text/60 transition-colors' />
                        </Link>
                    </li>
                )}
                {isWriter && (
                    <li>
                        <Link
                            href='/writer'
                            className={`${
                                curPath === "/writer"
                                    ? "text-text/80"
                                    : "hover:text-text/60"
                            } font-semibold transition-colors relative group`}
                        >
                            write
                            <div className='absolute bottom-0 left-0 w-full h-0.5 bg-transparent group-hover:bg-text/60 transition-colors' />
                        </Link>
                    </li>
                )}
            </ul>
            {/* Accounts */}
            <ul className='gap-4 hidden md:flex'>
                <li>
                    <Auth />
                </li>
            </ul>
            {/* Mobile */}
            <div className='md:hidden'>
                <input
                    id='mobile-menu'
                    type='checkbox'
                    className='hidden peer'
                />
                <label
                    htmlFor='mobile-menu'
                    className='peer-checked:hidden'
                >
                    <MenuIcon
                        size={24}
                        className='text-text cursor-pointer'
                    />
                </label>
                <label
                    htmlFor='mobile-menu'
                    className='peer-not-checked:hidden'
                >
                    <ChevronRightIcon
                        size={24}
                        className='text-text cursor-pointer'
                    />
                </label>
                <ul className='absolute top-full translate-x-full left-0 w-full h-max px-4 bg-background text-text peer-checked:translate-x-0 border-b-4 border-text/20 transition-all'>
                    {routes.map((route) => (
                        <li
                            key={route.title}
                            className='my-4'
                        >
                            <Link
                                href={route.href}
                                className={`${
                                    curPath === route.href
                                        ? "text-text/80"
                                        : "hover:text-text/60"
                                } font-semibold transition-colors cursor-pointer text-2xl`}
                                onClick={() => {
                                    document
                                        .getElementById("mobile-menu")
                                        ?.click()
                                }}
                            >
                                {route.title}
                            </Link>
                        </li>
                    ))}
                    {user && (
                        <li>
                            <Link
                                href='/profile'
                                className={`${
                                    curPath === "/profile"
                                        ? "text-text/80"
                                        : "hover:text-text/60"
                                } font-semibold transition-colors cursor-pointer text-2xl`}
                                onClick={() => {
                                    document
                                        .getElementById("mobile-menu")
                                        ?.click()
                                }}
                            >
                                profile
                            </Link>
                        </li>
                    )}
                    <li className='my-4'>
                        <Auth />
                    </li>
                </ul>
            </div>
        </nav>
    )
}

function Auth() {
    const { user, profile, isLoading } = useAuth()

    const handleSignOut = async () => {
        const { signOut } = await import("@/lib/auth-client")
        await signOut()
        window.location.href = "/"
    }

    // Show nothing while loading to prevent flashing
    if (isLoading) {
        return <div className='w-16 h-6 bg-text/10 rounded-md animate-pulse' />
    }

    if (user && profile) {
        return (
            <button
                onClick={handleSignOut}
                className='hover:text-text/60 transition-colors font-serif flex flex-row gap-1 items-center cursor-pointer hover:bg-text/20 rounded-md p-1'
            >
                <LogOutIcon
                    size={16}
                    strokeWidth={3}
                    className='text-text hidden md:inline'
                />
                Sign out
            </button>
        )
    }

    return (
        <Link
            href='/auth'
            prefetch={true}
            className='hover:text-text/60 transition-colors font-serif flex flex-row gap-1 items-center cursor-pointer hover:bg-text/20 rounded-md p-1'
        >
            <UserRoundIcon
                size={16}
                strokeWidth={3}
                className='text-text hidden md:inline'
            />
            Login
        </Link>
    )
}
