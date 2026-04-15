# Blog Editor & Viewer Revamp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the blog editor UI across all contexts (admin, community, profile), fix table/content rendering mismatches, add draft preview functionality, add admin cafe image download, and fix bugs.

**Architecture:** Redesign RichBlogEditor from a sidebar-based layout to a full-width responsive layout where all controls are inline/contextual. Create a shared style system between editor and viewer. Add a draft preview route with visual draft indicators. Fix table serialization round-trips.

**Tech Stack:** Next.js App Router, TipTap editor, react-markdown + remark-gfm, Tailwind CSS v4, Drizzle ORM, motion/react

---

## Phase 1: Blog Editor UI Redesign

### Task 1.1: Create Unified BlogEditorLayout Component

**Purpose:** Replace the current `grid lg:grid-cols-3` sidebar layout with a full-screen responsive layout that works identically in all contexts (admin modal, community create/edit, profile).

**Files:**
- Create: `components/blog/editor/BlogEditorLayout.tsx`
- Modify: `components/blog/RichBlogEditor.tsx`
- Modify: `components/blog/editor/types.ts`

**Step 1: Create the layout component**

Create `components/blog/editor/BlogEditorLayout.tsx` — a new layout component that:
- Takes `mode`, `onCancel`, `saveStatusText` props
- Renders a sticky top bar with: title, save status, cancel button (if onCancel provided)
- Renders children (the main content area) in a scrollable container with `h-full` and no `max-width` constraint
- Renders the action bar (publish/draft buttons) as a sticky bottom bar
- On mobile, the layout stacks vertically; on desktop it uses full viewport height

```tsx
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-text/10 bg-background backdrop-blur-sm sticky top-0 z-10">
                <div>
                    <h2 className="text-xl font-bold font-serif text-text">{title}</h2>
                    {subtitle && <p className="text-sm text-text/60">{subtitle}</p>}
                    {saveStatusText && <p className="text-xs text-text/40 mt-0.5">{saveStatusText}</p>}
                </div>
                <div className="flex items-center gap-2">
                    {showPublish && (
                        <button
                            onClick={() => onSubmit("published")}
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Publish
                        </button>
                    )}
                    <button
                        onClick={() => onSubmit("draft")}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-lg border border-text/10 bg-white text-text/70 font-medium hover:bg-text/5 transition-colors disabled:opacity-50 flex items-center gap-2 active:scale-95"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Draft
                    </button>
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
        </div>
    )
}
```

**Step 2: Update RichBlogEditor types**

Modify `components/blog/editor/types.ts` to update the mode type and add new props:

```ts
import { BlogCategory } from "@/utils/types/blog"

export interface RichBlogEditorProps {
    post?: {
        id: string
        title: string
        slug: string
        content: string
        excerpt?: string | null
        cover_image?: string | null
        category: BlogCategory
        status?: string | null
        tags?: string[] | null
        featured?: boolean | null
        images?: string[] | null
        tagged_cafe_ids?: string[] | null
        crawl_id?: string | null
    }
    cafeId?: string
    cafeName?: string
    onSuccess?: (slug: string) => void
    onCancel?: () => void
    allowedCategories?: BlogCategory[]
    showTags?: boolean
    showCafePicker?: boolean
    showCrawlPicker?: boolean
    showFeatured?: boolean
    showSlug?: boolean
    mode?: "full" | "community"
}

export type SaveStatus = "idle" | "saving" | "saved" | "error"

export interface AutoSaveState {
    status: SaveStatus
    lastSaved?: Date
    error?: string
}
```

**Step 3: Verify types compile**

Run: `bun run typecheck 2>&1 | head -30`
Expected: May have errors — this is fine, we'll fix in subsequent tasks.

**Step 4: Commit**

```bash
git add components/blog/editor/BlogEditorLayout.tsx components/blog/editor/types.ts
git commit -m "feat(blog): add BlogEditorLayout component and update editor types"
```

---

### Task 1.2: Refactor RichBlogEditor to Use Full-Width Inline Layout

**Purpose:** Remove the sidebar (`lg:col-span-2` / sidebar pattern) and move all controls into inline collapsible sections within the main content area. Remove `max-w-*` constraints so the editor fills available space.

**Files:**
- Modify: `components/blog/RichBlogEditor.tsx`

**Step 1: Rewrite RichBlogEditor layout**

