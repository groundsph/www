# Blog UI Revamp & Draft Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the blog posting/editing UI across all entry points (admin, writer, community), revamp the manage layout to use full-width with integrated navigation instead of a cramped sidebar, and enable draft previews with disabled analytics.

**Architecture:** Replace the separate ManageLayout sidebar with a horizontal tabbed navigation that uses full screen width. Unify the blog editor by removing the separate "community" mode and making RichBlogEditor always full-featured with role-based visibility. Add a draft preview route that renders draft/pending posts with a visual "Draft Preview" banner and skips view-count increments and social sharing.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle ORM, Tailwind CSS v4, TipTap editor, framer-motion/motion

---

## Phase 1: Unify Blog Posting UI

Currently there are 4 separate entry points for creating/editing blog posts:
1. `/manage/content` → RichBlogEditor in a modal (admin, `mode="full"`)
2. `/writer/new` → RichBlogEditor full page (writer, `mode="full"`)
3. `/writer/[id]/edit` → EditStory wrapper → RichBlogEditor (writer, `mode="full"`)
4. `/blog/new` → CommunityBlogCreateClient → RichBlogEditor (`mode="community"`)
5. `/blog/edit/[id]` → CommunityBlogEditClient → RichBlogEditor (`mode="community"`)

The `mode="community"` strips the sidebar entirely and forces `category: "community"`, while `mode="full"` shows a 2-column layout. They also have different success/cancel callbacks and naming ("Write Story" vs "Create Post").

**Changes:**
- Remove the `mode` prop distinction. Instead, use the existing `allowedCategories`, `showTags`, `showCafePicker`, `showCrawlPicker`, `showFeatured`, and `showSlug` props to control what's visible.
- `/blog/new` and `/blog/edit/[id]` will use `allowedCategories={["community"]}` instead of `mode="community"`.
- Remove `CommunityBlogCreateClient.tsx` and `CommunityBlogEditClient.tsx` - their logic merges into the page files directly.
- Remove `EditStory.tsx` - merge its logic into `/writer/[id]/edit/page.tsx`.
- In the manage content modal, continue using `mode="full"` but explicitly pass `allowedCategories` for admin access to all categories.

### Task 1: Remove `mode` prop from RichBlogEditor, use feature flags instead

**Files:**
- Modify: `components/blog/editor/types.ts`
- Modify: `components/blog/RichBlogEditor.tsx`

**Step 1: Update types to remove `mode` prop**

In `components/blog/editor/types.ts`, remove the `mode` field from `RichBlogEditorProps` (or make it deprecated). The component will derive its layout from the feature-flag props (`showTags`, `showCafePicker`, etc.) and a new `allowedCategories` prop that was already supported.

```typescript
// Remove mode?: "full" | "community" from the interface
// If there's no allowedCategories provided and show* props are all true, assume full layout
```

**Step 2: Update RichBlogEditor to remove mode-based logic**

In `components/blog/RichBlogEditor.tsx`:
- Remove `const isFullMode = mode === "full"` and replace all references with a computed value:
  ```typescript
  const isFullMode = showTags && showCafePicker && showCrawlPicker
  ```
- Remove `mode` from props destructuring
- Remove `mode === "community"` conditional in `handleSubmit` - instead, check if `allowedCategories` is restricted:
  ```typescript
  const isCommunityMode = allowedCategories?.length === 1 && allowedCategories[0] === "community"
  if (isCommunityMode && !post) {
    result = await createCommunityBlogPost(...)
  } else {
    // existing create/update logic
  }
  ```
