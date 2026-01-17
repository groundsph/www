import { Coffee, Mail } from "lucide-react"
import Link from "next/link"

export default function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className='w-full bg-text text-background mt-auto'>
            <div className='px-6 py-12 md:py-16'>
                {/* Main Content - Two Columns */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 max-w-4xl mx-auto'>
                    {/* Brand */}
                    <div className='flex flex-col gap-4'>
                        <Link
                            href='/'
                            className='font-serif text-2xl md:text-3xl font-bold inline-flex items-center gap-2 group w-max'
                        >
                            <Coffee className='w-6 h-6 group-hover:rotate-12 transition-transform' />
                            Grounds<span className='text-secondary'>.</span>
                        </Link>
                        <p className='text-background/70 text-sm leading-relaxed'>
                            Discover and explore the best cafes across the
                            Philippines. A community-driven guide featuring
                            daily highlights, honest reviews, and hidden gems
                            waiting to be found.
                        </p>
                        <div className='flex items-center gap-4 mt-2'>
                            {/* <a
                                href='https://instagram.com/grounds.ph'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-background/50 hover:text-background transition-colors'
                                aria-label='Instagram'
                            >
                                <Instagram className='w-5 h-5' />
                            </a> */}
                            <a
                                href='https://www.tiktok.com/@grounds.ph'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-background/50 hover:text-background transition-colors font-semibold text-sm'
                                aria-label='TikTok'
                            >
                                TikTok
                            </a>
                            <Link
                                href='/contact'
                                className='text-background/50 hover:text-background transition-colors'
                                aria-label='Contact'
                            >
                                <Mail className='w-5 h-5' />
                            </Link>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className='grid grid-cols-2 md:grid-cols-3 gap-8'>
                        <div className='flex flex-col gap-3'>
                            <h4 className='font-serif font-semibold text-sm text-background/50 uppercase tracking-wider'>
                                Explore
                            </h4>
                            <Link
                                href='/cafes'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Cafes
                            </Link>
                            <Link
                                href='/map'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Near Me
                            </Link>
                            <Link
                                href='/events'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Events
                            </Link>
                            <Link
                                href='/blog'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Blog
                            </Link>
                        </div>
                        <div className='flex flex-col gap-3'>
                            <h4 className='font-serif font-semibold text-sm text-background/50 uppercase tracking-wider'>
                                Community
                            </h4>
                            <Link
                                href='/submit'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Submit a Cafe
                            </Link>
                            <Link
                                href='/auth'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Sign In
                            </Link>
                            <Link
                                href='/donate'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Support Us
                            </Link>
                            <Link
                                href='/contact'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Contact
                            </Link>
                            <Link
                                href='/roadmap'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Roadmap
                            </Link>
                        </div>
                        <div className='flex flex-col gap-3'>
                            <h4 className='font-serif font-semibold text-sm text-background/50 uppercase tracking-wider'>
                                Legal
                            </h4>
                            <Link
                                href='/legal/terms'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Terms of Service
                            </Link>
                            <Link
                                href='/legal/privacy'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Privacy Policy
                            </Link>
                            <Link
                                href='/legal/content-policy'
                                className='text-background/80 hover:text-background transition-colors text-sm'
                            >
                                Content Policy
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className='mt-12 pt-8 border-t border-background/20 max-w-4xl mx-auto'>
                    <div className='flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-background/50'>
                        <span suppressHydrationWarning>
                            © {currentYear} Grounds. All rights reserved.
                        </span>
                        <span>Made with ☕ in Cebu, Philippines</span>
                    </div>
                </div>
            </div>
        </footer>
    )
}