Change the layout structure:
- Remove the `grid lg:grid-cols-3` wrapper
- Remove the separate sidebar `<div>` with `lg:border-r`
- Move the "Publishing" section (publish/draft buttons) to the top bar
- Move the sidebar sections (Category, Tags, Gallery, Cafe Picker, Crawl Picker, Featured toggle) into collapsible `<details>` sections BELOW the content editor, so they're always accessible regardless of mode
- In `community` mode, show the category selector and draft button (currently hidden)
- Make the content area flex-grow to fill the viewport

Key changes to `RichBlogEditor.tsx`:
1. Remove the `isFullMode` conditional rendering — always show metadata sections
2. Replace the two-column grid with a single-column full-height layout
3. Move Publish/Draft buttons into a top action bar (always visible)
4. Create collapsible metadata sections using `<details>` / `<summary>` HTML elements (lightweight, no extra JS needed)
5. Remove `max-w-none` from editor content — instead, let it fill available space naturally
6. Change the EditorContent wrapper from fixed `min-h-[400px]` to `flex-1` so the editor grows to fill space

**Step 2: Run typecheck**

Run: `bun run typecheck 2>&1 | head -30`

**Step 3: Commit**

```bash
git add components/blog/RichBlogEditor.tsx
git commit -m "refactor(blog): redesign editor to full-width inline layout with collapsible metadata"
```

---

### Task 1.3: Unify Community Blog Editor Access

**Purpose:** Ensure community users (from `/blog/new` and `/blog/edit/[id]`) can access the same editor functionality as admins. Currently `mode="community"` hides the sidebar entirely, making it impossible to set categories, tags, etc.

**Files:**
- Modify: `components/blog/RichBlogEditor.tsx`
- Modify: `app/blog/new/CommunityBlogCreateClient.tsx`
- Modify: `app/blog/edit/[id]/CommunityBlogEditClient.tsx`

**Step 1: Update community editor clients**

Change `CommunityBlogCreateClient.tsx`:
- Pass `mode="community"` but with `showTags={true}` and `allowedCategories={["community", "events"]}`
- Actually, simplify: just set `mode="community"` which should now show the metadata sections since we removed the sidebar gating

RichBlogEditor should now:
- In `community` mode: show category selector (with only community-allowed categories), show tags, show Publish + Save Draft buttons
- In `full` mode: show all categories, tags, cafe picker, crawl picker, featured toggle, slug editor
- Both modes share the same collapsible metadata section pattern

**Step 2: Verify community create page renders**

Run: `bun dev` and manually check `/blog/new` renders the editor with metadata sections.

**Step 3: Commit**

```bash
git add components/blog/RichBlogEditor.tsx app/blog/new/CommunityBlogCreateClient.tsx app/blog/edit/[id]/CommunityBlogEditClient.tsx
git commit -m "feat(blog): unify community editor access to categories, tags, and draft saving"
```

---

### Task 1.4: Unify Admin ContentManagement Editor

**Purpose:** The admin ContentManagement opens RichBlogEditor in a constrained modal (`max-w-5xl max-h-[90vh]`). Change it to use the same full-width editor layout. Since the admin page is in `/manage`, the editor should be either a full-page overlay or a dedicated route.

**Files:**
- Modify: `components/manage/ContentManagement.tsx`
- Modify: `app/manage/content/page.tsx`

**Step 1: Change admin editor from modal to full-page**

In `ContentManagement.tsx`:
- Instead of the modal overlay, navigate to a dedicated editor route `/manage/content/editor` or `/manage/content/edit/[id]`
- Alternatively, keep the modal but make it truly full-screen (remove `max-w-5xl`, make it `w-full h-full`)
- The editor should fill the viewport, not be constrained in a small modal

Option chosen: **Full-screen overlay** (avoids creating new routes):
- Change the modal container from `max-w-5xl max-h-[90vh]` to `fixed inset-0 z-50` (full viewport)
- Remove `max-h-[90vh] overflow-y-auto` from the modal content wrapper
- The editor itself handles scrolling internally

**Step 2: Commit**

```bash
git add components/manage/ContentManagement.tsx
git commit -m "refactor(admin): expand blog editor to full-screen overlay for better editing"
```

---

## Phase 2: Draft Preview System

### Task 2.1: Draft Preview Route and Visual Indicator

**Purpose:** Allow draft posts to be viewed at their slug URL (with access control) and display a prominent "Draft" banner. Skip view count increment for drafts.

