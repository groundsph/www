# Cafe Menu: OCR, Global Search, and Community Edit Suggestions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OCR-powered menu scanning, fix global search menu item navigation and add nearest sorting, and enable community edit suggestions for existing menu items.

**Architecture:** Three feature tracks: (1) OCR server action using OpenAI-compatible vision API to extract menu items from photos, with smart deduplication and a results review UI; (2) Global search menu items link to cafe page instead of menu page, with nearest-cafe sorting when user location is available; (3) Wire up existing `SuggestMenuItemModal` edit mode into the menu display components so community can suggest corrections.

**Tech Stack:** Next.js App Router, Drizzle ORM, OpenAI-compatible API (vision), existing `menuItemSuggestions` table, existing `haversineDistance`/`getNearbyCafes` utilities, Tailwind CSS v4, `motion/react` for animations.

---

## Feature 1: OCR for Adding Cafe Menus

### Context

Currently, menu items must be manually entered one by one. This feature lets users (community, admin, owner) upload a photo of a cafe menu, extract items via OCR/vision AI, review the extracted items, and bulk-add them. The AI model is configurable via env var. Smart deduplication prevents adding items that already exist.

### Task 1.1: Add OCR model env var to `.env.example`

**Files:**
- Modify: `.env.example:69-77`

**Step 1: Add env var**

Add `OPENAI_COMPATIBLE_OCR_MODEL` to the AI section of `.env.example`:

```env
# OCR/Vision model for menu scanning (must support image input)
OPENAI_COMPATIBLE_OCR_MODEL="gpt-4o"
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add OCR model env var to .env.example"
```

### Task 1.2: Create OCR utility for menu extraction

**Files:**
- Create: `utils/ai/menu-ocr.ts`
- Test: `utils/ai/__tests__/menu-ocr.test.ts`

**Step 1: Write the failing test**

```typescript
// utils/ai/__tests__/menu-ocr.test.ts
import { describe, it, expect } from "bun:test"
import { parseOcrMenuItems, type OcrMenuItem } from "@/utils/ai/menu-ocr"

describe("parseOcrMenuItems", () => {
    it("parses valid JSON array of menu items", () => {
        const raw = JSON.stringify([
            { name: "Spanish Latte", category: "Coffee", price: 180 },
            { name: "Cappuccino", category: "Coffee", price: 150 },
        ])
        const result = parseOcrMenuItems(raw)
        expect(result).toHaveLength(2)
        expect(result[0].name).toBe("Spanish Latte")
        expect(result[0].price).toBe(180)
    })

    it("returns empty array for invalid JSON", () => {
        expect(parseOcrMenuItems("not json")).toEqual([])
    })

    it("filters out items missing required fields", () => {
        const raw = JSON.stringify([
            { name: "Spanish Latte", category: "Coffee", price: 180 },
            { name: "", category: "Coffee", price: 100 },
            { name: "No Price", category: "Coffee" },
        ])
        const result = parseOcrMenuItems(raw)
        expect(result).toHaveLength(1)
    })

    it("normalizes price to number", () => {
        const raw = JSON.stringify([
            { name: "Latte", category: "Coffee", price: "180" },
        ])
        const result = parseOcrMenuItems(raw)
        expect(result[0].price).toBe(180)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/menu-ocr.test.ts`
Expected: FAIL with "module not found"

**Step 3: Write the implementation**

```typescript
// utils/ai/menu-ocr.ts
import { z } from "zod"

const OcrMenuItemSchema = z.object({
    name: z.string().min(1),
    category: z.string().min(1),
    price: z.number().nonnegative(),
    description: z.string().optional(),
    is_food: z.boolean().optional(),
    is_hot: z.boolean().optional(),
    is_cold: z.boolean().optional(),
})

export type OcrMenuItem = z.infer<typeof OcrMenuItemSchema>

const OCR_SYSTEM_PROMPT = `You are a menu item extractor. Given an image of a cafe/restaurant menu, extract ALL menu items you can identify.

For each item, provide:
- name: The item name exactly as written
- category: One of [Coffee, Espresso Drinks, Cold Brew, Non-Coffee, Tea, Milk Drinks, Frappes, Smoothies, Specialty Drinks, Refreshers, Food, Rice Meals, Sandwiches, Pasta, Breakfast, Snacks, Pastries, Desserts, Cakes, Add-ons, Other]
- price: The numeric price (no currency symbol)
- description: Brief description if visible (optional)
- is_food: true if it's food, false if drink
- is_hot: true if hot variant exists
- is_cold: true if cold variant exists

Respond with a JSON array of objects. If no menu items are found, return an empty array.`

function getOcrModel(): string {
    return process.env.OPENAI_COMPATIBLE_OCR_MODEL ?? "gpt-4o"
}

export async function extractMenuItemsFromImage(
    imageBase64: string
): Promise<{ items: OcrMenuItem[]; rawResponse: string }> {
    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL ?? ""
    const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY ?? ""

    if (!baseUrl || !apiKey) {
        throw new Error("Missing OPENAI_COMPATIBLE_BASE_URL or OPENAI_COMPATIBLE_API_KEY")
    }

    const normalizedUrl = baseUrl.replace(/\/$/, "")
    const model = getOcrModel()

    const response = await fetch(`${normalizedUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: OCR_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`,
                                detail: "high",
                            },
                        },
                        {
                            type: "text",
                            text: "Extract all menu items from this image. Return as JSON array.",
                        },
                    ],
                },
            ],
            max_tokens: 4000,
            temperature: 0.1,
        }),
        signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
        throw new Error(`OCR request failed: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
    }

    const content = data.choices?.[0]?.message?.content ?? "[]"
    const items = parseOcrMenuItems(content)

    return { items, rawResponse: content }
}

