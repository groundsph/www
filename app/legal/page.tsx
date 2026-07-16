import { Metadata } from "next"
import Link from "next/link"
import { FileText, Shield, Scale } from "lucide-react"

export const metadata: Metadata = {
    title: "Legal",
    description:
        "Terms of Service, Privacy Policy, and Content Policy for GroundsPH",
}

const legalPages = [
    {
        title: "Terms of Service",
        description: "The rules and guidelines for using GroundsPH",
        href: "/legal/terms",
        icon: FileText,
    },
    {
        title: "Privacy Policy",
        description: "How we collect, use, and protect your data",
        href: "/legal/privacy",
        icon: Shield,
    },
    {
        title: "Content & Copyright Policy",
        description:
            "Guidelines for user-contributed content and takedown procedures",
        href: "/legal/content-policy",
        icon: Scale,
    },
]

export default function LegalPage() {
    return (
        <main className='min-h-screen px-6 py-12 max-w-4xl mx-auto'>
            <h1 className='text-4xl md:text-5xl font-bold font-serif mb-4'>
                Legal
            </h1>
            <p className='text-text/70 mb-10 max-w-2xl'>
                Welcome to the GroundsPH legal hub. Here you&apos;ll find our
                Terms of Service, Privacy Policy, and Content Policy. These
                documents outline how we operate and protect both our users and
                content creators.
            </p>

            <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
                {legalPages.map((page) => (
                    <Link
                        key={page.href}
                        href={page.href}
                        className='group p-6 rounded-xl border border-text/10 bg-background hover:border-primary/50 hover:shadow-lg transition-all'
                    >
                        <page.icon className='w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform' />
                        <h2 className='text-xl font-semibold font-serif mb-2'>
                            {page.title}
                        </h2>
                        <p className='text-text/60 text-sm'>
                            {page.description}
                        </p>
                    </Link>
                ))}
            </div>

            <div className='mt-12 p-6 rounded-xl bg-tertiary/20 border border-tertiary/30'>
                <h3 className='font-serif font-semibold mb-2'>Questions?</h3>
                <p className='text-text/70 text-sm'>
                    If you have any questions about our policies or need to
                    report a concern, please contact us at{" "}
                    <a
                        href='mailto:legal@grounds.ph'
                        className='text-primary hover:underline'
                    >
                        legal@grounds.ph
                    </a>
                </p>
            </div>

            <p className='text-text/40 text-xs mt-8'>
                Last updated: December 27, 2024
            </p>
        </main>
    )
}
