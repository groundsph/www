# Blog Slug Date & Excerpt Model Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update blog post slug generation to append creation date (YYYY-MM-DD format) and disable model selection for excerpt generation to use the env var `OPENAI_COMPATIBLE_EXCERPT_MODEL`.

**Architecture:** 
1. Modify `generateSlug` function to accept an optional date parameter (defaults to current date)
2. Remove model selector UI components from both blog editors
3. Update `generateExcerptAction` to read model from environment variable instead of client parameter
4. Keep existing manual slug edit capability for admins

**Tech Stack:** TypeScript, React, Next.js, Drizzle ORM

---

## Task 1: Update generateSlug function

**Files:**
- Modify: `utils/types/blog.ts:108-114`
- Test: `utils/types/__tests__/blog.test.ts` (new file)

**Step 1: Create failing test for generateSlug with date**

Create `utils/types/__tests__/blog.test.ts`:

```typescript
import { describe, it, expect } from "bun:test"
import { generateSlug, estimateReadingTime } from "../blog"

describe("generateSlug", () => {
    describe("existing behavior (backwards compatibility)", () => {
        it("generates slug from title without date when no date provided", () => {
            expect(generateSlug("My Blog Post Title")).toBe("my-blog-post-title")
        })

        it("handles special characters and spaces", () => {
            expect(generateSlug("Hello World! How are you?")).toBe("hello-world-how-are-you")
        })

        it("truncates long titles to 100 characters", () => {
            const longTitle = "a".repeat(150)
            const result = generateSlug(longTitle)
            expect(result.length).toBe(100)
            expect(result).toBe("a".repeat(100))
        })

        it("removes leading and trailing hyphens", () => {
            expect(generateSlug("---test-slug---")).toBe("test-slug")
        })

        it("handles empty strings", () => {
            expect(generateSlug("")).toBe("")
        })
    })

    describe("with date appended", () => {
        it("appends date in YYYY-MM-DD format", () => {
            const result = generateSlug("My Post", "2026-03-31")
            expect(result).toBe("my-post-2026-03-31")
        })

        it("handles date with existing hyphens in title", () => {
            const result = generateSlug("my-post-title", "2026-03-31")
            expect(result).toBe("my-post-title-2026-03-31")
        })

        it("truncates title portion to leave room for date (10 chars)", () => {
            const longTitle = "a".repeat(150)
            const result = generateSlug(longTitle, "2026-03-31")
            // Title portion: 89 chars (100 - 11 for "-YYYY-MM-DD")
            // Total: 89 + 1 + 10 = 100 chars
            expect(result.length).toBe(100)
            expect(result.endsWith("-2026-03-31")).toBe(true)
        })

        it("uses current date when date parameter is true", () => {
            const result = generateSlug("Test Post", true)
            const datePattern = /-\d{4}-\d{2}-\d{2}$/
            expect(datePattern.test(result)).toBe(true)
        })

        it("defaults to current date for new posts (undefined date)", () => {
            const result = generateSlug("New Post")
            const datePattern = /-\d{4}-\d{2}-\d{2}$/
            expect(datePattern.test(result)).toBe(true)
        })
    })
})

describe("estimateReadingTime", () => {
    it("calculates reading time based on 200 words per minute", () => {
        expect(estimateReadingTime("word ".repeat(200))).toBe(1)
        expect(estimateReadingTime("word ".repeat(400))).toBe(2)
    })

    it("returns minimum of 1 minute", () => {
        expect(estimateReadingTime("")).toBe(1)
        expect(estimateReadingTime("short")).toBe(1)
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/types/__tests__/blog.test.ts`
Expected: FAIL - `generateSlug` does not accept date parameter or append dates

**Step 3: Implement updated generateSlug function**

Update `utils/types/blog.ts:107-114`:

```typescript
// Helper to generate slug from title
export function generateSlug(title: string, date?: string | true): string {
    const today = date === true || date === undefined
        ? new Date().toISOString().split("T")[0]
        : date

    if (!title.trim()) {
        return date ? `${today}` : ""
    }

    const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")

    if (!today) {
        // No date - return original behavior (truncated to 100)
        return baseSlug.substring(0, 100)
    }

    // With date: truncate title portion to leave room for "-YYYY-MM-DD" (11 chars)
    const dateSuffix = `-${today}`
    const maxTitleLength = 100 - dateSuffix.length

    // Ensure we don't end with a hyphen before the date
    let titlePortion = baseSlug.substring(0, maxTitleLength).replace(/-+$/, "")

    return titlePortion + dateSuffix
}
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/types/__tests__/blog.test.ts`
Expected: PASS all tests

