"use client"

import { Search } from "lucide-react"
import { cn } from "@/utils/cn"

interface SearchTriggerProps {
  onClick: () => void
  variant?: "desktop" | "mobile"
  className?: string
}

export function SearchTrigger({ onClick, variant = "desktop", className }: SearchTriggerProps) {
  if (variant === "mobile") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-xl",
          "bg-text/5 hover:bg-text/10 text-text/70 hover:text-text",
          "transition-colors",
          className
        )}
        aria-label="Search"
      >
        <Search className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl",
        "bg-text/5 hover:bg-text/10 text-text/70 hover:text-text",
        "border border-text/10 hover:border-text/20",
        "transition-all duration-200",
        className
      )}
    >
      <Search className="w-4 h-4" />
      <span className="text-sm">Search...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-background rounded border border-text/20 text-text/50 ml-2">
        <span className="text-[8px]">⌘</span>K
      </kbd>
    </button>
  )
}
