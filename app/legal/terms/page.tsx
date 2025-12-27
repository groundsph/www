import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "Terms of Service for using Grounds.ph",
}

export default function TermsPage() {
    return (
        <main className='min-h-screen px-6 py-12 max-w-3xl mx-auto'>
            <Link
                href='/legal'
                className='inline-flex items-center gap-2 text-text/60 hover:text-text mb-6 transition-colors'
            >
                <ArrowLeft className='w-4 h-4' />
                Back to Legal
            </Link>

            <h1 className='text-4xl md:text-5xl font-bold font-serif mb-2'>
                Terms of Service
            </h1>
            <p className='text-text/50 text-sm mb-8'>
                Last updated: December 27, 2024
            </p>

            <div className='prose prose-neutral max-w-none space-y-8'>
                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        1. Acceptance of Terms
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        By accessing or using Grounds.ph (&quot;the
                        Service&quot;), you agree to be bound by these Terms of
                        Service. If you do not agree to these terms, please do
                        not use the Service.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        2. Description of Service
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        Grounds.ph is a community-driven platform that allows
                        users to discover, share, and review cafes across the
                        Philippines. The Service includes but is not limited to:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>Browsing and searching cafe listings</li>
                        <li>Submitting new cafe information</li>
                        <li>Writing and reading reviews</li>
                        <li>Uploading photos of cafes</li>
                        <li>
                            Claiming and managing cafe listings (for verified
                            owners)
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        3. User-Generated Content
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        Grounds.ph relies on community contributions. When you
                        submit content to the Service (including but not limited
                        to cafe information, photos, reviews, and comments),
                        you:
                    </p>
                    <ul className='list-disc list-inside text-text/80 space-y-2'>
                        <li>
                            <strong>Grant us a license:</strong> You grant
                            Grounds.ph a non-exclusive, worldwide, royalty-free
                            license to use, display, reproduce, and distribute
                            your content in connection with the Service.
                        </li>
                        <li>
                            <strong>Represent ownership:</strong> You represent
                            that you own or have the necessary rights to the
                            content you submit, and that your content does not
                            infringe on any third party&apos;s intellectual
                            property or other rights.
                        </li>
                        <li>
                            <strong>Accept responsibility:</strong> You are
                            solely responsible for the content you submit and
                            any consequences arising from its submission.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        4. Prohibited Conduct
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        You agree not to:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>
                            Submit false, misleading, or fraudulent information
                        </li>
                        <li>Upload content you do not have rights to share</li>
                        <li>
                            Harass, abuse, or harm other users or cafe owners
                        </li>
                        <li>Use the Service for any illegal purposes</li>
                        <li>Attempt to manipulate ratings or reviews</li>
                        <li>
                            Interfere with the proper functioning of the Service
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        5. Disclaimer of Warranties
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        The Service is provided &quot;as is&quot; and &quot;as
                        available&quot; without warranties of any kind, either
                        express or implied. Grounds.ph does not guarantee the
                        accuracy, completeness, or reliability of any content on
                        the platform. Cafe information, including hours, prices,
                        and amenities, may be outdated or incorrect.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        6. Limitation of Liability
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        Grounds.ph shall not be liable for any indirect,
                        incidental, special, consequential, or punitive damages
                        arising from your use of the Service, including but not
                        limited to damages for loss of profits, goodwill, or
                        data.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        7. Modifications to Terms
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        We reserve the right to modify these Terms of Service at
                        any time. We will notify users of significant changes by
                        posting a notice on the Service. Your continued use of
                        the Service after such modifications constitutes
                        acceptance of the updated terms.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        8. Contact
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        For questions about these Terms of Service, please
                        contact us at{" "}
                        <a
                            href='mailto:legal@grounds.ph'
                            className='text-primary hover:underline'
                        >
                            legal@grounds.ph
                        </a>
                    </p>
                </section>
            </div>
        </main>
    )
}
