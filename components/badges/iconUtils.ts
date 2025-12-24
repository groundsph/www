"use client"

import * as LucideIcons from "lucide-react"
import { LucideIcon } from "lucide-react"

// Curated list of popular/relevant Lucide icons for badges
// Grouped by category for easier browsing
export const BADGE_ICONS = {
    // Achievement & Awards
    awards: [
        "Award",
        "Medal",
        "Trophy",
        "Crown",
        "Gem",
        "Star",
        "Sparkles",
        "Zap",
        "Flame",
        "Target",
        "Flag",
        "CheckCircle2",
    ],
    // Coffee & Food
    food: [
        "Coffee",
        "Cup",
        "Milk",
        "Cookie",
        "Cake",
        "Croissant",
        "IceCream",
        "Bean",
        "Leaf",
        "Citrus",
    ],
    // Social & Community
    social: [
        "Heart",
        "HeartHandshake",
        "Users",
        "UserPlus",
        "MessageCircle",
        "ThumbsUp",
        "Share2",
        "Gift",
        "PartyPopper",
        "Handshake",
    ],
    // Exploration & Travel
    exploration: [
        "MapPin",
        "Map",
        "Compass",
        "Navigation",
        "Footprints",
        "Mountain",
        "Tent",
        "Binoculars",
        "Globe",
        "Plane",
    ],
    // Tech & Misc
    misc: [
        "Camera",
        "Bookmark",
        "Clock",
        "Calendar",
        "Lightbulb",
        "Rocket",
        "Shield",
        "Lock",
        "Key",
        "Infinity",
        "Hexagon",
        "Circle",
    ],
} as const

// Flatten all icon names for easy lookup
export const ALL_BADGE_ICON_NAMES = Object.values(BADGE_ICONS).flat()

// Type for valid badge icon names
export type BadgeIconName = (typeof ALL_BADGE_ICON_NAMES)[number]

// Get a Lucide icon component by name
export function getLucideIcon(name: string): LucideIcon | null {
    const icons = LucideIcons as unknown as Record<string, LucideIcon>
    return icons[name] || null
}

// Preset colors for the color picker
export const ICON_PRESET_COLORS = [
    // Browns/Coffee
    "#8B4513",
    "#A0522D",
    "#D2691E",
    "#CD853F",
    // Warm
    "#FF6B35",
    "#F7931E",
    "#FFD700",
    "#FFA500",
    // Nature
    "#228B22",
    "#2E8B57",
    "#3CB371",
    "#90EE90",
    // Cool
    "#4169E1",
    "#6495ED",
    "#00CED1",
    "#20B2AA",
    // Purple/Pink
    "#9370DB",
    "#BA55D3",
    "#FF69B4",
    "#DB7093",
    // Neutral
    "#696969",
    "#808080",
    "#A9A9A9",
    "#2F2F2F",
]
