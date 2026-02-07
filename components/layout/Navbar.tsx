"use client"

import { useAuth } from "@/components/AuthProvider"
import { routes } from "@/utils/routes"
import { AnimatePresence, motion } from "motion/react"
import {
    ChevronDownIcon,
    LogOutIcon,
    MenuIcon,
    UserRoundIcon,
    XIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { SearchModal, SearchTrigger } from "@/components/search"
import { useSearchKeyboard } from "@/utils/hooks/useSearchKeyboard"

export default function Navbar() {
    // Context
    const { user, isWriter, isAdmin, isLoading } = useAuth()

    // State
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    // Constants
    const curPath = usePathname()

    // Register keyboard shortcut globally
    useSearchKeyboard(() => setIsSearchOpen(true))

    // Close mobile menu on path change
    useEffect(() => {
        setTimeout(() => setIsMobileMenuOpen(false), 0)
    }, [curPath])

    // Prevent scrolling when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
        return () => {
            document.body.style.overflow = "unset"
        }
    }, [isMobileMenuOpen])

    const toggleDropdown = (e: React.MouseEvent, title: string) => {
        e.stopPropagation()
        setOpenDropdown(openDropdown === title ? null : title)
    }

    const isRouteActive = (route: {
        href: string
        children?: { href: string }[]
    }) => {
        if (curPath === route.href) return true
        if (route.children?.some((child) => curPath === child.href)) return true
        return false
    }

    return (
        <nav className='w-full bg-background text-text px-4 py-2 flex items-center justify-between z-50 relative'>
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className='z-50 relative flex flex-row gap-6 items-center'
                >
                    <Link
                        href='/'
                        className={`font-semibold font-serif text-2xl select-none`}
                        draggable={false}
                        title='Go to Home'
                    >
                        Grounds
                    </Link>

                    {/* Desktop Navigation */}
                    <ul className='gap-6 hidden md:flex items-center'>
                        {routes.map((route) => (
                            <li
                                key={route.title}
                                className='relative'
                                onMouseEnter={() =>
                                    setOpenDropdown(route.title)
                                }
                                onMouseLeave={() => setOpenDropdown(null)}
                            >
                                {route.children ? (
                                    <button
                                        onClick={(e) =>
                                            toggleDropdown(e, route.title)
                                        }
                                        className={`relative px-1 py-1 flex items-center gap-1 ${
                                            isRouteActive(route)
                                                ? "text-text"
                                                : "text-text/60 hover:text-text/80"
                                        } font-semibold transition-colors`}
                                        aria-expanded={
                                            openDropdown === route.title
                                        }
                                        aria-haspopup='true'
                                    >
                                        {route.title}
                                        <ChevronDownIcon
                                            size={14}
                                            className={`transition-transform ${
                                                openDropdown === route.title
                                                    ? "rotate-180"
                                                    : ""
                                            }`}
                                        />
                                        {isRouteActive(route) && !isLoading && (
                                            <motion.div
                                                layoutId='navbar-indicator'
                                                className='absolute top-[calc(100%-1px)] left-0 w-full h-0.5 bg-text/60'
                                                transition={{
                                                    type: "spring",
                                                    bounce: 0.2,
                                                    duration: 0.6,
                                                }}
                                            />
                                        )}
                                    </button>
                                ) : (
                                    <Link
                                        href={route.href}
                                        className={`relative px-1 py-1 ${
                                            curPath === route.href
                                                ? "text-text"
                                                : "text-text/60 hover:text-text/80"
                                        } font-semibold transition-colors`}
                                    >
                                        {route.title}
                                        {curPath === route.href &&
                                            !isLoading && (
                                                <motion.div
                                                    layoutId='navbar-indicator'
                                                    className='absolute top-[calc(100%-1px)] left-0 w-full h-0.5 bg-text/60'
                                                    transition={{
                                                        type: "spring",
                                                        bounce: 0.2,
                                                        duration: 0.6,
                                                    }}
                                                />
                                            )}
                                    </Link>
                                )}

                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {route.children &&
                                        openDropdown === route.title && (
                                            <div
                                                key='navbar-dropdown'
                                                className='absolute top-full left-0'
                                            >
                                                <motion.ul
                                                    initial={{
                                                        opacity: 0,
                                                        y: -10,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        y: 0,
                                                    }}
                                                    exit={{
                                                        opacity: 0,
                                                        y: -10,
                                                    }}
                                                    transition={{
                                                        duration: 0.2,
                                                    }}
                                                    className='mt-2 bg-background border border-text/10 rounded-lg shadow-lg overflow-hidden min-w-max'
                                                >
                                                    {route.children.map(
                                                        (child) => (
                                                            <li
                                                                key={child.href}
                                                            >
                                                                <Link
                                                                    href={
                                                                        child.href
                                                                    }
                                                                    className={`block px-4 py-2 text-sm font-medium transition-colors ${
                                                                        curPath ===
                                                                        child.href
                                                                            ? "text-text bg-text/5"
                                                                            : "text-text/60 hover:text-text hover:bg-text/5"
                                                                    }`}
                                                                >
                                                                    {
                                                                        child.title
                                                                    }
                                                                </Link>
                                                            </li>
                                                        ),
                                                    )}
                                                </motion.ul>
                                            </div>
                                        )}
                                </AnimatePresence>
                            </li>
                        ))}
                        {user && (
                            <li className='relative'>
                                <Link
                                    href='/profile'
                                    className={`relative px-1 py-1 ${
                                        curPath === "/profile"
                                            ? "text-text"
                                            : "text-text/60 hover:text-text/80"
                                    } font-semibold transition-colors`}
                                >
                                    profile
                                    {curPath === "/profile" && !isLoading && (
                                        <motion.div
                                            layoutId='navbar-indicator'
                                            className='absolute top-[calc(100%-1px)] left-0 w-full h-0.5 bg-text/60'
                                            transition={{
                                                type: "spring",
                                                bounce: 0.2,
                                                duration: 0.6,
                                            }}
                                        />
                                    )}
                                </Link>
                            </li>
                        )}
                        {isAdmin && (
                            <li>
                                <Link
                                    href='/manage'
                                    className={`relative px-1 py-1 ${
                                        curPath === "/manage"
                                            ? "text-text"
                                            : "text-text/60 hover:text-text/80"
                                    } font-semibold transition-colors`}
                                >
                                    dashboard
                                    {curPath === "/manage" && !isLoading && (
                                        <motion.div
                                            layoutId='navbar-indicator'
                                            className='absolute top-[calc(100%-1px)] left-0 w-full h-0.5 bg-text/60'
                                            transition={{
                                                type: "spring",
                                                bounce: 0.2,
                                                duration: 0.6,
                                            }}
                                        />
                                    )}
                                </Link>
                            </li>
                        )}
                        {isWriter && (
                            <li>
                                <Link
                                    href='/writer'
                                    className={`relative px-1 py-1 ${
                                        curPath === "/writer"
                                            ? "text-text"
                                            : "text-text/60 hover:text-text/80"
                                    } font-semibold transition-colors`}
                                >
                                    write
                                    {curPath === "/writer" && !isLoading && (
                                        <motion.div
                                            layoutId='navbar-indicator'
                                            className='absolute top-[calc(100%-1px)] left-0 w-full h-0.5 bg-text/60'
                                            transition={{
                                                type: "spring",
                                                bounce: 0.2,
                                                duration: 0.6,
                                            }}
                                        />
                                    )}
                                </Link>
                            </li>
                        )}

                        {/* Desktop Search */}
                        <li className='hidden lg:block'>
                            <SearchTrigger
                                onClick={() => setIsSearchOpen(true)}
                            />
                        </li>
                        <li className='hidden lg:hidden md:block'>
                            <SearchTrigger
                                variant='mobile'
                                onClick={() => setIsSearchOpen(true)}
                            />
                        </li>
                    </ul>
                </motion.div>
            </AnimatePresence>

            {/* Desktop Auth */}
            <div className='hidden md:flex flex-row items-center gap-4'>
                <Auth />
            </div>

            {/* Mobile Search + Toggle */}
            <div className='md:hidden z-50 flex items-center gap-2'>
                <SearchTrigger
                    variant='mobile'
                    onClick={() => setIsSearchOpen(true)}
                />
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className='p-1'
                >
                    <AnimatePresence mode='wait'>
                        {isMobileMenuOpen ? (
                            <motion.div
                                key='close'
                                initial={{ opacity: 0, rotate: -90 }}
                                animate={{ opacity: 1, rotate: 0 }}
                                exit={{ opacity: 0, rotate: 90 }}
                                transition={{ duration: 0.2 }}
                            >
                                <XIcon
                                    size={24}
                                    className='text-text'
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key='menu'
                                initial={{ opacity: 0, rotate: 90 }}
                                animate={{ opacity: 1, rotate: 0 }}
                                exit={{ opacity: 0, rotate: -90 }}
                                transition={{ duration: 0.2 }}
                            >
                                <MenuIcon
                                    size={24}
                                    className='text-text'
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className='md:hidden absolute inset-0 bg-background pt-4 pb-10 px-6 flex flex-col h-max top-full left-0 right-0'
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ul className='flex flex-col gap-4'>
                            {routes.map((route, i) => (
                                <motion.li
                                    key={route.title}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 + i * 0.1 }}
                                >
                                    {route.children ? (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setOpenDropdown(
                                                        openDropdown ===
                                                            route.title
                                                            ? null
                                                            : route.title,
                                                    )
                                                }}
                                                className={`w-full text-left flex items-center justify-between text-3xl font-semibold ${
                                                    isRouteActive(route)
                                                        ? "text-text"
                                                        : "text-text/60"
                                                }`}
                                            >
                                                {route.title}
                                                <ChevronDownIcon
                                                    size={20}
                                                    className={`transition-transform ${
                                                        openDropdown ===
                                                        route.title
                                                            ? "rotate-180"
                                                            : ""
                                                    }`}
                                                />
                                            </button>
                                            <AnimatePresence>
                                                {openDropdown ===
                                                    route.title && (
                                                    <motion.ul
                                                        initial={{
                                                            opacity: 0,
                                                            height: 0,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            height: "auto",
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            height: 0,
                                                        }}
                                                        transition={{
                                                            duration: 0.2,
                                                        }}
                                                        className='flex flex-col gap-2 mt-2 ml-4'
                                                    >
                                                        {route.children.map(
                                                            (child) => (
                                                                <li
                                                                    key={
                                                                        child.href
                                                                    }
                                                                >
                                                                    <Link
                                                                        href={
                                                                            child.href
                                                                        }
                                                                        className={`text-xl font-medium ${
                                                                            curPath ===
                                                                            child.href
                                                                                ? "text-text"
                                                                                : "text-text/60"
                                                                        }`}
                                                                    >
                                                                        {
                                                                            child.title
                                                                        }
                                                                    </Link>
                                                                </li>
                                                            ),
                                                        )}
                                                    </motion.ul>
                                                )}
                                            </AnimatePresence>
                                        </>
                                    ) : (
                                        <Link
                                            href={route.href}
                                            className={`text-3xl font-semibold ${
                                                curPath === route.href
                                                    ? "text-text"
                                                    : "text-text/60"
                                            }`}
                                        >
                                            {route.title}
                                        </Link>
                                    )}
                                </motion.li>
                            ))}
                            {user && (
                                <motion.li
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        delay: 0.1 + routes.length * 0.1,
                                    }}
                                >
                                    <Link
                                        href='/profile'
                                        className={`text-3xl font-semibold ${
                                            curPath === "/profile"
                                                ? "text-text"
                                                : "text-text/60"
                                        }`}
                                    >
                                        profile
                                    </Link>
                                </motion.li>
                            )}
                            {isAdmin && (
                                <motion.li
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        delay: 0.1 + routes.length * 0.1,
                                    }}
                                >
                                    <Link
                                        href='/manage'
                                        className={`text-3xl font-semibold ${
                                            curPath === "/manage"
                                                ? "text-text"
                                                : "text-text/60"
                                        }`}
                                    >
                                        manage
                                    </Link>
                                </motion.li>
                            )}
                            {isWriter && (
                                <motion.li
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        delay: 0.1 + routes.length * 0.1,
                                    }}
                                >
                                    <Link
                                        href='/writer'
                                        className={`text-3xl font-semibold ${
                                            curPath === "/writer"
                                                ? "text-text"
                                                : "text-text/60"
                                        }`}
                                    >
                                        write
                                    </Link>
                                </motion.li>
                            )}
                            <motion.li
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    delay: 0.1 + (routes.length + 1) * 0.1,
                                }}
                            >
                                <Auth isMobile />
                            </motion.li>
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search Modal */}
            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />
        </nav>
    )
}