**Files:**
- Modify: `app/blog/[slug]/page.tsx`
- Modify: `app/api/actions/blog.ts`

**Step 1: Update blog post page to handle drafts**

In `app/blog/[slug]/page.tsx`:
- After fetching the post, check if `post.status !== "published"`
- If draft: skip `incrementViewCount()`, add a draft banner at the top, add `<meta name="robots" content="noindex,nofollow">` to metadata
- Show a "Draft Preview" visual banner (amber/yellow, sticky at top)
- Conditionally hide the views count and share button for drafts
- Add a link/button back to the editor for the author

```tsx
// After fetching post:
const isDraft = post.status === "draft"
const isPending = post.status === "pending"

// In generateMetadata:
if (post.status !== "published") {
    metadata.robots = { index: false, follow: false }
}

// In page rendering:
if (!isPublished) {
    // Don't increment views
} else {
    incrementViewCount(post.id)
}

// Render draft banner:
{(isDraft || isPending) && (
    <div className="sticky top-0 z-30 bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium">
        {isDraft ? "Draft Preview" : "Pending Review"} — {isDraft ? "Not visible to the public" : "Awaiting approval"}
    </div>
)}

// Hide views count for drafts:
{post.status === "published" && (
    <div className="flex items-center gap-1.5 text-text/50 text-sm">
        <Eye className="w-4 h-4" />
        <span>{post.views_count || 0} views</span>
    </div>
)}
```

**Step 2: Update generateMetadata to handle draft noindex**

In `generateMetadata`:
```tsx
if (post.status !== "published") {
    return {
        ...buildPageMetadata({ title: `[Draft] ${post.title}`, ... }),
        robots: { index: false, follow: false },
    }
}
```

**Step 3: Commit**

```bash
git add app/blog/[slug]/page.tsx
git commit -m "feat(blog): add draft preview with visual banner, noindex, and skip view counting"
```

---

### Task 2.2: Draft Preview Link in Editor and UserBlogsList

**Purpose:** Add a "Preview" link in the editor and in the user's blog list so authors can easily view their draft.

**Files:**
- Modify: `components/blog/RichBlogEditor.tsx`
- Modify: `components/blog/UserBlogsList.tsx`

**Step 1: Add preview button to editor**

When editing an existing post (post.id exists), add a "Preview" link/button alongside the Publish/Draft buttons that opens `/blog/{post.slug}` in a new tab.

**Step 2: Add preview link in UserBlogsList**

For draft/pending posts, add a "Preview" link pointing to `/blog/{post.slug}`. Fix the existing bug where published posts link to `/community/blog/` instead of `/blog/`.

In `UserBlogsList.tsx`, change:
- `href={`/community/blog/${post.slug}`}` → `href={`/blog/${post.slug}`}`
- Add a "Preview" link for drafts/pending posts

**Step 3: Commit**

```bash
git add components/blog/RichBlogEditor.tsx components/blog/UserBlogsList.tsx
git commit -m "feat(blog): add draft preview links in editor and blog list, fix community/blog URL bug"
```

---

## Phase 3: Table & Content Rendering Fixes

### Task 3.1: Fix TipTap Table Serialization and Rendering

**Purpose:** Tables created in the TipTap editor don't render correctly in the blog viewer because the tiptap-markdown extension doesn't properly serialize TipTap tables to markdown tables, and the editor has no ProseMirror table styles.

**Files:**
- Modify: `components/blog/editor/extensions.ts`
- Modify: `app/globals.css`
- Modify: `components/ui/MarkdownRender.tsx`
- Create: `components/blog/editor/table-fix.ts`

**Step 1: Add ProseMirror/TipTap table CSS to globals.css**

Add these styles to `app/globals.css`:

