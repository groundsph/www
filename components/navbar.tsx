"use client"

import { useAuth } from "@/components/AuthProvider"
import { routes } from "@/utils/routes"
import { AnimatePresence, motion } from "motion/react"
import { LogOutIcon, MenuIcon, UserRoundIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export default function Navbar() {
    // Context
    const { user, isWriter, isAdmin, isLoading } = useAuth()

    // State
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // Constants
    const curPath = usePathname()

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

    return (
        <nav className='w-full bg-background text-text px-4 py-2 flex items-center justify-between z-50 relative'>
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className='z-50 relative'
                >
                    <Link
                        href='/'
                        className={`font-semibold font-serif text-2xl select-none`}
                        draggable={false}
                        title='Go to Home'
                    >
                        Grounds
                    </Link>
                </motion.div>
            </AnimatePresence>

            {/* Desktop Navigation */}
            <ul className='gap-6 hidden md:flex items-center'>
                {routes.map((route) => (
                    <li
                        key={route.title}
                        className='relative'
                    >
                        <Link
                            href={route.href}
                            className={`relative px-1 py-1 ${
                                curPath === route.href
                                    ? "text-text"
                                    : "text-text/60 hover:text-text/80"
                            } font-semibold transition-colors`}
                        >
                            {route.title}
                            {curPath === route.href && !isLoading && (
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
            </ul>

            {/* Desktop Auth */}
            <div className='hidden md:block'>
                <Auth />
            </div>

            {/* Mobile Toggle */}
            <div className='md:hidden z-50'>
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
                        className='absolute inset-0 bg-background pt-4 pb-10 px-6 flex flex-col h-max top-full left-0 right-0'
                    >
                        <ul className='flex flex-col gap-6'>
                            {routes.map((route, i) => (
                                <motion.li
                                    key={route.title}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 + i * 0.1 }}
                                >
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
                            <motion.li
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    delay: 0.1 + (routes.length + 1) * 0.1,
                                }}
                                className='mt-4'
                            >
                                <Auth isMobile />
                            </motion.li>
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
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
                className={`hover:text-text/60 transition-colors font-serif flex flex-row gap-2 items-center cursor-pointer hover:bg-text/5 rounded-md p-2 ${
                    isMobile ? "text-xl" : ""
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