export function parseOcrMenuItems(raw: string): OcrMenuItem[] {
    try {
        // Try to extract JSON from the response (may have markdown code blocks)
        const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw]
        const jsonStr = jsonMatch[1].trim()
        const parsed = JSON.parse(jsonStr)

        if (!Array.isArray(parsed)) return []

        return parsed
            .map((item) => {
                const result = OcrMenuItemSchema.safeParse({
                    ...item,
                    price: typeof item.price === "string" ? parseFloat(item.price) : item.price,
                })
                return result.success ? result.data : null
            })
            .filter((item): item is OcrMenuItem => item !== null)
    } catch {
        return []
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/menu-ocr.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/ai/menu-ocr.ts utils/ai/__tests__/menu-ocr.test.ts
git commit -m "feat: add OCR menu extraction utility"
```

### Task 1.3: Create server action for OCR menu scanning

**Files:**
- Create: `app/api/actions/menu-ocr.ts`
- Test: `app/api/actions/__tests__/menu-ocr.test.ts`

**Step 1: Write the failing test**

```typescript
// app/api/actions/__tests__/menu-ocr.test.ts
import { describe, it, expect } from "bun:test"

describe("deduplicateMenuItems", () => {
    // Import will fail until we create the file
    const { deduplicateMenuItems } = await import("@/app/api/actions/menu-ocr")

    it("removes items that match existing by name (case-insensitive)", () => {
        const newItems = [
            { name: "Spanish Latte", category: "Coffee", price: 180 },
            { name: "Cappuccino", category: "Coffee", price: 150 },
            { name: "Mocha", category: "Coffee", price: 170 },
        ]
        const existing = [
            { name: "spanish latte", category: "Coffee", price: 180 },
            { name: "Cappuccino", category: "Espresso Drinks", price: 160 },
        ]
        const result = deduplicateMenuItems(newItems, existing)
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe("Mocha")
    })

    it("handles empty existing items", () => {
        const newItems = [
            { name: "Latte", category: "Coffee", price: 150 },
        ]
        const result = deduplicateMenuItems(newItems, [])
        expect(result).toHaveLength(1)
    })

    it("handles empty new items", () => {
        const result = deduplicateMenuItems([], [{ name: "Latte", category: "Coffee", price: 150 }])
        expect(result).toHaveLength(0)
    })

    it("detects fuzzy matches with minor differences", () => {
        const newItems = [
            { name: "Spanish  Latte", category: "Coffee", price: 180 },
            { name: "cappuccino", category: "Coffee", price: 150 },
        ]
        const existing = [
            { name: "Spanish Latte", category: "Coffee", price: 170 },
        ]
        const result = deduplicateMenuItems(newItems, existing)
        // "Spanish  Latte" should match "Spanish Latte" (normalized whitespace)
        // "cappuccino" is different enough
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe("cappuccino")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test app/api/actions/__tests__/menu-ocr.test.ts`
Expected: FAIL with "module not found"

**Step 3: Write the implementation**

```typescript
// app/api/actions/menu-ocr.ts
"use server"

import { db } from "@/db"
import { cafeMenuItems, cafes } from "@/db/schema/tables"
import { eq, and } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"
import { extractMenuItemsFromImage, type OcrMenuItem } from "@/utils/ai/menu-ocr"
import { revalidatePath } from "next/cache"
import { recalculatePriceLevel } from "./price-level"

export interface OcrResult {
    success: boolean
    items?: OcrMenuItem[]
    deduplicated?: OcrMenuItem[]
    duplicates?: string[]
    error?: string
}

/**
 * Normalize a menu item name for comparison:
 * - lowercase
 * - collapse whitespace
 * - trim
 */
function normalizeName(name: string): string {
    return name.toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Check if two items are "the same" based on normalized name similarity.
 * Uses Levenshtein distance for fuzzy matching (allows minor typos from OCR).
 */
function isSimilarName(a: string, b: string): boolean {
    const na = normalizeName(a)
    const nb = normalizeName(b)

    // Exact match after normalization
    if (na === nb) return true

    // If one contains the other (e.g., "Latte" vs "Cafe Latte")
    if (na.includes(nb) || nb.includes(na)) return true

    // Levenshtein distance - allow up to 2 edits for items > 5 chars
    if (na.length > 5 && nb.length > 5) {
        const distance = levenshteinDistance(na, nb)
        const maxLen = Math.max(na.length, nb.length)
        // Allow ~20% difference
        if (distance / maxLen <= 0.2) return true
    }

    return false
}

function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []
    for (let i = 0; i <= b.length; i++) matrix[i] = [i]
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                )
            }
        }
    }
    return matrix[b.length][a.length]
}

/**
 * Deduplicate new menu items against existing ones.
 * Returns only items that don't match existing items by name.
 */
export function deduplicateMenuItems(
    newItems: OcrMenuItem[],
    existingItems: Array<{ name: string; category: string; price: number }>
): OcrMenuItem[] {
    return newItems.filter((newItem) => {
        return !existingItems.some((existing) =>
            isSimilarName(newItem.name, existing.name)
        )
    })
}

/**
 * Scan a menu image and extract items using OCR/vision AI.
 * Returns extracted items for review before saving.
 */
export async function scanMenuImage(
    cafeId: string,
    imageBase64: string
): Promise<OcrResult> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Authentication required" }

    // Verify cafe exists
    const [cafe] = await db
        .select({ id: cafes.id })
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1)

    if (!cafe) return { success: false, error: "Cafe not found" }

    try {
        const { items } = await extractMenuItemsFromImage(imageBase64)

        if (items.length === 0) {
            return { success: true, items: [], deduplicated: [], duplicates: [] }
        }

        // Fetch existing menu items for deduplication
        const existing = await db
            .select({
                name: cafeMenuItems.name,
                category: cafeMenuItems.category,
                price: cafeMenuItems.price,
            })
            .from(cafeMenuItems)
            .where(eq(cafeMenuItems.cafeId, cafeId))

        const deduplicated = deduplicateMenuItems(items, existing)
        const duplicateNames = items
            .filter((item) => !deduplicated.includes(item))
            .map((item) => item.name)

        return {
            success: true,
            items,
            deduplicated,
            duplicates: duplicateNames,
        }
    } catch (error) {
        console.error("OCR menu scan failed:", error)
        return { success: false, error: "Failed to scan menu image" }
    }
}

