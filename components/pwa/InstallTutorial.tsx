"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Apple, Smartphone } from "lucide-react"
import { cn } from "@/utils/cn"

type Platform = "ios" | "android"

const iosSteps = [
    { number: 1, title: "Open in Safari", description: "Make sure you're viewing this page in Safari. PWA installation only works from Safari on iOS." },
    { number: 2, title: "Tap the Share button", description: "Tap the share icon (square with an arrow pointing up) at the bottom of the screen." },
    { number: 3, title: 'Scroll and tap "Add to Home Screen"', description: 'Scroll down in the share menu and tap "Add to Home Screen".' },
    { number: 4, title: "Confirm", description: "Tap \"Add\" in the top-right corner. Grounds will appear on your home screen." },
]

const androidSteps = [
    { number: 1, title: "Open in Chrome", description: "Make sure you're viewing this page in Chrome (or another supported browser) on your Android device." },
    { number: 2, title: "Tap the menu", description: "Tap the three-dot menu icon in the top-right corner of the browser." },
    { number: 3, title: 'Tap "Install app" or "Add to Home Screen"', description: 'Look for "Install app" or "Add to Home Screen" in the menu and tap it.' },
    { number: 4, title: "Confirm", description: "Tap \"Install\" in the prompt. Grounds will be added to your home screen and app drawer." },
]

export function InstallTutorial() {
    const [platform, setPlatform] = useState<Platform>("ios")
    const steps = platform === "ios" ? iosSteps : androidSteps

    return (
        <div>
            {/* Platform Toggle */}
            <div className='flex gap-2 mb-8'>
                <button
                    onClick={() => setPlatform("ios")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        platform === "ios"
                            ? "bg-primary text-white"
                            : "bg-surface text-text/60 hover:bg-surface-hover"
                    )}
                >
                    <Apple className='h-4 w-4' />
                    iPhone / iPad
                </button>
                <button
                    onClick={() => setPlatform("android")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        platform === "android"
                            ? "bg-primary text-white"
                            : "bg-surface text-text/60 hover:bg-surface-hover"
                    )}
                >
                    <Smartphone className='h-4 w-4' />
                    Android
                </button>
            </div>

            {/* Steps */}
            <motion.ol
                key={platform}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className='space-y-6'
            >
                {steps.map((step) => (
                    <li key={step.number} className='flex gap-4'>
                        <div className='shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold'>
                            {step.number}
                        </div>
                        <div>
                            <h2 className='font-semibold mb-1'>{step.title}</h2>
                            <p className='text-sm text-text/60'>{step.description}</p>
                        </div>
                    </li>
                ))}
            </motion.ol>

            {/* Note */}
            <div className='mt-10 p-4 rounded-xl bg-surface text-sm text-text/60'>
                <p className='font-medium text-text mb-1'>Already installed?</p>
                <p>
                    If you already have Grounds on your home screen, you can safely close this page.
                    Open the app from your home screen for the best experience.
                </p>
            </div>
        </div>
    )
}