```css
/* TipTap / ProseMirror Table Styles */
.tiptap {
    outline: none;
}

.tiptap p.is-editor-empty:first-child::before {
    color: var(--color-text);
    opacity: 0.3;
    content: attr(data-placeholder);
    float: left;
    pointer-events: none;
    height: 0;
}

.tiptap table {
    border-collapse: collapse;
    width: 100%;
    margin: 1.5rem 0;
    overflow: hidden;
    border-radius: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.tiptap table td,
.tiptap table th {
    border: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
    padding: 0.5rem 0.75rem;
    min-width: 80px;
    vertical-align: top;
    position: relative;
}

.tiptap table th {
    background: color-mix(in srgb, var(--color-secondary) 15%, transparent);
    font-weight: 600;
    text-align: left;
}

.tiptap table td {
    background: transparent;
}

.tiptap table tr:hover td {
    background: color-mix(in srgb, var(--color-secondary) 8%, transparent);
}

.tiptap .selectedCell::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--color-primary);
    opacity: 0.15;
    pointer-events: none;
}

.tiptap .column-resize-handle {
    position: absolute;
    right: -2px;
    top: 0;
    bottom: -2px;
    width: 4px;
    background-color: var(--color-primary);
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
}

.tiptap .column-resize-handle:hover,
.tiptap .column-resize-handle.is-active {
    opacity: 1;
    pointer-events: auto;
}

.tiptap .resize-cursor {
    cursor: ew-resize;
    cursor: col-resize;
}
```

**Step 2: Consider replacing tiptap-markdown table handling**

The `tiptap-markdown` extension may not serialize tables properly. Investigate whether we need:
- A custom `Markdown` extension config that handles tables
- Or switch to HTML serialization just for tables

In `extensions.ts`, update the `Markdown.configure()` to ensure table HTML is preserved:

```ts
Markdown.configure({
    html: true, // Allow HTML in markdown to preserve tables
    transformCopiedText: true,
    transformPastedText: true,
}),
```

Set `html: true` so that tables that can't be serialized as markdown are preserved as HTML.

**Step 3: Verify table round-tripping**

Test by:
1. Creating a table in the editor
2. Saving as draft
3. Viewing the rendered blog post
4. Tables should render correctly with borders, header styling, etc.

**Step 4: Commit**

```bash
git add app/globals.css components/blog/editor/extensions.ts
git commit -m "fix(blog): add ProseMirror table styles and fix markdown table serialization"
```

---

### Task 3.2: Align Editor and Viewer Content Styling

**Purpose:** The editor shows content differently from the viewer. Align the prose styling so content looks consistent.

**Files:**
- Modify: `components/blog/RichBlogEditor.tsx` (editor attributes)
- Modify: `components/ui/MarkdownRender.tsx`
- Modify: `app/blog/[slug]/page.tsx`

**Step 1: Update editor ProseMirror attributes**

In `RichBlogEditor.tsx`, change the editor `editorProps.attributes.class` from:
```
"prose prose-stone max-w-none min-h-[400px] p-6 outline-none"
```
to:
```
"prose prose-lg prose-stone max-w-none outline-none"
```

This matches the viewer's `prose prose-lg prose-stone` styling.

**Step 2: Remove max-width constraint from blog viewer**

In `app/blog/[slug]/page.tsx`, change:
```tsx
<article className='max-w-6xl mx-auto px-4 py-8 md:py-12'>
```
to:
```tsx
<article className='max-w-4xl mx-auto px-4 py-8 md:py-12'>
```

This gives the blog post a more readable width while being narrower than the current overly-wide layout. (Note: blog content benefits from `max-w-4xl` for readability; the current `max-w-6xl` is too wide for text.)

**Step 3: Ensure MarkdownRender table styles match editor styles**

The `MarkdownRender.tsx` already has custom table components. Verify they match the new `globals.css` ProseMirror table styles. If there are conflicts, remove the inline table styles from `MarkdownRender` and rely on the global styles.

**Step 4: Add TipTap editor min-height and padding via inline styles or wrapper**

Since we changed the editor content styling, ensure the editor container provides proper spacing:

```tsx
<EditorContent
    editor={editor}
    className="min-h-[500px] p-6"
/>
```

**Step 5: Commit**

```bash
git add components/blog/RichBlogEditor.tsx components/ui/MarkdownRender.tsx app/blog/[slug]/page.tsx
git commit -m "fix(blog): align editor and viewer prose styling, fix content width"
```

---

### Task 3.3: Fix PostPreviewModal Content Rendering

**Purpose:** The `PostPreviewModal.tsx` currently renders content as plain text split by newlines instead of using `MarkdownRender`. Fix this.

**Files:**
- Modify: `components/manage/PostPreviewModal.tsx`

**Step 1: Replace plain-text rendering with MarkdownRender**

