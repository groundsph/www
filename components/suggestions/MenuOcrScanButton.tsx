"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
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

    const affordanceClasses =
        variant === "compact"
            ? "flex items-center gap-2 text-sm text-text/50 hover:text-primary transition-colors"
            : "flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"

    // If not logged in, show the same affordance as a link to auth, exactly like
    // the neighbouring contribution buttons. The scan itself never opens without
    // a session; the server still decides whether a scan may be written.
    if (!user) {
        return (
            <Link
                href={`/auth?redirect=/cafes/${cafeSlug}`}
                className={affordanceClasses}
            >
                <ScanLine className='w-3.5 h-3.5' />
                <span>Scan Menu</span>
            </Link>
        )
    }

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className={`${affordanceClasses} cursor-pointer`}
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
