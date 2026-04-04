# Rich Blog Editor Design Spec

> Improving the blog writing experience with a WYSIWYG rich text editor, inline images, slash commands, and auto-save.

## Context

The current blog system uses a plain `<textarea>` for Markdown input. Users must know Markdown syntax to format content. There are two separate editor components (`BlogEditor.tsx` and `CommunityBlogEditor.tsx`) with ~70% duplicated logic. Blog image upload is admin-only (a bug). There is no auto-save — closing a tab loses all work.

**Goal:** Replace both editors with a single unified TipTap-based rich text editor that stores content as Markdown, supports inline images, slash commands, keyboard shortcuts, and hybrid auto-save.

---

## Architecture

### Single Unified Component

A new `RichBlogEditor` replaces both `BlogEditor` and `CommunityBlogEditor`. Feature visibility is controlled by props:

```typescript
interface RichBlogEditorProps {
  post?: BlogPost
  cafeId?: string
  cafeName?: string
  onSuccess?: (slug: string) => void
  onCancel?: () => void
  allowedCategories?: BlogCategory[]
  // Feature flags
  showTags?: boolean
  showCafePicker?: boolean
  showCrawlPicker?: boolean
  showFeatured?: boolean
  showSlug?: boolean
  mode?: "full" | "community"  // shorthand presets
}
```

- `mode="community"` sets all feature flags to `false`, shows only title, excerpt, content, cover image
- `mode="full"` (default) enables all features appropriate to the user's role

### Content Storage

- Content is stored as **Markdown** in the existing `content` TEXT column
- TipTap's internal JSON document is serialized to Markdown via `tiptap-markdown` extension
- The existing `MarkdownRender` component continues to render content unchanged
- **Full backward compatibility** — existing markdown posts load and render correctly in the new editor

### Tech Stack

- **Editor:** TipTap v2 + ProseMirror
- **Serialization:** `tiptap-markdown` extension
- **Syntax highlighting:** `lowlight` for code blocks
- **Rendering:** Existing `react-markdown` + `remark-gfm` pipeline (unchanged)

---

## Editor Features

### Toolbar (Always Visible)

| Button | Shortcut | Action |
|--------|----------|--------|
| Bold | `Ctrl+B` | Toggle bold |
| Italic | `Ctrl+I` | Toggle italic |
| Strikethrough | `Ctrl+Shift+X` | Toggle strikethrough |
| Code | `Ctrl+E` | Toggle inline code |
| Heading Dropdown | `Ctrl+Alt+1/2/3` | Switch between H1, H2, H3, Paragraph |
| Bullet List | — | Toggle bullet list |
| Ordered List | — | Toggle ordered list |
| Task List | — | Toggle task/checkbox list |
| Blockquote | — | Toggle blockquote |
| Code Block | — | Toggle code block |
| Link | `Ctrl+K` | Insert/edit link |
| Image | — | Open inline image upload |
| Horizontal Rule | — | Insert divider |

**Discoverability:**
- Toolbar buttons show keyboard shortcuts on hover (tooltips)
- A `?` button in the toolbar opens a keyboard shortcut help modal
- Subtle hint below editor on first use: "Tip: Type `/` for commands, `?` for shortcuts" (dismissible, persisted in localStorage)

### Slash Commands

Typing `/` at the start of a line (or after whitespace) opens a searchable dropdown menu.

Available commands:

| Command | Action |
|---------|--------|
| `/heading1` | Convert to H1 |
| `/heading2` | Convert to H2 |
| `/heading3` | Convert to H3 |
| `/bulletlist` | Insert bullet list |
| `/orderedlist` | Insert ordered list |
| `/tasklist` | Insert task list |
| `/blockquote` | Insert blockquote |
| `/codeblock` | Insert code block |
| `/divider` | Insert horizontal rule |
| `/image` | Open inline image upload dialog |
| `/table` | Insert 3x3 table |
| `/link` | Insert link |
| `/cafe` | Open cafe tagger (uses `BlogCafePicker`) |
| `/youtube` | Insert YouTube embed |

The menu filters commands as the user types (e.g., `/head` shows heading options). Arrow keys navigate, Enter selects, Escape closes.

