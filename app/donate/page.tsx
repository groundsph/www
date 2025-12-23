import { Metadata } from "next"
import { Heart, QrCode, Smartphone, Sparkles } from "lucide-react"
import Image from "next/image"

export const metadata: Metadata = {
    title: "Support Grounds",
    description: "Help support Grounds and keep the platform running",
}

import qrph from "@/assets/qrph-dono.jpg"
import gcash from "@/assets/gcash-dono.png"

export default function DonatePage() {
    return (
        <main className='min-h-screen bg-background py-12 px-6'>
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
                            {/* Placeholder for QR code - replace with actual QR image */}
                            <Image
                                src={qrph}
                                alt='QRPh QR Code'
                                className='rounded max-w-md h-auto aspect-square'
                            />
                            {/* <div className='w-48 h-48 bg-text/5 border-2 border-dashed border-text/20 rounded-lg flex items-center justify-center'>
                                <p className='text-text/40 text-sm text-center px-4'>
                                    QRPh QR Code
                                    <br />
                                    <span className='text-xs'>Coming soon</span>
                                </p>
                            </div> */}
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
                                className='rounded max-w-md h-auto aspect-square'
                            />
                            {/* Placeholder for GCash QR - replace with actual QR image */}
                            {/* <div className='w-48 h-48 bg-text/5 border-2 border-dashed border-text/20 rounded-lg flex items-center justify-center'>
                                <p className='text-text/40 text-sm text-center px-4'>
                                    GCash QR Code
                                    <br />
                                    <span className='text-xs'>Coming soon</span>
                                </p>
                            </div> */}
                        </div>
                    </div>

                    {/* Polar.sh - Coming Soon */}
                    <div className='bg-text/5 border border-text/10 rounded-xl p-6 opacity-60'>
                        <div className='flex items-center gap-3'>
                            <div className='w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center'>
                                <Sparkles className='w-5 h-5 text-purple-500' />
                            </div>
                            <div className='flex-1'>
                                <div className='flex items-center gap-2'>
                                    <h2 className='font-serif text-xl font-semibold text-text'>
                                        Polar.sh
                                    </h2>
                                    <span className='text-xs bg-text/10 text-text/60 px-2 py-0.5 rounded-full'>
                                        Coming Soon
                                    </span>
                                </div>
                                <p className='text-text/60 text-sm'>
                                    Support development through subscriptions
                                    and one-time donations
                                </p>
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