In `PostPreviewModal.tsx`:
- Import `MarkdownRender` from `@/components/ui/MarkdownRender`
- Replace the content section:
```tsx
// BEFORE:
<div className="prose prose-sm max-w-none text-text/90">
    {post.content.split("\n").map((paragraph, idx) => (
        <p key={idx} className="mb-4">{paragraph}</p>
    ))}
</div>

// AFTER:
<MarkdownRender content={post.content} />
```

**Step 2: Commit**

```bash
git add components/manage/PostPreviewModal.tsx
git commit -m "fix(admin): render blog preview content as markdown instead of plain text"
```

---

## Phase 4: Admin Cafe Image Download

### Task 4.1: Add Image Download to CafeEditor in Admin Preview

**Purpose:** Allow admins at `/manage/preview/[id]` to download any cafe image (thumbnail or gallery).

**Files:**
- Modify: `components/cafe-editor/ImageSection.tsx`
- Modify: `app/manage/preview/[id]/page.tsx` (optional: add download button outside editor)

**Step 1: Add download button per gallery image in ImageSection**

In `components/cafe-editor/ImageSection.tsx`, add a download button (using the existing `Download` icon from lucide-react) next to each image's delete button. The download function:

```tsx
const downloadImage = async (url: string, filename: string) => {
    try {
        const response = await fetch(url)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = blobUrl
        link.download = filename
        link.click()
        URL.revokeObjectURL(blobUrl)
    } catch (error) {
        console.error("Failed to download image:", error)
    }
}
```

Add a `Download` icon button next to the existing delete/trash button in the gallery grid, and also for the thumbnail section.

**Step 2: Add bulk download button for admin preview page**

Add a "Download All Images" button in the admin preview page that:
1. Collects all image URLs (thumbnail + gallery)
2. Downloads them with appropriate filenames (cafe-name-thumbnail.jpg, cafe-name-gallery-1.jpg, etc.)
3. Shows progress feedback

In `app/manage/preview/[id]/page.tsx`:

```tsx
import { Download } from "lucide-react"

// Add a button after CafeEditor:
<div className="flex justify-end mb-4">
    <button
        onClick={handleDownloadAllImages}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
    >
        <Download className="w-4 h-4" />
        Download All Images
    </button>
</div>
```

This requires making `cafe` data available to the page component (it already is via `getCafeById`), and creating a download utility.

**Step 3: Create utility function for bulk download**

Create `utils/image-download.ts`:
```ts
export async function downloadImage(url: string, filename: string): Promise<void> {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = filename
    link.click()
    URL.revokeObjectURL(blobUrl)
}

export async function downloadAllImages(
    images: { url: string; filename: string }[]
): Promise<void> {
    for (const { url, filename } of images) {
        await downloadImage(url, filename)
    }
}
```

**Step 4: Commit**

```bash
git add components/cafe-editor/ImageSection.tsx app/manage/preview/\[id\]/page.tsx utils/image-download.ts
git commit -m "feat(admin): add image download capability to cafe preview page"
```

---

## Phase 5: Bug Fixes and Improvements

### Task 5.1: Fix UserBlogsList Published Post Link

**Purpose:** Fix the bug where `UserBlogsList.tsx` links published posts to `/community/blog/` instead of `/blog/`.

**Files:**
- Modify: `components/blog/UserBlogsList.tsx`

**Step 1: Fix the link**

In `UserBlogsList.tsx`, find the link for published posts:
```tsx
href={`/community/blog/${post.slug}`}
```
Change to:
```tsx
href={`/blog/${post.slug}`}
```

**Step 2: Commit**

```bash
git add components/blog/UserBlogsList.tsx
git commit -m "fix(blog): correct published post link from /community/blog/ to /blog/"
```

---

### Task 5.2: Improve EditorToolbar with Table Controls

**Purpose:** The editor toolbar doesn't have table-specific controls (add/delete rows/columns). Add them.

**Files:**
- Modify: `components/blog/editor/EditorToolbar.tsx`

**Step 1: Add table management buttons to toolbar**

When the editor cursor is inside a table, show:
- Add Row Before / Add Row After
- Add Column Before / Add Column After
- Delete Row / Delete Column
- Delete Table
- Merge/Split cells (if supported)

Add these as a conditional section in `EditorToolbar`:

```tsx
{/* Table Controls (shown when inside a table) */}
{editor.isActive("table") && (
    <>
        <div className="w-px h-5 bg-text/10 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Before">
            <TableRowInsert className="w-4 h-4" />
        </ToolbarButton>
        {/* ... more table buttons */}
    </>
)}
```

