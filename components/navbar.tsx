"use client"

import { routes } from "@/utils/routes"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Navbar() {
    // Constants
    const curPath = usePathname()
    return (
        <nav className='w-full bg-background text-text px-4 py-2 flex items-center justify-between'>
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
            <ul className='flex gap-4'>
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
            <ul className='flex gap-4'>
                <li>
                    <Link
                        href='/auth'
                        className='hover:text-text/60 transition-colors font-serif'
                    >
                        Login
                    </Link>
                </li>
            </ul>
        </nav>
    )
}