**Step 5: Commit**

```bash
git add utils/types/blog.ts utils/types/__tests__/blog.test.ts
git commit -m "feat(blog): add date suffix to auto-generated slugs"
```

---

## Task 2: Update generateExcerptAction to use env var

**Files:**
- Modify: `app/api/actions/ai.ts:30-59`
- Modify: `utils/ai/__tests__/openai-compatible.test.ts` (add test for new getExcerptModel helper)

**Step 1: Add failing test for getExcerptModel helper**

Add to `utils/ai/__tests__/openai-compatible.test.ts`:

```typescript
describe("getExcerptModel", () => {
    let originalEnv: { [key: string]: string | undefined }

    beforeEach(() => {
        originalEnv = {
            OPENAI_COMPATIBLE_EXCERPT_MODEL: process.env.OPENAI_COMPATIBLE_EXCERPT_MODEL,
        }
    })

    afterEach(() => {
        Object.assign(process.env, originalEnv)
    })

    it("returns configured model from environment", async () => {
        process.env.OPENAI_COMPATIBLE_EXCERPT_MODEL = "gpt-4-turbo"
        
        const { getExcerptModel } = await import("@/utils/ai/openai-compatible")
        
        expect(getExcerptModel()).toBe("gpt-4-turbo")
    })

    it("returns default model when env var is not set", async () => {
        delete process.env.OPENAI_COMPATIBLE_EXCERPT_MODEL
        
        const { getExcerptModel } = await import("@/utils/ai/openai-compatible")
        
        expect(getExcerptModel()).toBe("gpt-4o-mini")
    })

    it("returns configured model when set to custom model", async () => {
        process.env.OPENAI_COMPATIBLE_EXCERPT_MODEL = "custom-model-v2"
        
        const { getExcerptModel } = await import("@/utils/ai/openai-compatible")
        
        expect(getExcerptModel()).toBe("custom-model-v2")
    })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test utils/ai/__tests__/openai-compatible.test.ts`
Expected: FAIL - `getExcerptModel` does not exist

**Step 3: Add getExcerptModel helper and update generateExcerpt to use default model**

Add to `utils/ai/openai-compatible.ts` after line 204 (after `getChatModel`):

```typescript
const DEFAULT_EXCERPT_MODEL = "gpt-4o-mini"

export function getExcerptModel(): string {
    return process.env.OPENAI_COMPATIBLE_EXCERPT_MODEL ?? DEFAULT_EXCERPT_MODEL
}
```

Update `generateExcerpt` signature (line 58-61) to make model optional:

```typescript
export async function generateExcerpt(
    content: string,
    model?: string,
): Promise<string> {
    const { baseUrl, apiKey } = getConfig()
    if (!baseUrl || !apiKey) {
        throw new Error("Missing OPENAI_COMPATIBLE_BASE_URL or OPENAI_COMPATIBLE_API_KEY")
    }

    const effectiveModel = model ?? getExcerptModel()
    
    // ... rest of function, use effectiveModel instead of model
```

Update the API call inside `generateExcerpt` (line 75):
```typescript
        body: JSON.stringify({
            model: effectiveModel,
            // ...rest
```

**Step 4: Run test to verify it passes**

Run: `bun test utils/ai/__tests__/openai-compatible.test.ts`
Expected: PASS all tests including new `getExcerptModel` tests

**Step 5: Update generateExcerptAction to remove model parameter**

Update `app/api/actions/ai.ts:30-59`:

```typescript
export async function generateExcerptAction(
    content: string
): Promise<ActionResponse> {
    try {
        if (!content || content.length < 50) {
            return {
                success: false,
                error: "Content is too short to generate an excerpt. Please write at least 50 characters.",
            };
        }

        const model = process.env.OPENAI_COMPATIBLE_EXCERPT_MODEL ?? "gpt-4o-mini";
        const excerpt = await generateExcerpt(content, model);

        return { success: true, excerpt };
    } catch (error) {
        console.error("Generate excerpt action error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate excerpt",
        };
    }
}
```

Update `listModelsAction` to remove defaultModel from return (line 11-28):

