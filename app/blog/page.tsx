import { Construction } from "lucide-react"
import Link from "next/link"

export const metadata = {
    title: "Blog",
    description:
        "Coffee stories, guides, and news from the Philippines - Coming Soon",
}

export default function BlogPage() {
    return (
        <main className='w-full min-h-screen flex items-center justify-center px-4 py-12'>
            <div className='text-center max-w-md'>
                <Construction className='w-16 h-16 text-primary mx-auto mb-6' />
                <h1 className='text-3xl md:text-4xl font-bold font-serif text-text mb-4'>
                    Under Construction
                </h1>
                <p className='text-text/70 mb-8'>
                    We&apos;re brewing something special! Our blog is coming
                    soon with coffee stories, brewing guides, and news from the
                    Philippine coffee community.
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