- The community mode submit button text should say "Submit for Review" instead of "Publish Post"
- In community mode, replace the "Publish Post" button with "Submit for Review" and remove "Save to Drafts" (community users can't save drafts - they submit for review)

**Step 3: Commit**

```bash
git add components/blog/editor/types.ts components/blog/RichBlogEditor.tsx
git commit -m "refactor(blog): remove mode prop from RichBlogEditor, use feature flags"
```

### Task 2: Update blog creation page to use unified editor

**Files:**
- Modify: `app/blog/new/page.tsx`
- Delete: `app/blog/new/CommunityBlogCreateClient.tsx`

**Step 1: Inline community blog creation logic into page.tsx**

Replace `app/blog/new/page.tsx` with a client-page approach that uses RichBlogEditor directly with `allowedCategories={["community"]}` and `showTags={false}`, `showCafePicker={false}`, `showCrawlPicker={false}`, `showFeatured={false}`, `showSlug={false}`.

```tsx
"use client"

import { useRouter } from "next/navigation"
import RichBlogEditor from "@/components/blog/RichBlogEditor"
import { useNotification } from "@/components/layout/NotificationProvider"

export default function CommunityBlogCreatePage() {
    const router = useRouter()
    const { addNotification } = useNotification()

    return (
        <div className="min-h-screen bg-background">
            <RichBlogEditor
                allowedCategories={["community"]}
                showTags={false}
                showCafePicker={false}
                showCrawlPicker={false}
                showFeatured={false}
                showSlug={false}
                onSuccess={() => {
                    addNotification("Your post has been submitted for review.", "success", {
                        title: "Post Submitted",
                        duration: 5000,
                    })
                    router.push("/profile/blogs")
                }}
                onCancel={() => router.push("/profile/blogs")}
            />
        </div>
    )
}
```

Since this is now a client component, the auth redirect needs to happen differently. Move the auth check to a layout or middleware, or keep the server page as a wrapper:

Keep `page.tsx` as server component for auth, and import a new client component:

```tsx
// app/blog/new/page.tsx (server component)
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import CommunityBlogCreateClient from "./CommunityBlogCreateClient"

export const dynamic = "force-dynamic"

export default async function NewBlogPostPage() {
    const user = await getCurrentUser()
    if (!user) redirect("/auth/login?redirect=/blog/new")
    return <CommunityBlogCreateClient />
}
```

Keep `CommunityBlogCreateClient.tsx` but update it to use feature flags instead of `mode="community"`.

**Step 2: Update CommunityBlogCreateClient**

```tsx
"use client"

import { useRouter } from "next/navigation"
import RichBlogEditor from "@/components/blog/RichBlogEditor"
import { useNotification } from "@/components/layout/NotificationProvider"

export default function CommunityBlogCreateClient() {
    const router = useRouter()
    const { addNotification } = useNotification()

    return (
        <div className="min-h-screen bg-background">
            <RichBlogEditor
                allowedCategories={["community"]}
                showTags={false}
                showCafePicker={false}
                showCrawlPicker={false}
                showFeatured={false}
                showSlug={false}
                onSuccess={() => {
                    addNotification("Your post has been submitted for review.", "success", {
                        title: "Post Submitted",
                        duration: 5000,
                    })
                    router.push("/profile/blogs")
                }}
                onCancel={() => router.push("/profile/blogs")}
            />
        </div>
    )
}
```

**Step 3: Commit**

```bash
git add app/blog/new/page.tsx app/blog/new/CommunityBlogCreateClient.tsx
git commit -m "refactor(blog): update community blog creation to use feature flags"
```

### Task 3: Update blog edit page to use unified editor

**Files:**
- Modify: `app/blog/edit/[id]/CommunityBlogEditClient.tsx`
- Modify: `app/blog/edit/[id]/page.tsx`

**Step 1: Update CommunityBlogEditClient to use feature flags**

Same pattern as Task 2 - replace `mode="community"` with explicit feature flags:

```tsx
<RichBlogEditor
    post={post}
    allowedCategories={["community"]}
    showTags={false}
    showCafePicker={false}
    showCrawlPicker={false}
    showFeatured={false}
    showSlug={false}
    onSuccess={() => router.push("/profile/blogs")}
    onCancel={() => router.push("/profile/blogs")}
/>
```

**Step 2: Commit**

```bash
git add app/blog/edit/[id]/CommunityBlogEditClient.tsx app/blog/edit/[id]/page.tsx
git commit -m "refactor(blog): update community blog edit to use feature flags"
```

### Task 4: Drop EditStory.tsx, inline into writer edit page

**Files:**
- Delete: `components/writer/EditStory.tsx`
- Modify: `app/writer/[id]/edit/page.tsx`

**Step 1: Inline EditStory logic into the page**

Update `app/writer/[id]/edit/page.tsx` to directly render RichBlogEditor without EditStory wrapper:

```tsx
import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getWriterBlogPostById } from "@/app/api/actions/blog"
import RichBlogEditor from "@/components/blog/RichBlogEditor"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

const WRITER_ALLOWED_CATEGORIES = ["news", "guides", "community"] as const

export default async function WriterEditPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser()
    if (!user) redirect("/auth/login")

    const { id } = await params
    const post = await getWriterBlogPostById(id)
    if (!post) notFound()

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-6 flex items-center gap-4">
                <Link href="/writer" className="p-2 hover:bg-text/5 rounded-lg text-text/60 hover:text-text transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold font-serif text-text">Edit Story</h1>
                    <p className="text-text/60 text-sm">Update your blog post</p>
                </div>
            </div>
            <div className="bg-background rounded-2xl border border-text/10 shadow-sm overflow-hidden">
                <RichBlogEditor
                    post={post}
                    allowedCategories={[...WRITER_ALLOWED_CATEGORIES]}
                    onSuccess={(slug) => { window.location.href = "/writer" }}
                    onCancel={() => { window.location.href = "/writer" }}
                />
            </div>
        </div>
    )
}
```

**Step 2: Delete EditStory.tsx**

```bash
rm components/writer/EditStory.tsx
```

**Step 3: Update WriterDashboard edit links if needed**

In `components/writer/WriterDashboard.tsx`, the edit link currently points to `/writer/${post.id}/edit` with a `<Link>` component. Verify the route exists at `app/writer/[id]/edit/page.tsx`.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(blog): remove EditStory wrapper, inline into writer edit page"
```

---

## Phase 2: Revamp Manage Layout — Full-Width with Integrated Navigation

The current ManageLayout (`components/manage/ManageLayout.tsx`) uses a sidebar that doesn't use full screen width. We'll replace it with a horizontal navigation that spans the full viewport width, making better use of screen real estate.

### Task 5: Replace ManageLayout sidebar with full-width horizontal nav

**Files:**
- Modify: `components/manage/ManageLayout.tsx`

**Step 1: Redesign ManageLayout with sticky top nav**

Replace the sidebar layout with a sticky full-width top navigation bar + content area that fills the remaining width. The nav should include the same items but as a horizontal toolbar with icons and labels.

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Store, Users, FileText, Settings, LayoutDashboard,
    BarChart3, ShieldCheck, Activity,
} from "lucide-react"

interface NavItem {
    name: string
    href: string
    icon: React.ReactNode
    adminOnly?: boolean
}

const navItems: NavItem[] = [
    { name: "Overview", href: "/manage", icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: "Cafes", href: "/manage/cafes", icon: <Store className="w-4 h-4" /> },
    { name: "Community", href: "/manage/community", icon: <Users className="w-4 h-4" /> },
    { name: "Moderation", href: "/manage/moderation", icon: <ShieldCheck className="w-4 h-4" /> },
    { name: "Content", href: "/manage/content", icon: <FileText className="w-4 h-4" /> },
    { name: "Analytics", href: "/manage/analytics", icon: <BarChart3 className="w-4 h-4" />, adminOnly: true },
    { name: "Users", href: "/manage/users", icon: <Users className="w-4 h-4" />, adminOnly: true },
    { name: "Logs", href: "/manage/logs", icon: <Activity className="w-4 h-4" />, adminOnly: true },
    { name: "System", href: "/manage/system/settings", icon: <Settings className="w-4 h-4" />, adminOnly: true },
]

interface ManageLayoutProps {
    children: React.ReactNode
    userRole: "admin" | "moderator"
}

export default function ManageLayout({ children, userRole }: ManageLayoutProps) {
    const pathname = usePathname()
    const isFullAdmin = userRole === "admin"
    const filteredNavItems = navItems.filter((item) => !item.adminOnly || isFullAdmin)

    return (
        <div className="min-h-screen w-full bg-background [&_button]:cursor-pointer">
            {/* Sticky top navigation */}
            <nav className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-text/10">
                <div className="w-full px-4 sm:px-6">
                    <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
                        {filteredNavItems.map((item) => {
                            const isActive = pathname === item.href ||
                                (item.href !== "/manage" && pathname.startsWith(item.href))
                            const isCafePreview = pathname.startsWith("/manage/preview") && item.href === "/manage/cafes"

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                                        (isActive || isCafePreview)
                                            ? "bg-primary/10 text-primary"
                                            : "text-text/60 hover:text-text hover:bg-text/5"
                                    }`}
                                >
                                    {item.icon}
                                    {item.name}
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </nav>

            {/* Main content fills width */}
            <main className="w-full px-4 sm:px-6 py-6">
                {children}
            </main>
        </div>
    )
}
```

**Step 2: Update manage/layout.tsx if needed**

The server layout (`app/manage/layout.tsx`) already wraps with ManageLayout. No changes needed there.

**Step 3: Run lint and verify no regressions**

```bash
bun lint
```

**Step 4: Commit**

```bash
git add components/manage/ManageLayout.tsx
git commit -m "refactor(manage): replace sidebar with full-width horizontal nav"
```

### Task 6: Remove max-width constraints across blog and community pages

**Files:**
- Modify: `components/blog/CommunityBlogsTab.tsx` (if it has max-w constraints)
- Modify: `components/community/CommunityPage.tsx`
- Modify: `components/writer/WriterDashboard.tsx`
- Modify: `components/blog/UserBlogsList.tsx`
- Modify: `app/blog/[slug]/page.tsx`

**Step 1: Search for max-w constraints in blog and community files**

Search all relevant files for `max-w-6xl`, `max-w-7xl`, `max-w-5xl` classes and evaluate each one. The goal is to let content breathe by using `w-full` with appropriate padding instead of arbitrary max-widths.

Key targets:
- `app/blog/[slug]/page.tsx` line 121: `max-w-6xl mx-auto` → Change to `w-full px-4 sm:px-6 lg:px-12`
- `components/community/CommunityPage.tsx`: Multiple `max-w-7xl mx-auto` → Change to `w-full px-4 sm:px-6 lg:px-12`
- `components/blog/UserBlogsList.tsx` line 50, 79: `max-w-6xl mx-auto` → Change to `w-full px-4 sm:px-6`
- `components/writer/WriterDashboard.tsx`: Already uses `space-y-6` without max-width, fine as-is

**Step 2: Update blog post page**

In `app/blog/[slug]/page.tsx`, change the article wrapper from `max-w-6xl mx-auto` to a wider layout. Blog content text should still be readable, so use a `max-w-prose` for the prose content area but let images and other elements fill wider:

```tsx
<article className='w-full px-4 sm:px-6 lg:px-12 py-8 md:py-12'>
    {/* ... cover image stays full-width ... */}
    <div className='max-w-4xl mx-auto'>
        {/* Back link, header, meta */}
    </div>
    <div className='prose prose-lg prose-stone max-w-none mb-12'>
        <MarkdownRender content={post.content} />
    </div>
    {/* Other sections */}
