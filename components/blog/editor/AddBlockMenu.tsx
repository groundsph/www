"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
    Code2,
    Coffee,
    Heading2,
    Image as ImageIcon,
    Images,
    Link2,
    MapPin,
    Megaphone,
    Minus,
    PenLine,
    Plus,
    Quote,
    Route,
    Store,
    Youtube,
    type LucideIcon,
} from "lucide-react"
import type { BlogBlockType } from "@/utils/types/blog-blocks"
import { cn } from "@/utils/cn"

interface BlockMenuItem {
    type: BlogBlockType
    label: string
    description: string
    icon: LucideIcon
}

export const BLOCK_MENU_GROUPS: { title: string; items: BlockMenuItem[] }[] = [
    {
        title: "Text",
        items: [
            { type: "text", label: "Text", description: "Rich paragraph with formatting", icon: PenLine },
            { type: "heading", label: "Heading", description: "Section title", icon: Heading2 },
            { type: "divider", label: "Divider", description: "Horizontal separator", icon: Minus },
        ],
    },
    {
        title: "Media",
        items: [
            { type: "image", label: "Image", description: "Single image with caption", icon: ImageIcon },
            { type: "gallery", label: "Image carousel", description: "Scrollable gallery", icon: Images },
            { type: "embed", label: "Embed", description: "YouTube or external link", icon: Youtube },
        ],
    },
    {
        title: "Cafes",
        items: [
            { type: "cafe", label: "Cafe", description: "Spotlight one cafe", icon: Coffee },
            { type: "cafe-carousel", label: "Cafe carousel", description: "Spotlight multiple cafes", icon: Store },
            { type: "map", label: "Map", description: "Plot cafes on a map", icon: MapPin },
            { type: "crawl", label: "Cafe crawl", description: "Embed a crawl itinerary", icon: Route },
        ],
    },
    {
        title: "Rich",
        items: [
            { type: "callout", label: "Callout", description: "Info, tip or warning box", icon: Megaphone },
            { type: "quote", label: "Quote", description: "Pull quote with attribution", icon: Quote },
            { type: "link-card", label: "Link card", description: "Call-to-action link", icon: Link2 },
            { type: "code", label: "Code", description: "Syntax-highlighted snippet", icon: Code2 },
        ],
    },
]

export const BLOCK_MENU_ITEMS: BlockMenuItem[] = BLOCK_MENU_GROUPS.flatMap(
    (group) => group.items
)

interface AddBlockMenuProps {
    onSelect: (type: BlogBlockType) => void
    label?: string
    variant?: "default" | "compact"
    className?: string
    /** When true the menu opens upward (useful near the page bottom). */
    dropUp?: boolean
    /** Restrict which block types can be inserted. */
    allowedTypes?: BlogBlockType[]
}

/** Popover picker for inserting a new content block. */
export default function AddBlockMenu({
    onSelect,
    label = "Add block",
    variant = "default",
    className,
    dropUp = false,
    allowedTypes,
}: AddBlockMenuProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const groups = allowedTypes
        ? BLOCK_MENU_GROUPS.map((group) => ({
              ...group,
              items: group.items.filter((item) => allowedTypes.includes(item.type)),
          })).filter((group) => group.items.length > 0)
        : BLOCK_MENU_GROUPS

    useEffect(() => {
        if (!open) return
        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onPointerDown)
        document.addEventListener("keydown", onKeyDown)
        return () => {
            document.removeEventListener("mousedown", onPointerDown)
            document.removeEventListener("keydown", onKeyDown)
        }
    }, [open])

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={open}
                className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-dashed border-text/25 font-medium text-text/50 transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary",
                    variant === "compact"
                        ? "px-2.5 py-1 text-xs"
                        : "px-3.5 py-2 text-sm"
                )}
            >
                <Plus className={variant === "compact" ? "w-3.5 h-3.5" : "w-4 h-4"} />
                {label}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        role="menu"
                        className={cn(
                            "absolute left-0 z-40 w-[300px] sm:w-[340px] rounded-2xl border border-text/10 bg-background p-3 shadow-xl",
                            dropUp ? "bottom-full mb-2" : "top-full mt-2"
                        )}
                    >
                        <div className="max-h-[60vh] space-y-3 overflow-y-auto custom-scrollbar">
                            {groups.map((group) => (
                                <div key={group.title}>
                                    <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-text/40">
                                        {group.title}
                                    </p>
                                    <div className="grid grid-cols-2 gap-1">
                                        {group.items.map((item) => (
                                            <button
                                                key={item.type}
                                                type="button"
                                                role="menuitem"
                                                onClick={() => {
                                                    onSelect(item.type)
                                                    setOpen(false)
                                                }}
                                                className="flex items-start gap-2 rounded-xl p-2 text-left transition-colors hover:bg-primary/5"
                                            >
                                                <item.icon className="mt-0.5 w-4 h-4 shrink-0 text-primary" />
                                                <span className="min-w-0">
                                                    <span className="block text-xs font-medium text-text">
                                                        {item.label}
                                                    </span>
                                                    <span className="block text-[10px] leading-tight text-text/50">
                                                        {item.description}
                                                    </span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
