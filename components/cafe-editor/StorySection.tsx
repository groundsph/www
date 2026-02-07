"use client"

/**
 * StorySection - Shared component for cafe story/about editing.
 * Used by CafeEditor (admin) and CafeEditClient (owner).
 */

import { useState } from "react"
import { Save, Trash2, Loader2, Eye, Edit3 } from "lucide-react"
import { type ColorScheme, getColorClasses } from "@/utils/hooks/cafe-form"
import MarkdownRender from "@/components/ui/MarkdownRender"

interface StorySectionProps {
    /** Current story content (markdown) */
    content: string
    /** Update content */
    onChange: (content: string) => void
    /** Save the story */
    onSave: () => Promise<void>
    /** Delete the story */
    onDelete?: () => Promise<void>
    /** Whether the story has unsaved changes */
    hasChanges: boolean
    /** Whether save is in progress */
    saving: boolean
    /** Color scheme for theming */
    colorScheme?: ColorScheme
}

/**
 * Story/About section for cafe editing.
 * Includes markdown editor with preview toggle.
 */
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
    const [showPreview, setShowPreview] = useState(false)

    return (
        <div className='space-y-6'>
            <div>
                <div className='flex items-center justify-between mb-2'>
                    <label className='block text-sm font-medium text-text/60'>
                        Cafe Story (Markdown)
                    </label>
                    <div className='flex items-center gap-2'>
                        {/* Preview Toggle */}
                        <button
                            type='button'
                            onClick={() => setShowPreview(!showPreview)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                                showPreview
                                    ? `${colors.bgLight} ${colors.text}`
                                    : "bg-text/10 hover:bg-text/20"
                            }`}
                        >
                            {showPreview ? (
                                <>
                                    <Edit3 className='w-4 h-4' />
                                    Edit
                                </>
                            ) : (
                                <>
                                    <Eye className='w-4 h-4' />
                                    Preview
                                </>
                            )}
                        </button>

                        {/* Delete Button */}
                        {content && onDelete && (
                            <button
                                type='button'
                                onClick={async () => {
                                    if (
                                        !confirm(
                                            "Are you sure you want to delete this story?"
                                        )
                                    )
                                        return
                                    await onDelete()
                                }}
                                disabled={saving}
                                className='flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-500 rounded-lg text-sm hover:bg-red-500/30 transition disabled:opacity-50'
                            >
                                <Trash2 className='w-4 h-4' />
                                Delete
                            </button>
                        )}

                        {/* Save Button */}
                        {hasChanges && (
                            <button
                                type='button'
                                onClick={onSave}
                                disabled={saving}
                                className={`flex items-center gap-1 px-3 py-1.5 ${colors.bgLight} ${colors.text} rounded-lg text-sm hover:opacity-80 transition disabled:opacity-50`}
                            >
                                {saving ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                    <Save className='w-4 h-4' />
                                )}
                                Save Story
                            </button>
                        )}
                    </div>
                </div>

                {showPreview ? (
                    <div className='min-h-[300px] p-6 bg-background border border-text/10 rounded-lg prose prose-sm max-w-none'>
                        {content ? (
                            <MarkdownRender content={content} />
                        ) : (
                            <p className='text-text/40 italic'>
                                No story content yet.
                            </p>
                        )}
                    </div>
                ) : (
                    <textarea
                        value={content}
                        onChange={(e) => onChange(e.target.value)}
                        rows={12}
                        className={`w-full px-4 py-3 bg-background border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing} resize-none font-mono text-sm`}
                        placeholder="Write your cafe's story using Markdown..."
                    />
                )}

                <p className='text-xs text-text/40 mt-2'>
                    Supports Markdown formatting: **bold**, *italic*,
                    [links](url), etc.
                </p>
            </div>
        </div>
    )
}
