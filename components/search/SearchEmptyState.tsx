"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { emptyStateSuggestions, quickActionHelp } from "@/utils/search-index"
import { Sparkles } from "lucide-react"

const suggestions = emptyStateSuggestions

export function SearchEmptyState() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % suggestions.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <p className="text-xs font-medium text-text/50 uppercase tracking-wider mb-3">Featured</p>
        <div className="relative h-16 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.a
              key={currentIndex}
              href={suggestions[currentIndex].href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center gap-3 p-3 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-text">{suggestions[currentIndex].title}</p>
                <p className="text-sm text-text/60">{suggestions[currentIndex].subtitle}</p>
              </div>
            </motion.a>
          </AnimatePresence>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-text/50 uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="space-y-2">
          {quickActionHelp.map((action) => (
            <div key={action.prefix} className="flex items-center justify-between p-3 rounded-xl bg-text/5">
              <div className="flex items-center gap-3">
                <kbd className="px-2 py-1 bg-background rounded-lg border border-text/20 text-sm font-mono text-text">
                  {action.prefix}
                </kbd>
                <span className="text-sm text-text/70">{action.description}</span>
              </div>
              <span className="text-xs text-text/40">{action.example}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium text-text/50 uppercase tracking-wider mb-3">Popular</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Submit Cafe", href: "/submit" },
            { label: "Browse Map", href: "/map" },
            { label: "Community", href: "/community" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 text-sm bg-text/5 hover:bg-text/10 text-text/70 hover:text-text rounded-full transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
