"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { CafeWithRatings } from "@/utils/types/extra"
import SuggestEditModal from "./SuggestEditModal"
import Link from "next/link"
import { useAuth } from "@/components/layout/AuthProvider"

interface SuggestEditButtonProps {
    cafe: CafeWithRatings
    variant?: "default" | "compact"
}

export default function SuggestEditButton({
    cafe,
    variant = "default",
}: SuggestEditButtonProps) {
    const user = useAuth().user
    const [isModalOpen, setIsModalOpen] = useState(false)

    // If not logged in, show a link to auth
    if (!user) {
        return (
            <Link
                href={`/auth?redirect=/cafes/${cafe.slug}`}
                className={`flex items-center gap-2 transition-colors ${
                    variant === "compact"
                        ? "text-sm text-text/50 hover:text-primary"
                        : "px-3 py-1.5 text-sm font-medium text-text/60 hover:text-primary hover:bg-primary/10 rounded-lg"
                }`}
            >
                <Pencil className='w-3.5 h-3.5' />
                <span>Suggest an Edit</span>
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
                <Pencil className='w-3.5 h-3.5' />
                <span>Suggest an Edit</span>
            </button>

            <SuggestEditModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                cafe={cafe}
            />
        </>
    )
}
