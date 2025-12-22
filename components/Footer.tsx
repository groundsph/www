import { routes } from "@/utils/routes"
import { Coffee, Instagram, Facebook, Mail } from "lucide-react"
import Link from "next/link"

export default function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className='w-full bg-text text-background mt-auto'>
            <div className='px-6 py-12 md:py-16'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12'>
                    {/* Brand Section */}
                    <div className='flex flex-col gap-4'>
                        <Link
                            href='/'
                            className='font-serif text-3xl font-bold flex items-center gap-2 group w-max'
                        >
                            <Coffee className='w-8 h-8 group-hover:rotate-12 transition-transform' />
                            Grounds
                        </Link>
                        <p className='text-background/80 text-sm max-w-xs'>
                            Discover and explore the best cafes in the
                            Philippines. Community-driven cafe database
                            featuring daily highlights, reviews, and more.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div className='flex flex-col gap-4'>
                        <h3 className='font-serif text-lg font-semibold'>
                            Quick Links
                        </h3>
                        <ul className='flex flex-col gap-2'>
                            {routes.map((route) => (
                                <li key={route.title}>
                                    <Link
                                        href={route.href}
                                        className='text-background/80 hover:text-background transition-colors capitalize'
                                    >
                                        {route.title}
                                    </Link>
                                </li>
                            ))}
                            <li>
                                <Link
                                    href='/map'
                                    className='text-background/80 hover:text-background transition-colors'
                                >
                                    Nearby Me
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href='/business'
                                    className='text-background/80 hover:text-background transition-colors'
                                >
                                    For Business
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href='/support'
                                    className='text-background/80 hover:text-background transition-colors'
                                >
                                    Support Us
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href='/auth'
                                    className='text-background/80 hover:text-background transition-colors'
                                >
                                    Login
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Connect Section */}
                    <div className='flex flex-col gap-4'>
                        <h3 className='font-serif text-lg font-semibold'>
                            Connect With Us
                        </h3>
                        <p className='text-background/80 text-sm'>
                            Have a cafe suggestion? Want to get featured? Reach
                            out to us!
                        </p>
                        <div className='flex gap-4'>
                            <a
                                href='https://instagram.com/grounds.ph'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='p-2 rounded-full bg-background/10 hover:bg-background/20 transition-colors'
                                aria-label='Instagram'
                            >
                                <Instagram className='w-5 h-5' />
                            </a>
                            <a
                                href='https://facebook.com/grounds.ph'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='p-2 rounded-full bg-background/10 hover:bg-background/20 transition-colors'
                                aria-label='Facebook'
                            >
                                <Facebook className='w-5 h-5' />
                            </a>
                            <a
                                href='mailto:hello@grounds.ph'
                                className='p-2 rounded-full bg-background/10 hover:bg-background/20 transition-colors'
                                aria-label='Email'
                            >
                                <Mail className='w-5 h-5' />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className='mt-12 pt-8 border-t border-background/20'>
                    <div className='flex flex-col md:flex-row justify-between items-center gap-4'>
                        <p className='text-background/60 text-sm'>
                            © {currentYear} Grounds. All rights reserved.
                        </p>
                        <p className='text-background/60 text-sm'>
                            Made with ☕ in Cebu, Philippines
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    )
}
