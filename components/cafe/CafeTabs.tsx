"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Info, List, MessageSquare, UtensilsCrossed } from "lucide-react"

type TabId = "about" | "details" | "menu" | "reviews"

interface Tab {
    id: TabId
    label: string
    icon: typeof Info
}

const TABS: Tab[] = [
    { id: "about", label: "About", icon: Info },
    { id: "details", label: "Details", icon: List },
    { id: "menu", label: "Menu", icon: UtensilsCrossed },
    { id: "reviews", label: "Reviews", icon: MessageSquare },
]

interface CafeTabsProps {
    tabContent: {
        about: React.ReactNode
        details: React.ReactNode
        menu: React.ReactNode
        reviews: React.ReactNode
    }
    reviewCount?: number
    menuCount?: number
}

export default function CafeTabs({
    tabContent,
    reviewCount,
    menuCount,
}: CafeTabsProps) {
    const { trigger } = useHaptics()
    const [activeTab, setActiveTab] = useState<TabId>("about")

    return (
        <div className='w-full flex flex-col'>
            {/* Tab Headers */}
            <div className='flex flex-row border-b border-text/10 sticky top-0 bg-background z-10 overflow-x-auto'>
                {TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id

                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                trigger("selection")
                                setActiveTab(tab.id)
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 font-semibold text-sm transition-colors relative cursor-pointer ${
                                isActive
                                    ? "text-primary"
                                    : "text-text/50 hover:text-text/70"
                            }`}
                        >
                            <Icon className='w-4 h-4' />
                            {tab.label}
                            {tab.id === "menu" && menuCount === 0 && (
                                <span className='absolute top-1.5 right-1/2 translate-x-6 w-2 h-2 bg-primary rounded-full' />
                            )}
                            {tab.id === "reviews" &&
                                reviewCount !== undefined &&
                                reviewCount > 0 && (
                                    <span className='text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full'>
                                        {reviewCount}
                                    </span>
                                )}
                            {isActive && (
                                <motion.div
                                    layoutId='activeTab'
                                    className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary'
                                />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            <div className='px-4 py-4'>
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {tabContent[activeTab]}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