### Keyboard Shortcuts (Full List)

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+Shift+X` | Strikethrough |
| `Ctrl+E` | Inline code |
| `Ctrl+K` | Insert/edit link |
| `Ctrl+Alt+1` | Heading 1 |
| `Ctrl+Alt+2` | Heading 2 |
| `Ctrl+Alt+3` | Heading 3 |
| `Ctrl+Shift+B` | Bullet list |
| `Ctrl+Shift+O` | Ordered list |
| `Ctrl+Shift+T` | Task list |
| `Ctrl+Shift+Q` | Blockquote |
| `Ctrl+Alt+C` | Code block |
| `?` | Open shortcut help modal |

---

## Inline Images

### Upload Methods
1. **Toolbar button** — Click image icon, file picker opens
2. **Slash command** — Type `/image`, file picker opens
3. **Drag and drop** — Drop image file directly onto the editor
4. **Paste** — Paste image from clipboard

### Upload Flow
- Images are uploaded via `uploadBlogImageAction` (fixed to allow all authenticated users)
- While uploading, a placeholder with spinner is shown in the editor
- On success, placeholder is replaced with the actual image
- On failure, placeholder shows error with retry button

### Image Resizing
- Images have drag handles on corners for resizing
- Stored in markdown as `![alt](url)` — note: resize dimensions are not stored in markdown (images render at natural size). The editor applies visual sizing only during the session.

### Gallery Migration
- The sidebar gallery section (`images[]` array) is **removed** for the unified editor
- Existing posts with gallery images: render gallery below content using `BlogImageGallery` (backward compat in view page)
- New posts: all images are inline within content

---

## Auto-Save

### Dual-Layer Strategy

**Layer 1: localStorage (instant)**
- On every content change, debounce 500ms, then save to `localStorage` under key `blog-draft-{postId || "new"}`
- Stores: `{ title, content, excerpt, coverImage, category, tags, savedAt }`
- On page load: if localStorage draft exists and is newer than the post's `updated_at`, show "Restore unsaved changes?" prompt
- Clear localStorage draft on successful publish/save

**Layer 2: Server (periodic)**
- Every 60 seconds after a change, auto-save to server as draft
- Uses new `autoSaveDraft` server action
- Only triggers if content has changed since last server save
- Creates new post (status: "draft") if no post exists yet, or updates existing draft
- Silent — no toast notifications, no redirects

### Visual Indicator
- Header shows save status: "Saving...", "Saved just now", "Save failed"
- Indicator is subtle (small text, muted color) — not a blocking notification

### Server Action

```typescript
export async function autoSaveDraft(input: {
  postId?: string
  title: string
  content: string
  excerpt?: string
  coverImage?: string | null
  category: BlogCategory
  tags?: string[]
}): Promise<{ success: boolean; postId?: string; error?: string }>
```

- Creates or updates a draft post
- Does NOT run LLM moderation check
- Does NOT change status (stays "draft")
- Returns the post ID for new posts (so subsequent auto-saves target the right post)

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `components/blog/RichBlogEditor.tsx` | Unified rich text editor component (TipTap-based) |
| `components/blog/editor/EditorToolbar.tsx` | Toolbar buttons and heading dropdown |
| `components/blog/editor/SlashCommandList.tsx` | Slash command dropdown menu |
| `components/blog/editor/ShortcutHelpModal.tsx` | Keyboard shortcut reference modal |
| `components/blog/editor/extensions.ts` | TipTap extension configuration |
| `components/blog/editor/useAutoSave.ts` | Auto-save hook (localStorage + server) |
| `components/blog/editor/useEditorState.ts` | Editor form state management hook |
| `components/blog/editor/types.ts` | Editor-specific TypeScript types |

### Modified Files

| File | Change |
|------|--------|
| `app/blog/new/page.tsx` | Use `RichBlogEditor` with `mode="community"` |
| `app/writer/new/page.tsx` | Use `RichBlogEditor` with `mode="full"` |
| `components/writer/EditStory.tsx` | Use `RichBlogEditor` with `mode="full"` |
| `app/api/actions/blog.ts` | Add `autoSaveDraft` action |
| `utils/storage/actions.ts` | Remove admin-only restriction from `uploadBlogImageAction` |
| `app/blog/[slug]/page.tsx` | Add fallback gallery rendering for legacy posts |
| `package.json` | Add TipTap dependencies |

### Deleted Files

| File | Replaced By |
|------|-------------|
| `components/blog/BlogEditor.tsx` | `RichBlogEditor.tsx` |
| `components/blog/CommunityBlogEditor.tsx` | `RichBlogEditor.tsx` |

---

## Dependencies

```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-placeholder": "^2.x",
  "@tiptap/extension-task-list": "^2.x",
  "@tiptap/extension-task-item": "^2.x",
  "@tiptap/extension-code-block-lowlight": "^2.x",
  "@tiptap/extension-table": "^2.x",
  "@tiptap/extension-table-row": "^2.x",
  "@tiptap/extension-table-cell": "^2.x",
  "@tiptap/extension-table-header": "^2.x",
  "@tiptap/extension-youtube": "^2.x",
  "@tiptap/pm": "^2.x",
  "tiptap-markdown": "^0.x",
  "lowlight": "^3.x"
}
```

---

## Error Handling

- **Image upload failure:** Show error placeholder in editor with retry button. Do not lose the image node — user can retry or delete.
- **Auto-save failure:** Show "Save failed" indicator. localStorage backup still works. User can manually save.
- **Server auto-save conflict:** If post was modified elsewhere (e.g., another tab), auto-save skips and shows warning. Manual save resolves.
- **Content too large:** Markdown content > 1MB shows warning before publish. Server enforces max length.
- **Slash command with no match:** Show "No commands found" with hint to check spelling.

---

## Testing

- Verify existing markdown posts load correctly in the new editor
- Verify all toolbar buttons produce correct markdown output
- Verify slash commands work and filter correctly
- Verify keyboard shortcuts match the help modal
- Verify inline image upload works for non-admin users
- Verify auto-save to localStorage recovers on page refresh
- Verify auto-save to server creates/updates drafts
- Verify gallery images on legacy posts render correctly in view page
- Verify publish/save draft flows work end-to-end
- Verify `mode="community"` hides advanced features
- Verify `mode="full"` shows all features
