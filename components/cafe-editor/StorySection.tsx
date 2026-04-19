"use client"

import { Save, Trash2, Loader2 } from "lucide-react"
import { type ColorScheme, getColorClasses } from "@/utils/hooks/cafe-form"
import MarkdownEditor from "@/components/ui/markdown-editor/MarkdownEditor"

interface StorySectionProps {
    content: string
    onChange: (content: string) => void
    onSave: () => Promise<void>
    onDelete?: () => Promise<void>
    hasChanges: boolean
    saving: boolean
    colorScheme?: ColorScheme
}

export default function StorySection({
    content,
    onChange,
    onSave,
    onDelete,
    hasChanges,
    saving,
    colorScheme = "primary",
}: StorySectionProps) {
    const colors = getColorClasses(colorScheme)

    return (
        <div className="space-y-4">
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-text/60">
                        Cafe Story (Markdown)
                    </label>
                    <div className="flex items-center gap-2">
                        {content && onDelete && (
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!confirm("Are you sure you want to delete this story?")) return
                                    await onDelete()
                                }}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-500 rounded-lg text-sm hover:bg-red-500/30 transition disabled:opacity-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        )}
                        {hasChanges && (
                            <button
                                type="button"
                                onClick={onSave}
                                disabled={saving}
                                className={`flex items-center gap-1 px-3 py-1.5 ${colors.bgLight} ${colors.text} rounded-lg text-sm hover:opacity-80 transition disabled:opacity-50`}
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save Story
                            </button>
                        )}
                    </div>
                </div>

                <MarkdownEditor
                    mode="medium"
                    value={content}
                    onChange={onChange}
                    placeholder="Write your cafe's story... Use the toolbar for formatting."
                    minHeight={300}
                />
            </div>
        </div>
    )
}