Use icons from lucide-react: `Table2`, `Rows3`, `Columns3`, `Trash2`, etc.

**Step 2: Commit**

```bash
git add components/blog/editor/EditorToolbar.tsx
git commit -m "feat(blog): add table management controls to editor toolbar"
```

---

### Task 5.3: Add Slash Command for Table Editing

**Purpose:** The slash command list already includes "Table" insert. Add commands for adding/removing rows and columns.

**Files:**
- Modify: `components/blog/editor/SlashCommandList.tsx`

**Step 1: Add table editing slash commands**

Add these commands to `getSlashCommands()`:
- "Add Row Before"
- "Add Row After"
- "Add Column Before"  
- "Add Column After"
- "Delete Row"
- "Delete Column"
- "Delete Table"

These should only appear when the cursor is already inside a table. However, since slash commands are static, we'll just add them. The user will understand contextually.

Actually, better approach: Keep the slash commands simple (just insert table), and rely on the toolbar buttons for table editing. The slash command list is already comprehensive.

**Skip this task** — toolbar controls in Task 5.2 are sufficient.

---

### Task 5.4: Improve ContentManagement Blog List with Status Filters

**Purpose:** The admin blog list currently has no filtering. Add status filter tabs.

**Files:**
- Modify: `components/manage/ContentManagement.tsx`

**Step 1: Add status filter tabs above the blog post list**

Add tabs for: All, Published, Pending, Draft, Archived — similar to the existing blog/events/reports tabs pattern.

```tsx
const [statusFilter, setStatusFilter] = useState<BlogStatus | "all">("all")

const filteredPosts = statusFilter === "all" 
    ? blogPosts 
    : blogPosts.filter(p => p.status === statusFilter)
```

**Step 2: Commit**

```bash
git add components/manage/ContentManagement.tsx
git commit -m "feat(admin): add blog post status filter tabs"
```

---

## Phase 6: Lint and Build Fixes

### Task 6.1: Run Linter and Fix All Issues

**Purpose:** Ensure all new and modified code passes linting.

**Step 1: Run linter**

Run: `bun lint 2>&1`

**Step 2: Fix all lint errors and warnings**

Address each error. Common issues to expect:
- Unused imports
- Missing type annotations
- `any` types
- React hooks dependency warnings

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "chore: fix lint errors and warnings"
```

---

### Task 6.2: Run TypeCheck and Fix All Errors

**Purpose:** Ensure the project compiles without TypeScript errors.

**Step 1: Run typecheck**

Run: `bun run typecheck 2>&1` (or `npx tsc --noEmit 2>&1`)

**Step 2: Fix all type errors**

Common issues to expect:
- Props mismatch after RichBlogEditor refactor
- Missing type imports
- New component prop types not matching usage sites

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "chore: fix TypeScript errors"
```

---

### Task 6.3: Run Build and Fix All Errors

**Purpose:** Ensure the production build succeeds.

**Step 1: Run production build**

Run: `bun build 2>&1`

**Step 2: Fix any build errors**

Address any issues found during the build process.

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "chore: fix build errors"
```

---

### Task 6.4: Run Tests and Fix Any Failures

**Purpose:** Ensure existing tests still pass.

**Step 1: Run tests**

Run: `bun test 2>&1`

**Step 2: Fix any test failures**

If tests break due to our changes, fix them.

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "chore: fix test failures"
```

---

## Summary of Additional Improvements

These are suggestions beyond the original requirements:

1. **Draft sharing tokens** — Generate a unique preview token for drafts so authors can share private links without making the post public. (Future task)

2. **Auto-save indicator** — The auto-save status is only shown as text. Consider adding a visual dot indicator (green=saved, yellow=saving, red=error) for better UX.

3. **Content diff preview** — When editing a post, show what changed since the last save. (Future task)

4. **Image optimization in blog viewer** — The viewer doesn't use Next.js `<Image>` for inline blog images (markdown-rendered). Consider using a custom component in MarkdownRender that uses `<Image>` with proper `sizes` and `blurDataURL`.

5. **Editor mobile responsiveness** — The current toolbar wraps oddly on mobile. Consider a horizontal scrollable toolbar or a more compact layout for small screens.

6. **Unify admin blog editing route** — Instead of the modal approach in ContentManagement, consider a dedicated route `/manage/content/edit/[id]` for editing blog posts. This provides better URL state and back-navigation.