"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { ScanLine } from "lucide-react"
import { useAuth } from "@/components/layout/AuthProvider"

const MenuOcrScanModal = dynamic(
    () => import("@/components/suggestions/MenuOcrScanModal"),
    { ssr: false }
)

interface MenuOcrScanButtonProps {
    cafeId: string
    cafeName: string
    cafeSlug: string
    variant?: "default" | "compact"
}

export default function MenuOcrScanButton({
    cafeId,
    cafeName,
    cafeSlug,
    variant = "default",
}: MenuOcrScanButtonProps) {
    const { user } = useAuth()
    const [isModalOpen, setIsModalOpen] = useState(false)

    if (!user) {
        return null
    }

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className={`flex items-center gap-2 transition-colors cursor-pointer ${
                    variant === "compact"
                        ? "text-sm text-text/50 hover:text-primary"
                        : "px-3 py-1.5 text-sm font-medium text-text/60 hover:text-primary hover:bg-primary/10 rounded-lg"
                }`}
            >
                <ScanLine className='w-3.5 h-3.5' />
                <span>Scan Menu</span>
            </button>

            <MenuOcrScanModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                cafeId={cafeId}
                cafeName={cafeName}
                cafeSlug={cafeSlug}
            />
        </>
    )
}