/**
 * Save reviewed OCR-extracted items as menu items.
 */
export async function saveOcrMenuItems(
    cafeId: string,
    items: OcrMenuItem[]
): Promise<{ success: boolean; saved?: number; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Authentication required" }

    if (items.length === 0) return { success: true, saved: 0 }

    try {
        // Get current max sortOrder
        const existing = await db
            .select({ sortOrder: cafeMenuItems.sortOrder })
            .from(cafeMenuItems)
            .where(eq(cafeMenuItems.cafeId, cafeId))
            .orderBy(cafeMenuItems.sortOrder)

        let nextSortOrder = existing.length > 0
            ? Math.max(...existing.map((e) => e.sortOrder ?? 0)) + 1
            : 0

        const values = items.map((item) => ({
            cafeId,
            name: item.name,
            category: item.category,
            price: item.price,
            description: item.description || null,
            isFood: item.is_food || false,
            isHot: item.is_hot || false,
            isCold: item.is_cold || false,
            communitySubmitted: true,
            lastUpdatedBy: user.id,
            sortOrder: nextSortOrder++,
        }))

        await db.insert(cafeMenuItems).values(values)

        await recalculatePriceLevel(cafeId)

        revalidatePath(`/cafes/`)
        revalidatePath(`/cafes/${cafeId}`)

        return { success: true, saved: values.length }
    } catch (error) {
        console.error("Failed to save OCR menu items:", error)
        return { success: false, error: "Failed to save menu items" }
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test app/api/actions/__tests__/menu-ocr.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/actions/menu-ocr.ts app/api/actions/__tests__/menu-ocr.test.ts
git commit -m "feat: add OCR menu scanning server action with deduplication"
```

### Task 1.4: Create OCR scan modal component

**Files:**
- Create: `components/suggestions/MenuOcrScanModal.tsx`

**Step 1: Write the component**

```tsx
// components/suggestions/MenuOcrScanModal.tsx
"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    XIcon, Loader2, Check, Upload, Camera, Trash2, AlertTriangle,
} from "lucide-react"
import Image from "next/image"
import imageCompression from "browser-image-compression"
import { scanMenuImage, saveOcrMenuItems } from "@/app/api/actions/menu-ocr"
import type { OcrMenuItem } from "@/utils/ai/menu-ocr"
import { MENU_CATEGORIES } from "@/utils/types/owner"

interface MenuOcrScanModalProps {
    isOpen: boolean
    onClose: () => void
    cafeId: string
    cafeName: string
    cafeSlug: string
}

type Step = "upload" | "scanning" | "review" | "saving" | "done"

export default function MenuOcrScanModal({
    isOpen,
    onClose,
    cafeId,
    cafeName,
    cafeSlug,
}: MenuOcrScanModalProps) {
    const [step, setStep] = useState<Step>("upload")
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [extractedItems, setExtractedItems] = useState<OcrMenuItem[]>([])
    const [duplicates, setDuplicates] = useState<string[]>([])
    const [savedCount, setSavedCount] = useState(0)

    const resetState = useCallback(() => {
        setStep("upload")
        setImagePreview(null)
        setError(null)
        setExtractedItems([])
        setDuplicates([])
        setSavedCount(0)
    }, [])

    const handleClose = () => {
        resetState()
        onClose()
    }

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setError(null)

        try {
            // Compress image before sending
            const compressed = await imageCompression(file, {
                maxSizeMB: 2,
                maxWidthOrHeight: 2048,
                fileType: "image/jpeg",
            })

            const base64 = await imageCompression.getDataUrlFromFile(compressed)
            const base64Data = base64.split(",")[1]

            setImagePreview(URL.createObjectURL(compressed))
            setStep("scanning")

            const result = await scanMenuImage(cafeId, base64Data)

            if (!result.success) {
                setError(result.error || "Scan failed")
                setStep("upload")
                return
            }

            setExtractedItems(result.deduplicated || [])
            setDuplicates(result.duplicates || [])
            setStep("review")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to process image")
            setStep("upload")
        }
    }

    const handleRemoveItem = (index: number) => {
        setExtractedItems((prev) => prev.filter((_, i) => i !== index))
    }

    const handleEditItem = (index: number, field: keyof OcrMenuItem, value: string | number | boolean) => {
        setExtractedItems((prev) =>
            prev.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            )
        )
    }

    const handleSave = async () => {
        if (extractedItems.length === 0) return

        setStep("saving")
        const result = await saveOcrMenuItems(cafeId, extractedItems)

        if (!result.success) {
            setError(result.error || "Failed to save")
            setStep("review")
            return
        }

        setSavedCount(result.saved || 0)
        setStep("done")
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl sm:w-full bg-background text-text rounded-xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden border border-text/10"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-text/10">
                            <div>
                                <span className="text-xs font-medium tracking-wide uppercase text-text/50">
                                    Scan Menu
                                </span>
                                <h2 className="text-xl font-serif font-semibold">
                                    {cafeName}
                                </h2>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-text/10 rounded-lg transition-colors text-text/40 hover:text-text cursor-pointer"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {step === "upload" && (
                                <div className="flex flex-col items-center gap-4 py-8">
                                    <label className="w-full max-w-md border-2 border-dashed border-text/20 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                                        <Upload className="w-10 h-10 text-text/30" />
                                        <p className="text-sm text-text/60 text-center">
                                            Upload a photo of the cafe menu
                                        </p>
                                        <p className="text-xs text-text/40">
                                            JPG, PNG up to 10MB
                                        </p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handleImageSelect}
                                            className="hidden"
                                        />
                                    </label>
                                    {error && (
                                        <p className="text-sm text-red-500">{error}</p>
                                    )}
                                </div>
                            )}

                            {step === "scanning" && (
                                <div className="flex flex-col items-center gap-4 py-12">
                                    {imagePreview && (
                                        <div className="relative w-full max-w-sm aspect-[3/4] rounded-lg overflow-hidden">
                                            <Image
                                                src={imagePreview}
                                                alt="Menu photo"
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-text/60">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Scanning menu...</span>
                                    </div>
                                </div>
                            )}

                            {step === "review" && (
                                <div className="space-y-4">
                                    {duplicates.length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                                                <AlertTriangle className="w-4 h-4" />
                                                {duplicates.length} duplicate{duplicates.length === 1 ? "" : "s"} skipped
                                            </div>
                                            <p className="text-xs text-amber-600 mt-1">
                                                {duplicates.slice(0, 3).join(", ")}
                                                {duplicates.length > 3 && ` and ${duplicates.length - 3} more`}
                                            </p>
                                        </div>
                                    )}

                                    {extractedItems.length === 0 ? (
                                        <p className="text-center text-text/50 py-8">
                                            No new items found. Try a different photo.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="text-sm text-text/60">
                                                Review {extractedItems.length} extracted item{extractedItems.length === 1 ? "" : "s"}. Remove or edit before saving.
                                            </p>
                                            <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                                                {extractedItems.map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-start gap-3 p-3 bg-tertiary/30 rounded-lg border border-text/5"
                                                    >
                                                        <div className="flex-1 space-y-2">
                                                            <input
                                                                type="text"
                                                                value={item.name}
                                                                onChange={(e) => handleEditItem(idx, "name", e.target.value)}
                                                                className="w-full font-semibold bg-transparent border-b border-text/10 focus:border-primary outline-none pb-1"
                                                            />
                                                            <div className="flex gap-2">
                                                                <select
                                                                    value={item.category}
                                                                    onChange={(e) => handleEditItem(idx, "category", e.target.value)}
                                                                    className="text-xs bg-background border border-text/10 rounded px-2 py-1"
                                                                >
                                                                    {MENU_CATEGORIES.map((cat) => (
                                                                        <option key={cat} value={cat}>{cat}</option>
                                                                    ))}
                                                                </select>
                                                                <input
                                                                    type="number"
                                                                    value={item.price}
                                                                    onChange={(e) => handleEditItem(idx, "price", parseFloat(e.target.value) || 0)}
                                                                    className="w-24 text-xs bg-background border border-text/10 rounded px-2 py-1"
                                                                    min="0"
                                                                    step="1"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="p-1.5 text-text/30 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {step === "saving" && (
                                <div className="flex flex-col items-center gap-4 py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <p className="text-text/60">Saving menu items...</p>
                                </div>
                            )}

                            {step === "done" && (
                                <div className="flex flex-col items-center justify-center py-12 gap-4">
                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Check className="w-8 h-8 text-primary" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-semibold">
                                            {savedCount} item{savedCount === 1 ? "" : "s"} added!
                                        </h3>
                                        <p className="text-text/60 text-sm mt-1">
                                            Menu items have been added to {cafeName}
                                        </p>
                                        <a
                                            href={`/cafes/${cafeSlug}/menu`}
                                            className="inline-block mt-3 text-sm text-primary hover:underline"
                                        >
                                            View menu →
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {step === "review" && (
                            <div className="p-4 border-t border-text/10 flex gap-3">
                                <button
                                    onClick={handleClose}
                                    className="flex-1 px-4 py-2.5 bg-text/10 hover:bg-text/20 text-text rounded-lg font-medium transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={extractedItems.length === 0}
                                    className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    Save {extractedItems.length} item{extractedItems.length === 1 ? "" : "s"}
                                </button>
                            </div>
                        )}

                        {step === "done" && (
                            <div className="p-4 border-t border-text/10">
                                <button
                                    onClick={handleClose}
                                    className="w-full px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
```

**Step 2: Commit**

```bash
git add components/suggestions/MenuOcrScanModal.tsx
git commit -m "feat: add OCR scan modal with review and edit UI"
```

### Task 1.5: Create MenuOcrScanButton and integrate into cafe pages

**Files:**
- Create: `components/suggestions/MenuOcrScanButton.tsx`
- Modify: `components/cafe/CafeDetails.tsx` (add OCR button near menu section)
- Modify: `components/menu/MenuContent.tsx` (add OCR button)
- Modify: `components/cafe-editor/MenuSection.tsx` (add OCR button for owners)

**Step 1: Create the button component**

```tsx
// components/suggestions/MenuOcrScanButton.tsx
"use client"

import { useState } from "react"
import { ScanLine } from "lucide-react"
import { useAuth } from "@/components/layout/AuthProvider"
import dynamic from "next/dynamic"

const MenuOcrScanModal = dynamic(() => import("./MenuOcrScanModal"), { ssr: false })

interface MenuOcrScanButtonProps {
    cafeId: string
    cafeName: string
    cafeSlug: string
    variant?: "default" | "compact"
}

export default function MenuOcrScanButton({
    cafeId,
    cafeName,
    cafeSlug,
    variant = "default",
}: MenuOcrScanButtonProps) {
    const { user } = useAuth()
    const [isModalOpen, setIsModalOpen] = useState(false)

    if (!user) return null

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className={`flex items-center gap-2 transition-colors cursor-pointer ${
                    variant === "compact"
                        ? "text-sm text-text/50 hover:text-primary"
                        : "px-3 py-1.5 text-sm font-medium text-text/60 hover:text-primary hover:bg-primary/10 rounded-lg"
                }`}
            >
                <ScanLine className="w-3.5 h-3.5" />
                <span>Scan Menu</span>
            </button>

            <MenuOcrScanModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                cafeId={cafeId}
                cafeName={cafeName}
                cafeSlug={cafeSlug}
            />
        </>
    )
}
```

**Step 2: Add to CafeDetails menu section (near SuggestMenuItemButton)**

In `components/cafe/CafeDetails.tsx`, add `MenuOcrScanButton` next to `SuggestMenuItemButton` in both mobile and desktop menu sections. The button appears for logged-in users alongside the existing "Log an Item" button.

**Step 3: Add to MenuContent (full menu page)**

In `components/menu/MenuContent.tsx`, accept `cafeId` and `cafeSlug` props and render `MenuOcrScanButton` alongside the compare button header.

**Step 4: Add to MenuSection (owner/admin editor)**

In `components/cafe-editor/MenuSection.tsx`, add `MenuOcrScanButton` next to the existing "+ Add Item" button.

**Step 5: Update MenuContent props in menu page**

In `app/cafes/[slug]/menu/page.tsx`, pass `cafeId={cafe.id}` and `cafeSlug={cafe.slug}` to `MenuContent`.

**Step 6: Commit**

```bash
git add components/suggestions/MenuOcrScanButton.tsx components/cafe/CafeDetails.tsx components/menu/MenuContent.tsx components/cafe-editor/MenuSection.tsx app/cafes/\\[slug\\]/menu/page.tsx
git commit -m "feat: integrate OCR scan button into cafe detail, menu, and editor views"
```

---

## Feature 2: Global Search - Link to Cafe + Nearest Sorting

### Context

Two issues with global search menu items:
1. Menu item results link to `/cafes/${slug}/menu` but should link to `/cafes/${slug}` (the cafe page) since the user wants to see the cafe, not just the menu.
2. When user location is available, menu item results should be sorted by nearest cafe distance.

### Task 2.1: Change menu item search result href to cafe page

**Files:**
- Modify: `app/api/actions/search.ts:205-213`

**Step 1: Update the href in `searchMenuItems`**

Change:
```typescript
href: `/cafes/${item.cafeSlug}/menu`,
```
To:
```typescript
href: `/cafes/${item.cafeSlug}`,
```

**Step 2: Run lint**

Run: `bun lint`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/actions/search.ts
git commit -m "fix: link global search menu items to cafe page instead of menu page"
```

### Task 2.2: Add nearest-cafe sorting to menu item search

**Files:**
- Modify: `app/api/actions/search.ts:182-214` (update `searchMenuItems` to accept optional lat/lng)
- Modify: `app/api/actions/search.ts:216-268` (update `globalSearch` to accept optional lat/lng)
- Modify: `utils/hooks/useSearch.ts` (pass user location to search)
- Modify: `components/search/SearchModal.tsx` (get user location)

**Step 1: Update `searchMenuItems` to support distance sorting**

```typescript
// app/api/actions/search.ts

// Add haversine calculation helper for sorting
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function searchMenuItems(
    query: string,
    userLat?: number,
    userLng?: number
): Promise<SearchResult[]> {
    if (!query || query.length < 2) return []

    const items = await db
        .select({
            id: cafeMenuItems.id,
            name: cafeMenuItems.name,
            category: cafeMenuItems.category,
            price: cafeMenuItems.price,
            cafeName: cafes.name,
            cafeSlug: cafes.slug,
            cafeLat: cafes.lat,
            cafeLng: cafes.lng,
        })
        .from(cafeMenuItems)
        .innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
        .where(
            and(
                ilike(cafeMenuItems.name, `%${query}%`),
                eq(cafeMenuItems.isAvailable, true),
                eq(cafes.isPublished, true)
            )
        )
        .limit(5) // Slightly higher limit to allow distance-based re-ranking

    // Sort by distance if user location is available
    let sorted = items
    if (userLat != null && userLng != null) {
        sorted = [...items].sort((a, b) => {
            if (a.cafeLat == null || a.cafeLng == null) return 1
            if (b.cafeLat == null || b.cafeLng == null) return -1
            return (
                haversineDistance(userLat, userLng, a.cafeLat, a.cafeLng) -
                haversineDistance(userLat, userLng, b.cafeLat, b.cafeLng)
            )
        })
    }

    return sorted.slice(0, 3).map((item) => ({
        id: item.id,
        type: "menu-item" as const,
        title: item.name,
        subtitle: `${item.cafeName} · ${item.category} · ₱${item.price.toFixed(2)}`,
        href: `/cafes/${item.cafeSlug}`,
        priority: 60,
        keywords: [item.name, item.category, item.cafeName],
    }))
}
```

**Step 2: Update `globalSearch` to accept and pass location**

Update the function signature:

```typescript
export async function globalSearch(
    query: string,
    userLat?: number,
    userLng?: number
): Promise<SearchResult[]> {
```

Update the `#` prefix branch:
```typescript
if (trimmedQuery.startsWith('#')) {
    const menuQuery = trimmedQuery.slice(1).trim()
    if (menuQuery.length >= 2) {
        const menuResults = await searchMenuItems(menuQuery, userLat, userLng)
        return menuResults.map(r => ({ ...r, priority: 1 }))
    }
    return []
}
```

Update the default parallel search:
```typescript
const [, , , , , menuItemResults] = await Promise.all([
    searchCafesAndUsers(trimmedQuery),
    searchBlogs(trimmedQuery),
    searchCrawls(trimmedQuery),
    searchCollections(trimmedQuery),
    searchEvents(trimmedQuery),
    searchMenuItems(trimmedQuery, userLat, userLng),
])
```

**Step 3: Update `useSearch` hook to pass location**

```typescript
// utils/hooks/useSearch.ts
import { useUserLocation } from "@/hooks/useUserLocation"

export function useSearch(debounceMs = 150) {
    const { lat, lng } = useUserLocation()
    // ... existing state ...

    useEffect(() => {
        // ... existing debounce logic ...
        const performSearch = async () => {
            // Pass lat/lng to globalSearch
            const results = await globalSearch(query, lat ?? undefined, lng ?? undefined)
            // ...
        }
        // ...
    }, [query, lat, lng]) // Add lat/lng to deps
}
```

**Step 4: Commit**

```bash
git add app/api/actions/search.ts utils/hooks/useSearch.ts
git commit -m "feat: sort global search menu items by nearest cafe when location available"
```

### Task 2.3: Verify search behavior end-to-end

**Step 1: Manual test**
1. Open the app, grant location permission
2. Open global search (Cmd+K)
3. Search for a menu item (e.g., "latte")
4. Verify the result links to `/cafes/{slug}` (not `/cafes/{slug}/menu`)
5. Verify results are sorted by nearest cafe

**Step 2: Run lint**

Run: `bun lint`
Expected: PASS

**Step 3: Commit (no changes needed if passing)**

---

## Feature 3: Community Edit Suggestions for Menu Items

### Context

The `menuItemSuggestions` table and server actions already support `"edit"` type suggestions. The `SuggestMenuItemModal` supports `mode="edit"` with `existingItem` prop. However, there is NO UI in the menu display components that lets community users trigger an edit suggestion on an existing menu item. This feature wires it up.

### Task 3.1: Add "Suggest Edit" button to menu item cards in MenuContent

**Files:**
- Modify: `components/menu/MenuContent.tsx:264-346` (add suggest edit button per item)
- Modify: `app/cafes/[slug]/menu/page.tsx:115-158` (pass cafeId/cafeName to MenuContent)

**Step 1: Update MenuContent props**

```typescript
interface MenuContentProps {
    menuItems: MenuItem[]
    categories: string[]
    cafeId: string
    cafeName: string
}
```

**Step 2: Add suggest edit state and import**

```typescript
import { useState, useCallback, useMemo } from "react"
import { Pencil } from "lucide-react"
import dynamic from "next/dynamic"

const SuggestMenuItemModal = dynamic(
    () => import("@/components/suggestions/SuggestMenuItemModal"),
    { ssr: false }
)

// Inside the component:
const [editTarget, setEditTarget] = useState<MenuItem | null>(null)
```

**Step 3: Add suggest edit button to each menu item card**

In the `renderMenuItem` function, after the community indicator and before the compare button, add:

```typescript
{/* Suggest edit button - bottom right */}
<button
    onClick={() => setEditTarget(item)}
    className="absolute bottom-2 right-2 z-10 p-1.5 rounded-full bg-background/80 text-text/40 hover:text-primary hover:bg-background transition-all cursor-pointer opacity-0 group-hover:opacity-100"
    title="Suggest an edit"
>
    <Pencil className="w-3 h-3" />
</button>
```

Also wrap the card in `group` class for hover effect:
```typescript
<div
    key={item.id}
    className="relative p-3 flex flex-col min-h-[180px] group"
>
```

**Step 4: Render the SuggestMenuItemModal at bottom of component**

```typescript
{/* Suggest Edit Modal */}
{editTarget && (
    <SuggestMenuItemModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        cafeId={cafeId}
        cafeName={cafeName}
        mode="edit"
        existingItem={{
            id: editTarget.id,
            name: editTarget.name,
            category: editTarget.category,
            price: editTarget.price,
            description: editTarget.description,
        }}
    />
)}
```

**Step 5: Update menu page to pass cafeId/cafeName**

In `app/cafes/[slug]/menu/page.tsx`:
```typescript
<MenuContent
    menuItems={...}
    categories={categories}
    cafeId={cafe.id}
    cafeName={cafe.name}
/>
```

**Step 6: Commit**

```bash
git add components/menu/MenuContent.tsx app/cafes/\\[slug\\]/menu/page.tsx
git commit -m "feat: add suggest edit button to menu item cards on full menu page"
```

### Task 3.2: Add "Suggest Edit" to cafe detail page menu items

**Files:**
- Modify: `components/cafe/CafeDetails.tsx:439-486` (mobile menu items)
- Modify: `components/cafe/CafeDetails.tsx:905-952` (desktop menu items)

**Step 1: Add edit state to CafeDetails**

```typescript
const [editTargetItem, setEditTargetItem] = useState<CafeMenuItem | null>(null)
```

**Step 2: Add suggest edit button to mobile menu items**

After the price and compare button in each menu item row, add a small pencil button:

```typescript
<button
    onClick={() => setEditTargetItem(item)}
    className="p-1 rounded-full text-text/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
    title="Suggest an edit"
>
    <Pencil className="w-3 h-3" />
</button>
```

**Step 3: Same for desktop menu items**

Add the same pencil button in the desktop menu section.

**Step 4: Render SuggestMenuItemModal**

At the bottom of the component (near the existing `MenuComparisonModal`):

```typescript
{editTargetItem && (
    <SuggestMenuItemModal
        isOpen={!!editTargetItem}
        onClose={() => setEditTargetItem(null)}
        cafeId={cafe.id}
        cafeName={cafe.name}
        mode="edit"
        existingItem={{
            id: editTargetItem.id,
            name: editTargetItem.name,
            category: editTargetItem.category,
            price: editTargetItem.price,
            description: editTargetItem.description,
        }}
    />
)}
```

**Step 5: Run lint**

Run: `bun lint`
Expected: PASS

**Step 6: Commit**

```bash
git add components/cafe/CafeDetails.tsx
git commit -m "feat: add suggest edit button to menu items on cafe detail page"
```

### Task 3.3: Update SuggestMenuItemModal to populate all fields for edit mode

**Files:**
- Modify: `components/suggestions/SuggestMenuItemModal.tsx:51-75`

**Step 1: Populate all fields when editing**

The current edit mode only populates name, category, price, description. Update to populate all fields:

```typescript
useEffect(() => {
    if (isOpen) {
        if (existingItem && mode === "edit") {
            setName(existingItem.name)
            setCategory(existingItem.category)
            setPrice(existingItem.price.toString())
            setDescription(existingItem.description || "")
            // Populate type/dietary fields if available from the item
            setIsFood(existingItem.is_food ?? false)
            setIsHot(existingItem.is_hot ?? false)
            setIsCold(existingItem.is_cold ?? false)
            setIsVegan(existingItem.is_vegan ?? false)
            setIsVegetarian(existingItem.is_vegetarian ?? false)
            setCalories(existingItem.calories?.toString() ?? "")
            setSizeOptions(existingItem.size_options ?? [])
        } else {
            setName("")
            setCategory(MENU_CATEGORIES[0])
            setPrice("")
            setDescription("")
        }
        // ... reset remaining fields
    }
}, [isOpen, existingItem, mode])
```

**Step 2: Update existingItem prop type to include all fields**

```typescript
existingItem?: {
    id: string
    name: string
    category: string
    price: number
    description: string | null
    is_food?: boolean
    is_hot?: boolean
    is_cold?: boolean
    is_vegan?: boolean
    is_vegetarian?: boolean
    calories?: number | null
    size_options?: Array<{ label: string; price: number }> | null
}
```

**Step 3: Pass full item data from CafeDetails and MenuContent**

Update the callers to pass all available fields:

```typescript
existingItem={{
    id: editTargetItem.id,
    name: editTargetItem.name,
    category: editTargetItem.category,
    price: editTargetItem.price,
    description: editTargetItem.description,
    is_food: editTargetItem.is_food,
    is_hot: editTargetItem.is_hot,
    is_cold: editTargetItem.is_cold,
    is_vegan: editTargetItem.is_vegan,
    is_vegetarian: editTargetItem.is_vegetarian,
    calories: editTargetItem.calories,
    size_options: editTargetItem.size_options,
}}
```

**Step 4: Commit**

```bash
git add components/suggestions/SuggestMenuItemModal.tsx components/cafe/CafeDetails.tsx components/menu/MenuContent.tsx
git commit -m "feat: populate all fields in edit suggestion modal for better UX"
```

---

## Additional Improvements & Observations

### Improvement 1: Fix broken `near_me` filter on cafes page

**Issue:** The `near_me` toggle in `CafesPageClient.tsx` is a UI-only feature that does NOT actually sort/filter by distance. It's explicitly excluded from server params.

**Files:**
- Modify: `components/cafe/CafesPageClient.tsx:69-92` (add near_me to filter params)
- Modify: `app/api/actions/cafe.ts:540-756` (handle near_me sort with Haversine)
- Modify: `utils/types/extra.ts:116-140` (add "nearest" to sortBy options)

**Approach:**
1. Add `"nearest"` as a sort option in `CafeFilters.sortBy`
2. Pass user `lat`/`lng` as filter params when `near_me` is enabled
3. In `getAllCafes()`, when `sortBy === "nearest"` and lat/lng present, use SQL Haversine distance for ORDER BY (same pattern as `nearby.ts`)
4. This makes the existing near_me toggle functional

### Improvement 2: Show community edit suggestions count on menu items

**Issue:** Cafe owners/admins see pending suggestion count for the cafe but not per-item. Showing which items have pending suggestions helps triage.

**Files:**
- Modify: `components/cafe-editor/MenuSection.tsx` (show badge on items with pending edits)

**Approach:**
1. Fetch pending suggestions for the cafe (already done via `getPendingMenuItemSuggestionsCount`)
2. For items with pending edit suggestions, show a subtle badge like "1 pending edit"
3. This helps owners know which items need attention

### Improvement 3: Rate limit OCR scanning

**Issue:** OCR calls the vision API which costs money. No rate limiting exists.

**Files:**
- Modify: `app/api/actions/menu-ocr.ts` (add simple rate limit)

**Approach:**
1. Check if user has scanned too many images recently (e.g., 5 per hour)
2. Use a simple DB check: count recent OCR scans in system logs
3. Return friendly error if rate limit exceeded

### Improvement 4: Allow OCR from cafe editor (owner/admin)

**Issue:** The OCR scan button should also appear in the cafe editor for owners, not just the public menu page.

**Files:**
- Modify: `components/cafe-editor/MenuSection.tsx`

**Approach:**
1. Add `MenuOcrScanButton` next to the "+ Add Item" button
2. After OCR scan completes, refresh the menu items list via `useMenuItems` hook

### Improvement 5: Cache OCR model selection

**Issue:** `getOcrModel()` reads env var on every call. Minor but worth caching.

**Approach:** Already handled by Next.js server-side module caching. No change needed.

---

## Verification Checklist

After implementing all tasks:

1. **OCR Flow:**
   - [ ] Upload menu photo as community user → items extracted → duplicates removed → review → save
   - [ ] Upload menu photo as admin → same flow, items saved with `communitySubmitted: true`
   - [ ] Upload menu photo as owner → same flow
   - [ ] OCR model configurable via `OPENAI_COMPATIBLE_OCR_MODEL` env var
   - [ ] Graceful error when vision API unavailable

2. **Global Search:**
   - [ ] Menu item search results link to `/cafes/{slug}` (not `/cafes/{slug}/menu`)
   - [ ] With location permission: menu items sorted by nearest cafe
   - [ ] Without location: default sorting (as before)
   - [ ] `#` prefix search still works with location-aware sorting

3. **Community Edit Suggestions:**
   - [ ] Menu items on `/cafes/{slug}/menu` show pencil icon on hover → opens edit modal
   - [ ] Menu items on cafe detail page (mobile + desktop) show pencil icon → opens edit modal
   - [ ] Edit modal pre-fills all item fields (name, category, price, type flags, etc.)
   - [ ] Submitted edit suggestions appear in admin suggestion review queue
   - [ ] Admin can approve/reject edit suggestions

4. **Run all checks:**
   ```bash
   bun lint
   bun test
   bun build
   ```

---

## Summary of Files Changed

### New Files
- `utils/ai/menu-ocr.ts` - OCR extraction utility
- `utils/ai/__tests__/menu-ocr.test.ts` - OCR utility tests
- `app/api/actions/menu-ocr.ts` - OCR server action with deduplication
- `app/api/actions/__tests__/menu-ocr.test.ts` - Deduplication tests
- `components/suggestions/MenuOcrScanModal.tsx` - OCR scan modal UI
- `components/suggestions/MenuOcrScanButton.tsx` - OCR scan trigger button

### Modified Files
- `.env.example` - Add `OPENAI_COMPATIBLE_OCR_MODEL`
- `app/api/actions/search.ts` - Menu items link to cafe page, nearest sorting
- `utils/hooks/useSearch.ts` - Pass user location to search
- `components/cafe/CafeDetails.tsx` - OCR button + suggest edit button
- `components/menu/MenuContent.tsx` - OCR button + suggest edit button + props
- `app/cafes/[slug]/menu/page.tsx` - Pass cafeId/cafeName to MenuContent
- `components/suggestions/SuggestMenuItemModal.tsx` - Populate all fields in edit mode
- `components/cafe-editor/MenuSection.tsx` - OCR button for owners
