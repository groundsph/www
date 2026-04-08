"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/layout/AuthProvider"
import SuggestMenuItemModal from "./SuggestMenuItemModal"

interface SuggestMenuItemButtonProps {
    cafeId: string
    cafeName: string
    variant?: "default" | "compact"
}

export default function SuggestMenuItemButton({
    cafeId,
    cafeName,
    variant = "default",
}: SuggestMenuItemButtonProps) {
    const { user } = useAuth()
    const [isModalOpen, setIsModalOpen] = useState(false)

    // If not logged in, show a link to auth
    if (!user) {
        return (
            <Link
                href={`/auth?redirect=/cafes/${cafeId}`}
                className={`flex items-center gap-2 transition-colors ${
                    variant === "compact"
                        ? "text-sm text-text/50 hover:text-primary"
                        : "px-3 py-1.5 text-sm font-medium text-text/60 hover:text-primary hover:bg-primary/10 rounded-lg"
                }`}
            >
                <Plus className='w-3.5 h-3.5' />
                <span>Log an Item</span>
            </Link>
        )
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
                <Plus className='w-3.5 h-3.5' />
                <span>Log an Item</span>
            </button>

            <SuggestMenuItemModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                cafeId={cafeId}
                cafeName={cafeName}
            />
        </>
    )
}
