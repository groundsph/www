"use client"

import { motion } from "motion/react"
import { useEffect, useState } from "react"

export default function Loading() {
    // States
    const [trailing, setTrailing] = useState(".")
    // Effects
    useEffect(() => {
        const interval = setInterval(() => {
            setTrailing((prev) => {
                if (prev === "...") return "."
                return prev + "."
            })
        }, 500)
        return () => clearInterval(interval)
    }, [setTrailing])
    // Render
    return (
        <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='flex-1 w-full flex items-center justify-center'
        >
            Loading{trailing}
        </motion.section>
    )
}
