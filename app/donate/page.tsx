import { Metadata } from "next"
import {
    Heart,
    QrCode,
    Smartphone,
    Server,
    Code,
    Users,
    Rocket,
    Coffee,
    ExternalLink,
    Award,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
    title: "Support Grounds",
    description: "Help support Grounds and keep the platform running",
}

import qrph from "@/assets/qrph-dono.jpg"
import gcash from "@/assets/gcash-dono.png"

export default function DonatePage() {
    return (
        <main className='min-h-screen max-w-svw bg-background py-12 px-6'>
            <div className='max-w-2xl mx-auto'>
                {/* Header */}
                <div className='text-center mb-12'>
                    <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4'>
                        <Heart className='w-8 h-8 text-primary' />
                    </div>
                    <h1 className='font-serif text-4xl md:text-5xl font-bold text-text mb-4'>
                        Support Grounds
                    </h1>
                    <p className='text-text/70 text-lg max-w-md mx-auto'>
                        Help us keep the lights on and the coffee flowing. Your
                        support helps maintain and improve the platform for our
                        community.
                    </p>
                </div>

                {/* Donation Options */}
                <div className='space-y-6'>
                    {/* Ko-fi - Featured */}
                    <div className='bg-linear-to-br from-[#FF5E5B]/10 to-[#29ABE0]/10 border-2 border-[#FF5E5B]/30 rounded-xl p-6 relative overflow-hidden'>
                        {/* Badge highlight */}
                        <div className='absolute top-3 right-3 flex items-center gap-1.5 bg-primary/90 text-background text-xs font-semibold px-2.5 py-1 rounded-full'>
                            <Award className='w-3.5 h-3.5' />
                            Earn Supporter Badge
                        </div>

                        <div className='flex items-center gap-3 mb-4'>
                            <div className='w-12 h-12 rounded-lg bg-[#FF5E5B]/20 flex items-center justify-center'>
                                <Coffee className='w-6 h-6 text-[#FF5E5B]' />
                            </div>
                            <div>
                                <h2 className='font-serif text-xl font-semibold text-text'>
                                    Ko-fi
                                </h2>
                                <p className='text-text/60 text-sm'>
                                    One-time or monthly support
                                </p>
                            </div>
                        </div>

                        <p className='text-text/70 text-sm mb-4'>
                            Support on Ko-fi to become a{" "}
                            <strong>Grounds Supporter</strong>! You&apos;ll
                            receive a special badge on your profile and help
                            keep the platform running.
                        </p>

                        {/* Email matching note */}
                        <div className='bg-text/5 border border-text/10 rounded-lg p-3 mb-4'>
                            <p className='text-text/60 text-xs'>
                                <strong className='text-text/80'>
                                    💡 Tip:
                                </strong>{" "}
                                Use the same email as your Grounds account for
                                automatic badge linking.{" "}
                                <Link
                                    href='/profile/claim-supporter'
                                    className='text-primary hover:underline'
                                >
                                    Already donated? Claim your badge here
                                </Link>
                            </p>
                        </div>

                        <Link
                            href='https://ko-fi.com/adrianbonpin'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center gap-2 bg-[#FF5E5B] hover:bg-[#FF5E5B]/90 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors'
                        >
                            <Coffee className='w-4 h-4' />
                            Support on Ko-fi
                            <ExternalLink className='w-4 h-4' />
                        </Link>
                    </div>

                    {/* QRPh */}
                    <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                        <div className='flex items-center gap-3 mb-4'>
                            <div className='w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center'>
                                <QrCode className='w-5 h-5 text-primary' />
                            </div>
                            <div>
                                <h2 className='font-serif text-xl font-semibold text-text'>
                                    QRPh
                                </h2>
                                <p className='text-text/60 text-sm'>
                                    Scan with any QRPh-enabled banking app
                                </p>
                            </div>
                        </div>
                        <div className='bg-white rounded-lg p-4 flex items-center justify-center'>
                            <Image
                                src={qrph}
                                alt='QRPh QR Code'
                                className='rounded max-w-full w-md h-auto aspect-square'
                            />
                        </div>
                    </div>

                    {/* GCash */}
                    <div className='bg-text/5 border border-text/10 rounded-xl p-6'>
                        <div className='flex items-center gap-3 mb-4'>
                            <div className='w-10 h-10 rounded-lg bg-[#007DFE]/10 flex items-center justify-center'>
                                <Smartphone className='w-5 h-5 text-[#007DFE]' />
                            </div>
                            <div>
                                <h2 className='font-serif text-xl font-semibold text-text'>
                                    GCash
                                </h2>
                                <p className='text-text/60 text-sm'>
                                    Send via GCash mobile app
                                </p>
                            </div>
                        </div>
                        <div className='bg-white rounded-lg p-4 flex items-center justify-center'>
                            <Image
                                src={gcash}
                                alt='GCash QR Code'
                                className='rounded max-w-full w-md h-auto aspect-square'
                            />
                        </div>
                    </div>
                </div>

                {/* Why Support Section */}
                <div className='mt-12'>
                    <h2 className='font-serif text-2xl font-bold text-text mb-6 text-center'>
                        Why we need your support
                    </h2>
                    <div className='grid sm:grid-cols-2 gap-4'>
                        <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                            <div className='flex items-start gap-4'>
                                <div className='bg-primary/10 p-2 rounded-lg'>
                                    <Server className='w-5 h-5 text-primary' />
                                </div>
                                <div>
                                    <h3 className='font-semibold text-text mb-1'>
                                        Server & Domain
                                    </h3>
                                    <p className='text-sm text-text/70'>
                                        Your donations cover our monthly server,
                                        database, storage, and domain costs to
                                        keep the platform online.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                            <div className='flex items-start gap-4'>
                                <div className='bg-primary/10 p-2 rounded-lg'>
                                    <Code className='w-5 h-5 text-primary' />
                                </div>
                                <div>
                                    <h3 className='font-semibold text-text mb-1'>
                                        Development
                                    </h3>
                                    <p className='text-sm text-text/70'>
                                        Support the hours spent coding new
                                        features, fixing bugs, and improving the
                                        user experience.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                            <div className='flex items-start gap-4'>
                                <div className='bg-primary/10 p-2 rounded-lg'>
                                    <Users className='w-5 h-5 text-primary' />
                                </div>
                                <div>
                                    <h3 className='font-semibold text-text mb-1'>
                                        Community Growth
                                    </h3>
                                    <p className='text-sm text-text/70'>
                                        Help us organize events, create content,
                                        and support coffee communities across
                                        the Philippines.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className='p-4 bg-text/5 rounded-xl border border-text/10'>
                            <div className='flex items-start gap-4'>
                                <div className='bg-primary/10 p-2 rounded-lg'>
                                    <Rocket className='w-5 h-5 text-primary' />
                                </div>
                                <div>
                                    <h3 className='font-semibold text-text mb-1'>
                                        Ad-Free Experience
                                    </h3>
                                    <p className='text-sm text-text/70'>
                                        We want to keep Grounds clean and
                                        focused on coffee, without relying on
                                        intrusive ads.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Thank you note */}
                <div className='mt-12 text-center'>
                    <p className='text-text/50 text-sm italic'>
                        Every cup of coffee you buy us helps keep Grounds
                        running. Thank you for your support! ☕
                    </p>
                </div>
            </div>
        </main>
    )
}
