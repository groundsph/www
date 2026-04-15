"use client"

import { X, Save, Send, Loader2 } from "lucide-react"
import { type BlogStatus } from "@/utils/types/blog"

interface BlogEditorLayoutProps {
    title: string
    subtitle?: string
    saveStatusText: string
    isSubmitting: boolean
    mode: "full" | "community"
    onCancel?: () => void
    onSubmit: (status: BlogStatus) => void
    children: React.ReactNode
    actionBar: React.ReactNode
}

export default function BlogEditorLayout({
    title,
    subtitle,
    saveStatusText,
    isSubmitting,
    mode,
    onCancel,
    onSubmit,
    children,
    actionBar,
}: BlogEditorLayoutProps) {
    const showPublish = mode === "full"
    return (
        <div className="h-full flex flex-col [&_button]:cursor-pointer">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4 border-b border-text/10 bg-background backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold font-serif text-text">{title}</h2>
                        {subtitle && <p className="text-sm text-text/60">{subtitle}</p>}
                        {saveStatusText && <p className="text-xs text-text/40 mt-0.5">{saveStatusText}</p>}
                    </div>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="p-2 rounded-xl bg-text/5 text-text/60 hover:bg-text/10 transition-colors sm:hidden"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="p-2 rounded-xl bg-text/5 text-text/60 hover:bg-text/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="px-6 py-6 space-y-6">
                    {children}
                </div>
            </div>

            {/* Bottom metadata bar (collapsible sections) */}
            {actionBar && (
                <div className="border-t border-text/10 bg-tertiary/10">
                    {actionBar}
                </div>
            )}

            {/* Sticky bottom bar with publish/draft buttons */}
            <div className="sticky bottom-0 z-10 border-t border-text/10 bg-background px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {showPublish && (
                        <button
                            onClick={() => onSubmit("published")}
                            disabled={isSubmitting}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Publish
                        </button>
                    )}
                    <button
                        onClick={() => onSubmit("draft")}
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-text/10 bg-white text-text/70 font-medium hover:bg-text/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Draft
                    </button>
                </div>
            </div>
        </div>
    )
}
