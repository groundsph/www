"use client"

import { routes } from "@/utils/routes"
import { MenuIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Navbar() {
    // Constants
    const curPath = usePathname()
    return (
        <nav className='w-full bg-background text-text px-4 py-2 flex items-center justify-between z-50 relative'>
            <Link
                href='/'
                className={`font-semibold font-serif text-2xl select-none ${
                    curPath === "/"
                        ? "text-transparent select-auto"
                        : "text-text"
                } transition-colors`}
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
            </ul>
            {/* Accounts */}
            <ul className='gap-4 hidden md:flex'>
                <li>
                    <Link
                        href='/auth'
                        className='hover:text-text/60 transition-colors font-serif'
                    >
                        login
                    </Link>
                </li>
            </ul>
            {/* Mobile */}
            <div className='md:hidden'>
                <label htmlFor='mobile-menu'>
                    <MenuIcon
                        size={24}
                        className='text-text cursor-pointer'
                    />
                </label>
                <input
                    id='mobile-menu'
                    type='checkbox'
                    className='hidden peer'
                />
                <ul className='absolute top-full left-0 w-full h-max px-4 bg-background text-text hidden peer-checked:block'>
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
                    <li className='my-4'>
                        <Link
                            href='/auth'
                            className='hover:text-text/60 transition-colors font-serif cursor-pointer text-2xl'
                            onClick={() => {
                                document.getElementById("mobile-menu")?.click()
                            }}
                        >
                            login
                        </Link>
                    </li>
                </ul>
            </div>
        </nav>
    )
}
