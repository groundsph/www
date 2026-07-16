import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
    title: "Content & Copyright Policy",
    description:
        "Content guidelines, copyright policy, and takedown procedures for GroundsPH",
}

export default function ContentPolicyPage() {
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
                Content & Copyright Policy
            </h1>
            <p className='text-text/50 text-sm mb-8'>
                Last updated: December 27, 2024
            </p>

            <div className='prose prose-neutral max-w-none space-y-8'>
                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        1. Community-Contributed Content
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        GroundsPH is a community-driven platform. All cafe
                        information, photos, and reviews are contributed by our
                        users. We do not independently verify the accuracy of
                        user submissions, though we make reasonable efforts to
                        moderate content.
                    </p>
                    <div className='bg-tertiary/20 border border-tertiary/30 rounded-lg p-4 mt-4'>
                        <p className='text-text/80 text-sm'>
                            <strong>Note:</strong> If you are a cafe owner and
                            find inaccurate information about your
                            establishment, you can{" "}
                            <Link
                                href='/submit'
                                className='text-primary hover:underline'
                            >
                                claim your listing
                            </Link>{" "}
                            or contact us to request corrections.
                        </p>
                    </div>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        2. Photo and Image Policy
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        When users upload photos to GroundsPH, they represent
                        that:
                    </p>
                    <ul className='list-disc list-inside text-text/80 space-y-2'>
                        <li>
                            They are the original photographer or have
                            permission to share the image
                        </li>
                        <li>
                            The photo does not infringe on any third
                            party&apos;s copyright or intellectual property
                            rights
                        </li>
                        <li>
                            The photo does not contain any illegal, defamatory,
                            or harmful content
                        </li>
                    </ul>
                    <p className='text-text/80 leading-relaxed mt-4'>
                        By uploading photos, users grant GroundsPH a
                        non-exclusive, royalty-free license to display,
                        reproduce, and distribute the images in connection with
                        the Service.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        3. Public Business Information
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        Cafe details such as business name, address, operating
                        hours, and publicly available contact information are
                        generally considered public information. We collect and
                        display this information to help users discover cafes.
                        However, if you are a cafe owner and wish to have your
                        listing removed or modified, please contact us.
                    </p>
                </section>

                <section className='bg-secondary/10 border border-secondary/30 rounded-xl p-6'>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        4. Copyright Takedown Procedure
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        GroundsPH respects intellectual property rights. If you
                        believe that content on our platform infringes your
                        copyright, you may submit a takedown request.
                    </p>
                    <h3 className='text-lg font-semibold mb-2'>
                        How to Submit a Takedown Request
                    </h3>
                    <p className='text-text/80 leading-relaxed mb-3'>
                        Send an email to{" "}
                        <a
                            href='mailto:legal@grounds.ph'
                            className='text-primary hover:underline font-medium'
                        >
                            legal@grounds.ph
                        </a>{" "}
                        with the subject line &quot;Copyright Takedown
                        Request&quot; and include:
                    </p>
                    <ol className='list-decimal list-inside text-text/80 space-y-2'>
                        <li>Your full name and contact information</li>
                        <li>
                            A description of the copyrighted work you believe is
                            infringed
                        </li>
                        <li>
                            The specific URL(s) of the infringing content on
                            GroundsPH
                        </li>
                        <li>
                            A statement that you have a good faith belief the
                            use is not authorized
                        </li>
                        <li>
                            A statement, under penalty of perjury, that you are
                            the copyright owner or authorized to act on their
                            behalf
                        </li>
                        <li>Your physical or electronic signature</li>
                    </ol>
                    <p className='text-text/80 leading-relaxed mt-4 text-sm'>
                        We will review valid takedown requests and remove
                        infringing content within a reasonable timeframe,
                        typically 3-5 business days.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        5. Cafe Owner Content Removal
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        If you are a cafe owner and would like to:
                    </p>
                    <ul className='list-disc list-inside text-text/80 space-y-2'>
                        <li>
                            <strong>Update your listing:</strong> Claim your
                            cafe through our platform or contact us with
                            corrections
                        </li>
                        <li>
                            <strong>Remove specific photos:</strong> Contact us
                            with the URLs of the photos you want removed
                        </li>
                        <li>
                            <strong>Remove your entire listing:</strong> Contact
                            us at{" "}
                            <a
                                href='mailto:legal@grounds.ph'
                                className='text-primary hover:underline'
                            >
                                legal@grounds.ph
                            </a>{" "}
                            with proof of ownership (e.g., business
                            registration, official email from cafe domain)
                        </li>
                    </ul>
                    <p className='text-text/80 leading-relaxed mt-4'>
                        We will process legitimate removal requests within 5-7
                        business days after verifying ownership.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        6. Review Guidelines
                    </h2>
                    <p className='text-text/80 leading-relaxed mb-4'>
                        Reviews on GroundsPH should be:
                    </p>
                    <ul className='list-disc list-inside text-text/80 space-y-1'>
                        <li>Based on genuine personal experiences</li>
                        <li>Honest and fair</li>
                        <li>
                            Free from hate speech, harassment, or discrimination
                        </li>
                        <li>Not promotional or spam</li>
                        <li>Not defamatory or libelous</li>
                    </ul>
                    <p className='text-text/80 leading-relaxed mt-4'>
                        We reserve the right to remove reviews that violate
                        these guidelines. Cafe owners may report reviews they
                        believe violate our guidelines.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        7. Disclaimer
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        GroundsPH acts as a platform for user-generated
                        content. We are not the author of user submissions and
                        do not endorse or guarantee the accuracy of any content.
                        While we moderate content and respond to valid
                        complaints, we cannot guarantee that all content will be
                        accurate or that all infringing content will be
                        immediately identified and removed.
                    </p>
                </section>

                <section>
                    <h2 className='text-2xl font-serif font-semibold mb-4'>
                        8. Contact
                    </h2>
                    <p className='text-text/80 leading-relaxed'>
                        For all content-related inquiries, takedown requests, or
                        cafe owner requests, please contact:
                    </p>
                    <div className='bg-background border border-text/10 rounded-lg p-4 mt-4'>
                        <p className='font-medium'>GroundsPH Content Team</p>
                        <a
                            href='mailto:legal@grounds.ph'
                            className='text-primary hover:underline'
                        >
                            legal@grounds.ph
                        </a>
                    </div>
                </section>
            </div>
        </main>
    )
}
