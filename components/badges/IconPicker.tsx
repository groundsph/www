"use client"

import { useState, useMemo } from "react"
import { Search, Check } from "lucide-react"
import {
    BADGE_ICONS,
    ALL_BADGE_ICON_NAMES,
    getLucideIcon,
    ICON_PRESET_COLORS,
} from "./iconUtils"

interface IconPickerProps {
    selectedIcon: string | null
    selectedColor: string
    onIconChange: (icon: string | null) => void
    onColorChange: (color: string) => void
}

const categoryLabels: Record<keyof typeof BADGE_ICONS, string> = {
    awards: "Awards & Achievement",
    food: "Coffee & Food",
    social: "Social & Community",
    exploration: "Exploration & Travel",
    misc: "Miscellaneous",
}

export default function IconPicker({
    selectedIcon,
    selectedColor,
    onIconChange,
    onColorChange,
}: IconPickerProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [showColorInput, setShowColorInput] = useState(false)
    const [customColor, setCustomColor] = useState(selectedColor)

    // Filter icons based on search
    const filteredIcons = useMemo(() => {
        if (!searchQuery.trim()) return null // Show categorized view

        const query = searchQuery.toLowerCase()
        return ALL_BADGE_ICON_NAMES.filter((name) =>
            name.toLowerCase().includes(query)
        )
    }, [searchQuery])

    const renderIconButton = (iconName: string) => {
        const IconComponent = getLucideIcon(iconName)
        if (!IconComponent) return null

        const isSelected = selectedIcon === iconName

        return (
            <button
                key={iconName}
                type='button'
                onClick={() => onIconChange(isSelected ? null : iconName)}
                className={`relative p-3 flex items-center justify-center rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                        ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                        : "border-text/10 hover:border-text/20 bg-text/5"
                }`}
                title={iconName}
            >
                <IconComponent
                    className='w-6 h-6'
                    style={{ color: isSelected ? selectedColor : undefined }}
                />
                {isSelected && (
                    <div className='absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center'>
                        <Check className='w-3 h-3 text-white' />
                    </div>
                )}
            </button>
        )
    }

    return (
        <div className='space-y-4'>
            {/* Search */}
            <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40' />
                <input
                    type='text'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='Search icons...'
                    className='w-full pl-10 pr-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm'
                />
            </div>

            {/* Icon Grid */}
            <div className='max-h-48 overflow-y-auto space-y-4 pr-1'>
                {filteredIcons ? (
                    // Search results
                    <div className='grid grid-cols-6 gap-2'>
                        {filteredIcons.map(renderIconButton)}
                        {filteredIcons.length === 0 && (
                            <p className='col-span-6 text-center text-text/50 text-sm py-4'>
                                No icons found
                            </p>
                        )}
                    </div>
                ) : (
                    // Categorized view
                    Object.entries(BADGE_ICONS).map(([category, icons]) => (
                        <div key={category}>
                            <h4 className='text-xs font-medium text-text/50 uppercase mb-2'>
                                {
                                    categoryLabels[
                                        category as keyof typeof BADGE_ICONS
                                    ]
                                }
                            </h4>
                            <div className='grid grid-cols-6 gap-2'>
                                {icons.map(renderIconButton)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Color Picker */}
            {selectedIcon && (
                <div className='pt-3 border-t border-text/10'>
                    <h4 className='text-xs font-medium text-text/50 uppercase mb-2'>
                        Icon Color
                    </h4>
                    <div className='flex flex-wrap gap-2'>
                        {ICON_PRESET_COLORS.map((color) => (
                            <button
                                key={color}
                                type='button'
                                onClick={() => {
                                    onColorChange(color)
                                    setCustomColor(color)
                                }}
                                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                                    selectedColor === color
                                        ? "border-text ring-2 ring-text/30"
                                        : "border-transparent"
                                }`}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                        {/* Custom color input toggle */}
                        <button
                            type='button'
                            onClick={() => setShowColorInput(!showColorInput)}
                            className={`w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-xs font-medium transition-all ${
                                showColorInput
                                    ? "border-text bg-text/10"
                                    : "border-text/30 hover:border-text/50"
                            }`}
                            title='Custom color'
                        >
                            #
                        </button>
                    </div>

                    {/* Custom hex input */}
                    {showColorInput && (
                        <div className='flex gap-2 mt-2'>
                            <input
                                type='text'
                                value={customColor}
                                onChange={(e) => setCustomColor(e.target.value)}
                                placeholder='#8B4513'
                                className='flex-1 px-3 py-1.5 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm font-mono'
                                maxLength={7}
                            />
                            <button
                                type='button'
                                onClick={() => {
                                    if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
                                        onColorChange(customColor)
                                    }
                                }}
                                className='px-3 py-1.5 bg-accent text-white rounded-lg text-sm hover:bg-accent/90 transition'
                            >
                                Apply
                            </button>
                        </div>
                    )}

                    {/* Preview */}
                    <div className='mt-3 flex items-center gap-3'>
                        <span className='text-xs text-text/50'>Preview:</span>
                        <div
                            className='w-12 h-12 rounded-full bg-background border-2 flex items-center justify-center'
                            style={{ borderColor: selectedColor }}
                        >
                            {(() => {
                                const Icon = getLucideIcon(selectedIcon)
                                return Icon ? (
                                    <Icon
                                        className='w-7 h-7'
                                        style={{ color: selectedColor }}
                                    />
                                ) : null
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
