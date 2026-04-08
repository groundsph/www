import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "Privacy Policy for Grounds.ph - How we collect, use, and protect your data",
}

export default function PrivacyPage() {
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
                Privacy Policy
            </h1>
            <p className='text-text/50 text-sm mb-8'>
                Last updated: April 9, 2026
            </p>

            <div className='prose prose-neutral max-w-none space-y-8'>
                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        1. Information We Collect
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        We collect information you provide directly to us, as
                        well as information collected automatically when you use
                        the Service.
                    </p>
                    <h3 className='text-lg font-semibold mb-2'>
                        Information You Provide
                    </h3>
                    <ul className='list-disc list-inside text-text/80 space-y-1 mb-4'>
                        <li>
                            Account information (email, username, display name)
                        </li>
                        <li>Profile information (avatar, bio)</li>
                        <li>Cafe submissions and reviews</li>
                        <li>Photos you upload</li>
                        <li>Communications with us</li>
                    </ul>
                    <h3 className='text-lg font-semibold mb-2'>
                        Information Collected Automatically
                    </h3>
                    <ul className='list-disc list-inside text-text/80 space-y-1'>
                        <li>Device information and browser type</li>
                        <li>IP address</li>
                        <li>Usage data and interactions with the Service</li>
                        <li>
                            Location data (only when you grant permission for
                            &quot;Near Me&quot; features)
                        </li>
                        <li>AI chat messages and conversation history</li>
                        <li>Chat session identifiers</li>
                        <li>AI response feedback ratings</li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        2. How We Use Your Information
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        We use the information we collect to:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>Provide, maintain, and improve the Service</li>
                        <li>
                            Display your contributions (reviews, photos,
                            submissions)
                        </li>
                        <li>
                            Show cafes near your location (with your permission)
                        </li>
                        <li>Send you service-related communications</li>
                        <li>Respond to your inquiries and support requests</li>
                        <li>Detect and prevent fraud or abuse</li>
                        <li>
                            Analyze usage patterns to improve user experience
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        3. Location Data
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        Grounds.ph may request access to your device&apos;s
                        location to provide features like &quot;Find Cafes Near
                        Me&quot; and location-based featured cafes. This is
                        entirely optional. If you grant permission:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>Your location is used only to show nearby cafes</li>
                        <li>
                            We do not store your precise location on our servers
                        </li>
                        <li>
                            You can revoke location access at any time through
                            your browser settings
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        4. Information Sharing
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        We do not sell your personal information. We may share
                        information in the following circumstances:
                    </p>
                    <ul className='list-disc list-inside text-text/80 space-y-2'>
                        <li>
                            <strong>Public content:</strong> Your reviews,
                            photos, and submissions are publicly visible to all
                            users.
                        </li>
                        <li>
                            <strong>Service providers:</strong> We use
                            third-party services (hosting, authentication,
                            storage) that may process your data.
                        </li>
                        <li>
                            <strong>Legal requirements:</strong> We may disclose
                            information if required by law or to protect our
                            rights.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        5. Third-Party Services
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        Grounds.ph uses the following third-party services:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>
                            <strong>Supabase:</strong> Database, authentication,
                            and file storage
                        </li>
                        <li>
                            <strong>OpenStreetMap/Nominatim:</strong> Mapping
                            and geocoding services
                        </li>
                        <li>
                            <strong>Vercel:</strong> Website hosting and
                            analytics
                        </li>
                    </ul>
                    <p className='text-text/80 leading-relaxed mt-3'>
                        Each service has its own privacy policy governing their
                        use of your data.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        6. AI Chat Feature
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        Our platform includes an AI-powered chat assistant to
                        help you discover cafes and menu items. When you use the
                        chat feature:
                    </p>
                    <ul className='list-disc list-inside text-text/80 space-y-2'>
                        <li>
                            Your messages and conversation history are stored to
                            improve our services and may be used for AI model
                            training and fine-tuning in the future.
                        </li>
                        <li>
                            We store chat sessions linked to your account (if
                            logged in) or anonymously via session identifiers.
                        </li>
                        <li>
                            Your feedback on AI responses (thumbs up/down) is
                            recorded to assess response quality.
                        </li>
                        <li>
                            Chat data is processed through third-party AI
                            providers (OpenAI-compatible APIs). Refer to their
                            privacy policies for data handling practices.
                        </li>
                        <li>
                            We do not sell or share your chat data with third
                            parties for marketing purposes.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        7. Data Security
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        We implement reasonable security measures to protect
                        your information. However, no method of transmission
                        over the Internet is 100% secure, and we cannot
                        guarantee absolute security.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        8. Your Rights
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        You have the right to:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>Access your personal information</li>
                        <li>Correct inaccurate information</li>
                        <li>Request deletion of your account and data</li>
                        <li>Opt out of promotional communications</li>
                    </ul>
                    <p className='text-text/80 leading-relaxed mt-3'>
                        To exercise these rights, contact us at{" "}
                        <a
                            href='mailto:legal@grounds.ph'
                            className='text-primary hover:underline'
                        >
                            legal@grounds.ph
                        </a>
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        9. Children&apos;s Privacy
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        The Service is not intended for users under 13 years of
                        age. We do not knowingly collect personal information
                        from children under 13.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        10. Changes to This Policy
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        We may update this Privacy Policy from time to time. We
                        will notify you of any changes by posting the new policy
                        on this page and updating the &quot;Last updated&quot;
                        date.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        11. Contact
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        For questions about this Privacy Policy, please contact
                        us at{" "}
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
