import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
    title: "Account Terms and Conditions",
    description:
        "Terms and Conditions for creating and using a GroundsPH account",
}

export default function AccountTermsPage() {
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
                Account Terms and Conditions
            </h1>
            <p className='text-text/50 text-sm mb-8'>
                Last updated: December 29, 2024
            </p>

            <div className='prose prose-neutral max-w-none space-y-8'>
                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        1. Account Eligibility
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        By creating an account on GroundsPH, you confirm that:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>
                            You are at least 13 years of age, or the minimum age
                            required in your jurisdiction
                        </li>
                        <li>
                            You will provide accurate, current, and complete
                            information during registration
                        </li>
                        <li>
                            You will maintain and promptly update your account
                            information as needed
                        </li>
                        <li>
                            You have not been previously suspended or removed
                            from the Service
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        2. Account Security
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        You are responsible for maintaining the security of your
                        account. This includes:
                    </p>
                    <ul className='list-disc list-inside text-text/80 space-y-2'>
                        <li>
                            <strong>Password protection:</strong> Keep your
                            password confidential and do not share it with
                            others. Use a strong, unique password that meets our
                            requirements.
                        </li>
                        <li>
                            <strong>Unauthorized access:</strong> Notify us
                            immediately if you suspect any unauthorized use of
                            your account or any other security breach.
                        </li>
                        <li>
                            <strong>Account responsibility:</strong> You are
                            responsible for all activities that occur under your
                            account, whether or not you authorized such
                            activities.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        3. User Conduct
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        As a registered user, you agree to:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>
                            Use your account only for lawful purposes and in
                            accordance with these terms
                        </li>
                        <li>
                            Not impersonate any person or entity, or falsely
                            state or misrepresent your affiliation
                        </li>
                        <li>
                            Not use your account to spam, harass, or abuse other
                            users
                        </li>
                        <li>
                            Not attempt to gain unauthorized access to other
                            accounts or systems
                        </li>
                        <li>
                            Not use automated scripts or bots to access or
                            interact with the Service
                        </li>
                        <li>
                            Respect the intellectual property rights of others
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        4. Content Submission
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        When you submit content through your account (including
                        reviews, photos, cafe submissions, and comments), you:
                    </p>
                    <ul className='list-disc list-inside text-text/80 space-y-2'>
                        <li>
                            <strong>Grant us a license:</strong> You grant
                            GroundsPH a non-exclusive, worldwide, royalty-free
                            license to use, display, reproduce, and distribute
                            your content in connection with the Service.
                        </li>
                        <li>
                            <strong>Retain ownership:</strong> You retain
                            ownership of your content, but acknowledge our right
                            to use it as described above.
                        </li>
                        <li>
                            <strong>Warrant authenticity:</strong> You represent
                            that all content you submit is original, accurate,
                            and does not infringe on any third party&apos;s
                            rights.
                        </li>
                        <li>
                            <strong>Accept moderation:</strong> You acknowledge
                            that we may review, edit, or remove content that
                            violates our policies.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        5. Privacy and Data
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        Your privacy is important to us. By creating an account,
                        you acknowledge that:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>
                            We collect and process your personal data as
                            described in our{" "}
                            <Link
                                href='/legal/privacy'
                                className='text-primary hover:underline'
                            >
                                Privacy Policy
                            </Link>
                        </li>
                        <li>
                            Your profile information (username, display name,
                            avatar) may be visible to other users
                        </li>
                        <li>
                            Your reviews and contributions are publicly
                            attributed to your account
                        </li>
                        <li>
                            We may use your email address to send important
                            account notifications
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        6. Account Suspension and Termination
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        We reserve the right to suspend or terminate your
                        account at any time if:
                    </p>
                    <ul className='list-disc list-inside text-text/80 space-y-1'>
                        <li>You violate these terms or our policies</li>
                        <li>
                            Your account is used for fraudulent or illegal
                            activities
                        </li>
                        <li>
                            You engage in behavior that harms the community or
                            the Service
                        </li>
                        <li>We are required to do so by law</li>
                    </ul>
                    <p className='text-text/80 leading-relaxed mt-4'>
                        You may delete your account at any time through your
                        profile settings. Upon deletion, your personal data will
                        be removed, but some content you&apos;ve contributed may
                        remain on the platform in an anonymized form.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        7. Limitation of Liability
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        GroundsPH shall not be liable for any loss or damage
                        arising from:
                    </p>
                    <ul className='list-disc list-inside text-text/80 mt-3 space-y-1'>
                        <li>Unauthorized access to your account</li>
                        <li>Loss of your account data or content</li>
                        <li>Actions taken by other users on the platform</li>
                        <li>Service interruptions or technical issues</li>
                    </ul>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        8. Changes to These Terms
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        We may update these Account Terms and Conditions from
                        time to time. We will notify you of significant changes
                        via email or through the Service. Your continued use of
                        your account after such changes constitutes acceptance
                        of the updated terms.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        9. Agreement
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        By creating an account on GroundsPH, you acknowledge
                        that you have read, understood, and agree to be bound by
                        these Account Terms and Conditions, as well as our
                        general{" "}
                        <Link
                            href='/legal/terms'
                            className='text-primary hover:underline'
                        >
                            Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                            href='/legal/privacy'
                            className='text-primary hover:underline'
                        >
                            Privacy Policy
                        </Link>
                        .
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        10. Contact
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        For questions about these Account Terms and Conditions,
                        please contact us at{" "}
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