```typescript
export async function listModelsAction(): Promise<{
    success: boolean;
    models?: string[];
    error?: string;
}> {
    try {
        const models = await listModels();
        return { success: true, models };
    } catch (error) {
        console.error("List models action error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to list models",
        };
    }
}
```

**Step 6: Commit**

```bash
git add app/api/actions/ai.ts utils/ai/openai-compatible.ts utils/ai/__tests__/openai-compatible.test.ts
git commit -m "feat(ai): use env var for excerpt model, remove client model selection"
```

---

## Task 3: Update BlogEditor component

**Files:**
- Modify: `components/blog/BlogEditor.tsx`

**Step 1: Remove model selector state and imports**

Remove from imports (line 35):
```typescript
// REMOVE: import { generateExcerptAction, listModelsAction } from "@/app/api/actions/ai"
// REPLACE WITH:
import { generateExcerptAction } from "@/app/api/actions/ai"
```

Remove unused Lucide icons (line 18):
```typescript
// REMOVE: RefreshCw (used for retry button)
```

Remove state variables (lines 93-96):
```typescript
// REMOVE these state variables:
// const [availableModels, setAvailableModels] = useState<string[]>([])
// const [selectedModel, setSelectedModel] = useState<string>("")
// const [isLoadingModels, setIsLoadingModels] = useState(true)
// const [modelLoadError, setModelLoadError] = useState<string | null>(null)
```

**Step 2: Remove useEffect for loading models**

Remove lines 109-169 (the entire `loadModels` useCallback and useEffect).

**Step 3: Update handleTitleChange to use date**

Update line 198-203:

```typescript
const handleTitleChange = (value: string) => {
    setTitle(value)
    if (autoSlug) {
        setSlug(generateSlug(value, true)) // Add true for date
    }
}
```

**Step 4: Update generate excerpt click handler**

Update lines 571-674 (the excerpt generation button and its click handler):

Replace the entire excerpt button section with:

```typescript
                        <div className='flex items-center justify-end gap-2 mt-2'>
                            <button
                                onClick={async () => {
                                    // Guard: content length check
                                    if (content.length < MIN_CONTENT_FOR_EXCERPT) {
                                        addNotification(
                                            `Please write at least ${MIN_CONTENT_FOR_EXCERPT} characters before generating an excerpt.`,
                                            "error",
                                            { title: "Content Too Short" }
                                        )
                                        return
                                    }

                                    // Guard: cooldown check
                                    if (lastGenerateTime && Date.now() - lastGenerateTime < AI_COOLDOWN_MS) {
                                        const remainingSeconds = Math.ceil(
                                            (AI_COOLDOWN_MS - (Date.now() - lastGenerateTime)) / 1000
                                        )
                                        addNotification(
                                            `Please wait ${remainingSeconds} seconds before generating again.`,
                                            "warning",
                                            { title: "Cooldown Active" }
                                        )
                                        return
                                    }

                                    // Limit content length for excerpt generation
                                    let contentToUse = content
                                    if (content.length > MAX_CONTENT_FOR_EXCERPT) {
                                        contentToUse = content.slice(0, MAX_CONTENT_FOR_EXCERPT)
                                        addNotification(
                                            `Using first ${MAX_CONTENT_FOR_EXCERPT.toLocaleString()} characters for excerpt generation.`,
                                            "warning",
                                            { title: "Content Truncated" }
                                        )
                                    }

                                    setIsGeneratingExcerpt(true)

                                    try {
                                        const res = await generateExcerptAction(contentToUse)
                                        if (res.success && res.excerpt) {
                                            setExcerpt(res.excerpt)
                                            setLastGenerateTime(Date.now())
                                            addNotification("Excerpt generated successfully!", "success", {
                                                title: "AI Generated",
                                                duration: 3000,
                                            })
                                        } else {
                                            addNotification(
                                                res.error || "Failed to generate excerpt",
                                                "error",
                                                { title: "Generation Failed" }
                                            )
                                        }
                                    } catch (err) {
                                        console.error(err)
                                        addNotification("Failed to generate excerpt", "error", {
                                            title: "Generation Failed",
                                        })
                                    } finally {
                                        setIsGeneratingExcerpt(false)
                                    }
                                }}
                                disabled={
                                    isGeneratingExcerpt || 
                                    content.length < MIN_CONTENT_FOR_EXCERPT ||
                                    cooldownRemaining > 0
                                }
                                className='flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-primary to-primary/80 rounded-lg hover:shadow-md hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all active:scale-95'
                                title={
                                    content.length < MIN_CONTENT_FOR_EXCERPT
                                        ? `Need at least ${MIN_CONTENT_FOR_EXCERPT} characters`
                                        : cooldownRemaining > 0
                                            ? `Wait ${cooldownRemaining}s`
                                            : "Generate excerpt with AI"
                                }
                            >
                                {isGeneratingExcerpt ? (
                                    <>
                                        <Loader2 className='w-3 h-3 animate-spin' />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className='w-3 h-3' />
                                        {cooldownRemaining > 0
                                            ? `Wait ${cooldownRemaining}s`
                                            : "Generate with AI"}
                                    </>
                                )}
                            </button>
                        </div>
```