</article>
```

**Step 3: Update CommunityPage**

Replace all instances of `max-w-7xl mx-auto` with `w-full px-4 sm:px-6 lg:px-12` in CommunityPage.tsx.

**Step 4: Update UserBlogsList**

Replace `max-w-6xl mx-auto` with `w-full px-4 sm:px-6` in UserBlogsList.tsx.

**Step 5: Commit**

```bash
git add app/blog/[slug]/page.tsx components/community/CommunityPage.tsx components/blog/UserBlogsList.tsx
git commit -m "refactor(ui): remove max-width constraints, use full-width layouts"
```

### Task 7: Align UserBlogsList, WriterDashboard, and Manage Content post lists

The three dashboards (`UserBlogsList`, `WriterDashboard`, and `ContentManagement` blog tab) all display blog post lists but look different. Unify them into a consistent card-based design.

**Files:**
- Modify: `components/blog/UserBlogsList.tsx`
- Modify: `components/writer/WriterDashboard.tsx`
- Modify: `components/manage/ContentManagement.tsx`

**Step 1: Create a shared BlogPostCard component**

Create `components/blog/BlogPostCard.tsx` - a reusable card that displays a blog post with thumbnail, title, excerpt, status badge, date, and action buttons. The action buttons are customizable via a `actions` prop.

```tsx
"use client"

