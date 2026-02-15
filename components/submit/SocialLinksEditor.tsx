"use client"

import { CafeSocial } from "@/utils/types/cafe"
import { Plus, Trash2, Link as LinkIcon } from "lucide-react"

interface SocialLinksEditorProps {
    value: CafeSocial[]
    onChange: (socials: CafeSocial[]) => void
}

const SOCIAL_PRESETS = [
    "Facebook",
    "Instagram",
    "Twitter/X",
    "TikTok",
    "Website",
    "Google Maps",
    "Other",
]

export default function SocialLinksEditor({
    value,
    onChange,
}: SocialLinksEditorProps) {
    const addLink = () => {
        onChange([...value, { title: "", url: "" }])
    }

    const updateLink = (
        index: number,
        field: keyof CafeSocial,
        newValue: string
    ) => {
        const updated = [...value]
        updated[index] = { ...updated[index], [field]: newValue }
        onChange(updated)
    }

    const removeLink = (index: number) => {
        onChange(value.filter((_, i) => i !== index))
    }

    return (
        <div className='space-y-3'>
            {value.length > 0 && (
                <div className='space-y-2'>
                    {value.map((social, index) => (
                        <div
                            key={index}
                            className='flex items-center gap-2 p-3 bg-text/5 rounded-xl border border-text/10'
                        >
                            {/* Platform selector */}
                            <select
                                value={social.title}
                                onChange={(e) =>
                                    updateLink(index, "title", e.target.value)
                                }
                                className='px-3 py-2 text-sm border border-text/20 rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none min-w-[120px]'
                            >
                                <option value=''>Platform</option>
                                {SOCIAL_PRESETS.map((preset) => (
                                    <option
                                        key={preset}
                                        value={preset}
                                    >
                                        {preset}
                                    </option>
                                ))}
                            </select>

                            {/* URL input */}
                            <div className='flex-1 relative'>
                                <LinkIcon className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text opacity-40' />
                                <input
                                    type='url'
                                    value={social.url}
                                    onChange={(e) =>
                                        updateLink(index, "url", e.target.value)
                                    }
                                    placeholder='https://...'
                                    className='w-full pl-9 pr-3 py-2 text-sm border border-text/20 rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none'
                                />
                            </div>

                            {/* Remove button */}
                            <button
                                type='button'
                                onClick={() => removeLink(index)}
                                className='p-2 text-text/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer'
                            >
                                <Trash2 className='w-4 h-4' />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add button */}
            <button
                type='button'
                onClick={addLink}
                className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors cursor-pointer'
            >
                <Plus className='w-4 h-4' />
                Add Social Link
            </button>
        </div>
    )
}