**Step 5: Remove constant definitions for model retry**

Remove lines 46-47:
```typescript
// REMOVE:
// const MODEL_RETRY_DELAYS = [500, 1000, 2000] // 0.5s, 1s, 2s
// const MAX_MODEL_RETRIES = 3
```

**Step 6: Commit**

```bash
git add components/blog/BlogEditor.tsx
git commit -m "feat(blog-editor): remove model selector, use env var for excerpt generation"
```

---

## Task 4: Update CommunityBlogEditor component

**Files:**
- Modify: `components/blog/CommunityBlogEditor.tsx`

**Step 1: Remove model selector imports and state**

Remove from imports (line 17):
```typescript
// REMOVE: import { generateExcerptAction, listModelsAction } from "@/app/api/actions/ai"
// REPLACE WITH:
import { generateExcerptAction } from "@/app/api/actions/ai"
```

Remove unused Lucide icon (line 13):
```typescript
// REMOVE: RefreshCw
```

Remove state variables (lines 55-59):
```typescript
// REMOVE these state variables:
// const [availableModels, setAvailableModels] = useState<string[]>([])
// const [selectedModel, setSelectedModel] = useState<string>("")
// const [isLoadingModels, setIsLoadingModels] = useState(true)
// const [modelLoadError, setModelLoadError] = useState<string | null>(null)
```

**Step 2: Remove constants and useEffect for loading models**

Remove lines 30-31:
```typescript
// REMOVE:
// const MODEL_RETRY_DELAYS = [500, 1000, 2000]
// const MAX_MODEL_RETRIES = 3
```

Remove lines 71-137 (the entire `loadModels` useCallback and useEffect).

**Step 3: Update handleGenerateExcerpt to remove model parameter**

Update lines 254-336:

```typescript
const handleGenerateExcerpt = async () => {
    // Guard: content length check
    if (content.length < MIN_CONTENT_FOR_EXCERPT) {
        addNotification(
            `Please write at least ${MIN_CONTENT_FOR_EXCERPT} characters before generating an excerpt.`,
            "error",
            { title: "Content Too Short" }
        )
        return
    }

    // Guard: cooldown check
    if (lastGenerateTime && Date.now() - lastGenerateTime < AI_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil(
            (AI_COOLDOWN_MS - (Date.now() - lastGenerateTime)) / 1000
        )
        addNotification(
            `Please wait ${remainingSeconds} seconds before generating again.`,
            "warning",
            { title: "Cooldown Active" }
        )
        return
    }

    // Limit content length for excerpt generation
    let contentToUse = content
    if (content.length > MAX_CONTENT_FOR_EXCERPT) {
        contentToUse = content.slice(0, MAX_CONTENT_FOR_EXCERPT)
        addNotification(
            `Using first ${MAX_CONTENT_FOR_EXCERPT.toLocaleString()} characters for excerpt generation.`,
            "warning",
            { title: "Content Truncated" }
        )
    }

    setIsGeneratingExcerpt(true)

    try {
        const result = await generateExcerptAction(contentToUse)

        if (result.success && result.excerpt) {
            setExcerpt(result.excerpt)
            setLastGenerateTime(Date.now())
            addNotification("Excerpt generated successfully!", "success", {
                title: "AI Generated",
                duration: 3000,
            })
        } else {
            addNotification(
                result.error || "Failed to generate excerpt",
                "error",
                { title: "Generation Failed" }
            )
        }
    } catch (err) {
        console.error(err)
        addNotification(
            "An unexpected error occurred while generating the excerpt.",
            "error",
            { title: "Generation Failed" }
        )
    } finally {
        setIsGeneratingExcerpt(false)
    }
}
```

**Step 4: Update canGenerateExcerpt useMemo**