import Image from "next/image"
import Link from "next/link"
import { FileText, Eye, Clock, Calendar, Tag } from "lucide-react"
import type { BlogPost } from "@/utils/types/blog"
import { getBlogStatusStyle, getBlogStatusLabel } from "@/utils/blog/status-styles"
import { BLOG_CATEGORIES } from "@/utils/types/blog"
import { formatDistanceToNow } from "date-fns"

interface BlogPostCardProps {
    post: BlogPost
    actions?: React.ReactNode
    showViewLink?: boolean
    editHref?: string
}

export default function BlogPostCard({ post, actions, showViewLink, editHref }: BlogPostCardProps) {
    return (
        <div className="group bg-background border border-text/10 rounded-2xl p-5 hover:border-text/20 hover:shadow-sm transition-all flex flex-col sm:flex-row gap-5">
            <div className="relative w-full sm:w-48 h-32 bg-text/5 rounded-xl overflow-hidden shrink-0">
                {post.cover_image ? (
                    <Image src={post.cover_image} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-text/20">
                        <FileText className="w-8 h-8" />
                    </div>
                )}
                <div className={`absolute top-2 left-2 px-2 py-0.5 backdrop-blur-sm text-xs font-medium rounded-md ${getBlogStatusStyle(post.status)}`}>
                    {getBlogStatusLabel(post.status)}
                </div>
            </div>
            <div className="flex-1 min-w-0 py-1 flex flex-col">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-text/50 mb-1">
                        <span className="flex items-center gap-1 bg-text/5 px-1.5 py-0.5 rounded">
                            <Tag className="w-3 h-3" />
                            {BLOG_CATEGORIES.find((c) => c.value === post.category)?.label || post.category}
                        </span>
                        <span>·</span>
                        <span>{post.updated_at ? `Updated ${formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}` : "Just now"}</span>
                    </div>
                    <h3 className="text-xl font-bold font-serif text-text line-clamp-1 group-hover:text-primary transition-colors">{post.title}</h3>
                    <p className="text-text/60 text-sm line-clamp-2">{post.excerpt || "No excerpt"}</p>
                </div>
                <div className="mt-auto pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-text/50 font-medium">
                        <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />{post.views_count || 0} views</span>
                        {post.published_at && (
                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Published {new Date(post.published_at).toLocaleDateString()}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {showViewLink && post.status === "published" && (
                            <Link href={`/blog/${post.slug}`} target="_blank" className="p-2 text-text/40 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="View Live">
                                <Eye className="w-4 h-4" />
                            </Link>
                        )}
                        {editHref && (
                            <Link href={editHref} className="flex items-center gap-2 px-4 py-2 bg-text text-white rounded-lg hover:bg-text/90 transition-colors text-sm font-medium">
                                Edit
                            </Link>
                        )}
                        {actions}
                    </div>
                </div>
            </div>
        </div>
    )
}
```

**Step 2: Refactor WriterDashboard to use BlogPostCard**

Replace the inline post card JSX in `WriterDashboard.tsx` with `BlogPostCard`, passing a `deleteButton` as `actions`.

**Step 3: Refactor UserBlogsList to use BlogPostCard**

Replace the inline post card JSX in `UserBlogsList.tsx` with `BlogPostCard`.

**Step 4: Refactor ContentManagement blog list to use BlogPostCard**

Replace the inline post card JSX in `ContentManagement.tsx` with `BlogPostCard`, passing approve/edit/delete buttons as `actions`.

**Step 5: Commit**

```bash
git add components/blog/BlogPostCard.tsx components/writer/WriterDashboard.tsx components/blog/UserBlogsList.tsx components/manage/ContentManagement.tsx
git commit -m "refactor(blog): extract shared BlogPostCard, unify post list UI"
```

---

## Phase 3: Draft Preview with Disabled Analytics

Currently, `getBlogPostBySlug` allows draft/pending posts to be viewed only by the author, admin, or cafe owner. We need to:
1. Make the blog post page render a "Draft Preview" banner for non-published posts
2. Skip `incrementViewCount` for non-published posts
3. Disable the Share button and Report button for non-published posts
4. Show a visual indicator throughout the page that this is a draft/pending preview

### Task 8: Add draft preview state to blog post page

**Files:**
- Modify: `app/blog/[slug]/page.tsx`

**Step 1: Update BlogPostPage to handle non-published posts**

The current `BlogPostPage` always calls `incrementViewCount(post.id)` and shows the full blog with share/report buttons. Changes needed:

1. Skip `incrementViewCount` when `post.status !== "published"`
2. Pass `post.status` to the rendered UI so a "Draft Preview" banner can be shown
3. Conditionally hide/share and report buttons for non-published posts
4. Show a sticky top bar indicating "This is a draft preview" with status badge

```tsx
// In BlogPostPage:
const isPreview = post.status !== "published"

if (!isPreview) {
    incrementViewCount(post.id) // only count views for published posts
}
```

**Step 2: Add a DraftPreviewBanner component**

Create `components/blog/DraftPreviewBanner.tsx`:

```tsx
"use client"

import { getBlogStatusLabel, getBlogStatusStyle } from "@/utils/blog/status-styles"
import type { BlogStatus } from "@/utils/types/blog"
import { Eye, AlertTriangle } from "lucide-react"

interface DraftPreviewBannerProps {
    status: BlogStatus
}

export default function DraftPreviewBanner({ status }: DraftPreviewBannerProps) {
    const label = getBlogStatusLabel(status)
    const style = getBlogStatusStyle(status)

    const messages: Record<string, string> = {
        draft: "This post is a draft. Only you can see it. Page views and sharing are disabled.",
        pending: "This post is pending review. Only you and moderators can see it. Page views and sharing are disabled.",
        archived: "This post has been archived and is no longer publicly visible.",
    }

    return (
        <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-3">
            <div className="flex items-center justify-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <div className="flex items-center gap-2 text-sm text-amber-800">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
                        {label}
                    </span>
                    <span>{messages[status] || "This post is not publicly visible."}</span>
                </div>
            </div>
        </div>
    )
}
```

**Step 3: Update the blog post page to conditionally render the banner and hide features**

In `app/blog/[slug]/page.tsx`:
- Import and render `<DraftPreviewBanner status={post.status} />` at the top when `isPreview`
- Hide `ShareButton` when `isPreview`
- Hide `ReportButton` when `isPreview`
- Hide the views count when `isPreview`
- Keep all other content visible so the author can preview how it looks

**Step 4: Commit**

```bash
git add components/blog/DraftPreviewBanner.tsx app/blog/[slug]/page.tsx
git commit -m "feat(blog): add draft preview banner and disable analytics for non-published posts"
```

### Task 9: Add "Preview" button to draft/pending posts in dashboard lists

**Files:**
- Modify: `components/blog/BlogPostCard.tsx`
- Modify: `components/writer/WriterDashboard.tsx`

**Step 1: Update BlogPostCard to show a "Preview" link for draft/pending posts**

Add a preview link for non-published posts that opens `/blog/[slug]` so authors can see how their draft looks:

```tsx
{(post.status === "draft" || post.status === "pending") && (
    <Link
        href={`/blog/${post.slug}`}
        target="_blank"
        className="p-2 text-text/40 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
        title="Preview"
    >
        <Eye className="w-4 h-4" />
    </Link>
)}
```

**Step 2: Commit**

```bash
git add components/blog/BlogPostCard.tsx
git commit -m "feat(blog): add preview button for draft/pending posts"
```

### Task 10: Ensure getBlogPostBySlug correctly handles draft access

**Files:**
- No changes needed (already implemented correctly)

The existing `getBlogPostBySlug` function at line 242-248 already:
- Returns null if the post is not published and the user is not the author, admin, or cafe owner
- This means only authorized users can view drafts/pending posts via their slug URL

**Verification step:** Confirm that navigating to `/blog/draft-post-slug` when logged in as the author shows the post with the draft preview banner, and navigating when not the author returns a 404.

```bash
bun test
```

---

## Phase 4: Fix Lint and Build Errors

### Task 11: Fix existing ESLint errors and warnings

**Files:**
- Modify: `hooks/useOcrPhasedTimer.ts` (fix `Date.now()` impure call in render)
- Modify: `hooks/__tests__/useOcrPhasedTimer.test.ts` (fix unused import)
- Modify: `utils/__tests__/ocr-stream-client.test.ts` (fix unused imports)
- Modify: `utils/ocr-stream-client.ts` (fix type error on line 102)

**Step 1: Fix the type error in ocr-stream-client.ts**

At line 102, `currentPhase !== "streaming"` is flagged because the type system knows `currentPhase` can't be `"streaming"` at that point. Fix the logic:

```bash
bunx next build 2>&1 | head -30
```

Read `utils/ocr-stream-client.ts` lines 90-110 to understand the context and fix the comparison.

**Step 2: Fix the impure function call in useOcrPhacedTimer.ts**

Replace `useRef(Date.now())` with a lazy initialization pattern:

```typescript
const phaseStartRef = useRef<number>(0)
// Initialize in an effect or callback instead:
useEffect(() => {
    if (!phaseStartRef.current) phaseStartRef.current = Date.now()
}, [])
```

Or use a state variable instead of a ref with an impure initializer.

**Step 3: Fix unused imports in test files**

Remove `OcrPhase` import from `hooks/__tests__/useOcrPhasedTimer.test.ts` and unused variables from `utils/__tests__/ocr-stream-client.test.ts`.

**Step 4: Run lint to verify**

```bash
bun lint
```

**Step 5: Commit**

```bash
git add hooks/useOcrPhasedTimer.ts hooks/__tests__/useOcrPhasedTimer.test.ts utils/__tests__/ocr-stream-client.test.ts utils/ocr-stream-client.ts
git commit -m "fix: resolve lint warnings and type errors"
```

### Task 12: Fix Next.js build error

**Files:**
- Modify: `utils/ocr-stream-client.ts`

**Step 1: Fix the type comparison error**

The build fails at `utils/ocr-stream-client.ts:102:33` with: "This comparison appears to be unintentional because the types '"uploading"' and '"streaming"' have no overlap."

Read the full context around line 102 and fix the logic. The issue is that `currentPhase` is typed as `"uploading"` at that point in the control flow, so comparing it to `"streaming"` is always false. The fix depends on the intended logic - either widen the type or restructure the conditional.

**Step 2: Run build to verify**

```bash
bunx next build 2>&1 | tail -20
```

**Step 3: Commit**

```bash
git add utils/ocr-stream-client.ts
git commit -m "fix: resolve type comparison error in ocr-stream-client"
```

---

## Summary of All Changes

| Phase | Task | Description |
|-------|------|-------------|
| 1 | 1 | Remove `mode` prop from RichBlogEditor, use feature flags |
| 1 | 2 | Update `/blog/new` to use feature flags |
| 1 | 3 | Update `/blog/edit/[id]` to use feature flags |
| 1 | 4 | Remove EditStory.tsx, inline into writer edit page |
| 2 | 5 | Replace ManageLayout sidebar with full-width horizontal nav |
| 2 | 6 | Remove max-width constraints across blog/community pages |
| 2 | 7 | Extract shared BlogPostCard, unify post list UI |
| 3 | 8 | Add draft preview banner and disable analytics for non-published posts |
| 3 | 9 | Add preview button to draft/pending posts in dashboards |
| 3 | 10 | Verify draft access control (already works) |
| 4 | 11 | Fix ESLint errors and warnings |
| 4 | 12 | Fix Next.js build type error |

## Additional Recommendations

1. **Preview URL sharing**: Consider adding a shareable preview link with a token, so authors can send a preview to collaborators without giving them full access. This would require a `preview_token` column in the `blog_posts` table and a new server action.

2. **Auto-save indicator in editor**: The RichBlogEditor has auto-save via `useAutoSave`, but there's no explicit "Last saved at X" timestamp shown. Consider adding one.

3. **Draft/pending filter default in WriterDashboard**: Currently defaults to "all" status. Consider defaulting to "draft" since that's where authors spend most time.

4. **Redirect published post edits**: When editing a published post, consider showing a warning that changes will be visible immediately (or auto-save to draft first).

5. **Mobile nav in ManageLayout**: The current sidebar already has a mobile horizontal scroll. The new horizontal nav should also work well on mobile with overflow-x-auto.

6. **Consistent "Write Blog" CTA**: The profile blogs page (`/profile/blogs`) and the community page both have entry points to create posts. Ensure they all route to the same unified editor experience.