function Auth({ isMobile = false }: { isMobile?: boolean }) {
    const { user, profile, isLoading } = useAuth()

    const handleSignOut = async () => {
        const { signOut } = await import("@/lib/auth-client")
        await signOut()
    }

    if (isLoading) {
        return <div className='w-16 h-6 bg-text/10 rounded-md animate-pulse' />
    }

    if (user && profile) {
        return (
            <button
                onClick={handleSignOut}
                className={`flex flex-row gap-2 transition-colors items-center cursor-pointer ${
                    isMobile
                        ? "text-3xl font-semibold lowercase"
                        : "hover:text-text/60 hover:bg-text/5 rounded-md p-2 font-serif"
                }`}
            >
                <LogOutIcon
                    size={isMobile ? 24 : 16}
                    strokeWidth={3}
                    className='text-text'
                />
                Sign out
            </button>
        )
    }

    return (
        <Link
            href='/auth'
            prefetch={true}
            className={`hover:text-text/60 transition-colors font-serif flex flex-row gap-2 items-center cursor-pointer hover:bg-text/5 rounded-md p-2 ${
                isMobile ? "text-xl" : ""
            }`}
        >
            <UserRoundIcon
                size={isMobile ? 24 : 16}
                strokeWidth={3}
                className='text-text'
            />
            Login
        </Link>
    )
}
