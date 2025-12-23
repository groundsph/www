import { Construction } from "lucide-react"
import Link from "next/link"

export const metadata = {
    title: "Events | Grounds",
    description: "Coffee events and meetups in the Philippines - Coming Soon",
}

export default function EventsPage() {
    return (
        <main className='w-full min-h-screen flex items-center justify-center px-4 py-12'>
            <div className='text-center max-w-md'>
                <Construction className='w-16 h-16 text-primary mx-auto mb-6' />
                <h1 className='text-3xl md:text-4xl font-bold font-serif text-text mb-4'>
                    Under Construction
                </h1>
                <p className='text-text/70 mb-8'>
                    We&apos;re brewing something special! Our events page is
                    coming soon. Check back later for coffee meetups, workshops,
                    and community gatherings.
                </p>
                <Link
                    href='/'
                    className='inline-block px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors'
                >
                    Back to Home
                </Link>
            </div>
        </main>
    )
}