Update lines 405-412:

```typescript
const canGenerateExcerpt = useMemo(
    () =>
        content.length >= MIN_CONTENT_FOR_EXCERPT &&
        cooldownRemaining === 0 &&
        !isGeneratingExcerpt,
    [content.length, cooldownRemaining, isGeneratingExcerpt]
)
```

**Step 5: Remove the model selector UI**

Remove the model selector UI and retry button from the excerpt section (lines 569-645 in original). The excerpt section should now just have the textarea and a simple generate button.

Replace lines 567-677 with:

```typescript
                        {/* AI Generation */}
                        <div className='flex items-center gap-3 mt-3'>
                            <button
                                type='button'
                                onClick={handleGenerateExcerpt}
                                disabled={!canGenerateExcerpt}
                                className='flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-primary to-primary/80 rounded-lg hover:shadow-md hover:shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all active:scale-95'
                                title={
                                    content.length < MIN_CONTENT_FOR_EXCERPT
                                        ? `Need at least ${MIN_CONTENT_FOR_EXCERPT} characters`
                                        : cooldownRemaining > 0
                                            ? `Wait ${cooldownRemaining}s`
                                            : "Generate excerpt with AI"
                                }
                            >
                                {isGeneratingExcerpt ? (
                                    <>
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className='w-4 h-4' />
                                        {cooldownRemaining > 0
                                            ? `Wait ${cooldownRemaining}s`
                                            : "Generate with AI"}
                                    </>
                                )}
                            </button>
                        </div>
```

**Step 6: Remove retry timeout ref**

Remove line 41:
```typescript
// REMOVE: const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
```

And remove cleanup in useEffect (lines 132-136):
```typescript
// REMOVE the entire cleanup inside loadModels useEffect
```

**Step 7: Commit**

```bash
git add components/blog/CommunityBlogEditor.tsx
git commit -m "feat(community-blog): remove model selector, use env var for excerpts"
```

---

## Task 5: Update blog post creation to use dated slug

**Files:**
- Modify: `app/api/actions/blog.ts`

**Step 1: Find createBlogPost and update slug generation**

The `createBlogPost` function should already use `generateSlug`. Verify it passes `true` for the date parameter when creating new posts.

Check if there's a place where slug is auto-generated. If `generateSlug` is called without a date parameter, it will now default to including today's date (as per our implementation in Task 1).

Search for `generateSlug` usage in `app/api/actions/blog.ts` and ensure no changes are needed since our new implementation defaults to including the date.

**Step 2: Commit if changes needed**

```bash
git add app/api/actions/blog.ts
git commit -m "fix(blog): ensure slug generation uses date for new posts"
```

---

## Task 6: Run full test suite and verify

**Step 1: Run all tests**

Run: `bun test`

Expected: All tests pass

**Step 2: Run lint**

Run: `bun lint`

Expected: No errors

**Step 3: Manual verification**

1. Start dev server: `bun dev`
2. Navigate to blog editor
3. Verify slug auto-generates with date suffix when typing title
4. Verify manual slug toggle still works
5. Verify excerpt generation button shows and works (no model selector)
6. Check community blog editor has same behavior

---

## Task 7: Final commit and summary

**Step 1: Verify all changes are committed**

Run: `git status`

Expected: No uncommitted changes

**Step 2: Create summary of changes**

The implementation:
1. Updated `generateSlug` to append YYYY-MM-DD date to slugs by default
2. Removed model selector from BlogEditor and CommunityBlogEditor
3. Updated `generateExcerptAction` to use `OPENAI_COMPATIBLE_EXCERPT_MODEL` env var
4. Added `getExcerptModel` helper with default fallback
5. Kept manual slug editing capability for admins
6. New posts only get dated slugs; existing posts unchanged

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `utils/types/blog.ts` | Updated `generateSlug` to accept date parameter |
| `utils/types/__tests__/blog.test.ts` | New test file for slug generation |
| `utils/ai/openai-compatible.ts` | Added `getExcerptModel` helper, updated `generateExcerpt` |
| `utils/ai/__tests__/openai-compatible.test.ts` | Added tests for `getExcerptModel` |
| `app/api/actions/ai.ts` | Updated `generateExcerptAction`, simplified `listModelsAction` |
| `components/blog/BlogEditor.tsx` | Removed model selector UI and state |
| `components/blog/CommunityBlogEditor.tsx` | Removed model selector UI and state |