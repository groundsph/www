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

## Phase 5: Shareable Preview Links

Currently, only the author, admin, or cafe owner can view draft/pending posts by navigating to `/blog/[slug]`. Authors have no way to share a preview link with collaborators (e.g., co-authors, editors, stakeholders) without giving them full access. We'll add a `preview_token` column and a `/blog/preview/[token]` route that allows anyone with the token to view the post in Draft Preview mode (with analytics disabled).

### Task 13: Add preview_token column to blog_posts table

**Files:**
- Modify: `db/schema/tables.ts`
- Create: Migration file (via `bun db:generate`)

**Step 1: Add previewToken column to blogPosts table**

In `db/schema/tables.ts`, add a `previewToken` column to the `blogPosts` table definition:

```typescript
// Add after the `crawlId` line (around line 373):
previewToken: text("preview_token").unique(),
```

The column should be nullable (existing posts won't have tokens), and unique (tokens must be globally unique for URL safety).

**Step 2: Generate and run the migration**

```bash
bun db:generate
bun db:push
```

**Step 3: Regenerate database types if needed**

```bash
# If using supabase gen types:
bunx supabase gen types typescript --linked > utils/types/database.types.ts
```

**Step 4: Commit**

```bash
git add db/schema/tables.ts drizzle/migrations/
git commit -m "feat(db): add preview_token column to blog_posts"
```

### Task 14: Add server actions for preview token generation and lookup

**Files:**
- Modify: `app/api/actions/blog.ts`

**Step 1: Add generatePreviewToken server action**

```typescript
export async function generatePreviewToken(postId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const post = await db.select({ id: blogPosts.id, authorId: blogPosts.authorId, status: blogPosts.status })
        .from(blogPosts).where(eq(blogPosts.id, postId)).limit(1)

    if (!post.length) return { success: false, error: "Post not found" }

    const isAdmin = await isAdminOrModerator()
    if (post[0].authorId !== user.id && !isAdmin) return { success: false, error: "Not authorized" }

    // Generate a cryptographically secure token
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").substring(0, 8)

    await db.update(blogPosts)
        .set({ previewToken: token, updatedAt: new Date() })
        .where(eq(blogPosts.id, postId))

    revalidatePath(`/blog/${post[0].slug}`)
    return { success: true, token }
}

export async function regeneratePreviewToken(postId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    // Invalidate old token and generate a new one
    return generatePreviewToken(postId)
}

export async function revokePreviewToken(postId: string): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Not authenticated" }

    const isAdmin = await isAdminOrModerator()
    const post = await db.select({ id: blogPosts.id, authorId: blogPosts.authorId })
        .from(blogPosts).where(eq(blogPosts.id, postId)).limit(1)

    if (!post.length) return { success: false, error: "Post not found" }
    if (post[0].authorId !== user.id && !isAdmin) return { success: false, error: "Not authorized" }

    await db.update(blogPosts)
        .set({ previewToken: null, updatedAt: new Date() })
        .where(eq(blogPosts.id, postId))

    return { success: true }
}
```

**Step 2: Add getBlogPostByPreviewToken server action**

```typescript
export async function getBlogPostByPreviewToken(token: string): Promise<BlogPost | null> {
    if (!token) return null

    const result = await db.select({
        id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
        content: blogPosts.content, coverImage: blogPosts.coverImage, authorId: blogPosts.authorId,
        cafeId: blogPosts.cafeId, category: blogPosts.category, status: blogPosts.status,
        tags: blogPosts.tags, images: blogPosts.images, taggedCafeIds: blogPosts.taggedCafeIds,
        crawlId: blogPosts.crawlId, featured: blogPosts.featured, viewsCount: blogPosts.viewsCount,
        publishedAt: blogPosts.publishedAt, createdAt: blogPosts.createdAt, updatedAt: blogPosts.updatedAt,
        previewToken: blogPosts.previewToken,
    })
        .from(blogPosts)
        .where(eq(blogPosts.previewToken, token))
        .limit(1)

    const post = result[0]
    if (!post) return null

    const [authorResult, cafeResult] = await Promise.all([
        post.authorId ? db.select({ id: profiles.id, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, username: profiles.username })
            .from(profiles).where(eq(profiles.id, post.authorId)).limit(1) : Promise.resolve([]),
        post.cafeId ? db.select({ id: cafes.id, name: cafes.name, slug: cafes.slug, thumbnail: cafes.thumbnail })
            .from(cafes).where(eq(cafes.id, post.cafeId)).limit(1) : Promise.resolve([]),
    ])

    return mapBlogPost(post, authorResult[0], cafeResult[0])
}
```

**Step 3: Update mapBlogPost signature to include previewToken**

The `mapBlogPost` helper needs to know about `previewToken`. Add it to the select in `getBlogPostBySlug` and `getBlogPostById` as well, and include it in the `BlogPost` interface.

In `utils/types/blog.ts`, add to the `BlogPost` interface:

```typescript
export interface BlogPost extends Omit<BlogPostRow, "search_vector"> {
    // ... existing fields
    preview_token?: string | null
}
```

**Step 4: Auto-generate preview token on post creation**

In the `createBlogPost` function, after creating the post, automatically generate a preview token for non-published statuses. When a post transitions to "published", clear the preview token:

In `createBlogPost`, after the insert, if `status !== "published"`:
```typescript
const previewToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").substring(0, 8)
await db.update(blogPosts).set({ previewToken }). .where(eq(blogPosts.id, postId))
```

**Step 5: Clear preview token on publish**

In `approveBlogPost` and `updateBlogPost` when status changes to `"published"`, set `previewToken: null`.

**Step 6: Commit**

```bash
git add app/api/actions/blog.ts utils/types/blog.ts
git commit -m "feat(blog): add preview token server actions and auto-generation"
```

### Task 15: Create preview route and page

**Files:**
- Create: `app/blog/preview/[token]/page.tsx`

**Step 1: Create the preview route page**

```tsx
// app/blog/preview/[token]/page.tsx
import { getBlogPostByPreviewToken } from "@/app/api/actions/blog"
import { notFound } from "next/navigation"
import BlogPostContent from "@/components/blog/BlogPostContent"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const post = await getBlogPostByPreviewToken(token)
    if (!post) return { title: "Preview Not Found" }
    return { title: `[Preview] ${post.title}` }
}

export default async function PreviewPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const post = await getBlogPostByPreviewToken(token)
    if (!post) notFound()

    // Preview pages never count views, never share, never report
    return <BlogPostContent post={post} isPreview />
}
```

**Step 2: Create extractable BlogPostContent component**

Extract the blog post rendering from `app/blog/[slug]/page.tsx` into a shared `BlogPostContent` component that accepts an `isPreview` prop. When `isPreview` is true:
- Show the `DraftPreviewBanner` at the top
- Hide view count, share button, report button
- Show a "Copy Preview Link" button
- Show the post status badge prominently

Create `components/blog/BlogPostContent.tsx` by extracting the JSX from `app/blog/[slug]/page.tsx` into a client component with the `isPreview` prop.

**Step 3: Refactor blog/[slug]/page.tsx to use BlogPostContent**

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const post = await getBlogPostBySlug(slug)
    if (!post) notFound()

    const isPreview = post.status !== "published"
    if (!isPreview) {
        incrementViewCount(post.id)
    }

    return <BlogPostContent post={post} isPreview={isPreview} />
}
```

**Step 4: Commit**

```bash
git add app/blog/preview/ app/blog/[slug]/page.tsx components/blog/BlogPostContent.tsx
git commit -m "feat(blog): add preview route and extract BlogPostContent component"
```

### Task 16: Add "Copy Preview Link" UI to dashboard lists

**Files:**
- Modify: `components/blog/BlogPostCard.tsx`
- Modify: `components/blog/DraftPreviewBanner.tsx`

**Step 1: Add Copy Preview Link to BlogPostCard**

For draft/pending posts that have a `preview_token`, add a "Copy Preview Link" button:

```tsx
{post.preview_token && (post.status === "draft" || post.status === "pending") && (
    <button
        onClick={async () => {
            const url = `${window.location.origin}/blog/preview/${post.preview_token}`
            await navigator.clipboard.writeText(url)
            onCopyPreviewLink?.()
        }}
        className="p-2 text-text/40 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
        title="Copy preview link"
    >
        <LinkIcon className="w-4 h-4" />
    </button>
)}
```

Add `onCopyPreviewLink?: () => void` and `showCopyPreviewLink?: boolean` props to `BlogPostCard`.

**Step 2: Add "Copy Preview Link" in DraftPreviewBanner**

For the preview page itself, add a button to copy the shareable preview URL:

```tsx
<button
    onClick={async () => {
        const url = window.location.href
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }}
    className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
>
    {copied ? "Copied!" : "Copy Preview Link"}
</button>
```

**Step 3: Commit**

```bash
git add components/blog/BlogPostCard.tsx components/blog/DraftPreviewBanner.tsx
git commit -m "feat(blog): add copy preview link buttons"
```

---

## Phase 6: Auto-Save Indicator Enhancement

The `useAutoSave` hook already tracks `AutoSaveState` with a `lastSaved` Date timestamp. The `RichBlogEditor` currently shows only "Saving...", "Saved", or "Save failed" text. We'll enhance this to show a formatted "Last saved at X" timestamp.

### Task 17: Add "Last saved at" timestamp to RichBlogEditor

**Files:**
- Modify: `components/blog/editor/types.ts`
- Modify: `components/blog/RichBlogEditor.tsx`

**Step 1: Update AutoSaveState type (if needed)**

The `AutoSaveState` already has `lastSaved?: Date` in `components/blog/editor/types.ts`. No change needed there.

**Step 2: Update RichBlogEditor to show timestamp**

In the editor header (around line 366-370 of `RichBlogEditor.tsx`), enhance the auto-save status display:

Currently:
```tsx
{saveStatusText && (
    <p className="text-xs text-text/40 mt-0.5">{saveStatusText}</p>
)}
```

Replace with:

```tsx
{autoSaveState.status === "saving" && (
    <p className="text-xs text-text/40 mt-0.5">Saving...</p>
)}
{autoSaveState.status === "saved" && autoSaveState.lastSaved && (
    <p className="text-xs text-text/40 mt-0.5">
        Saved at {autoSaveState.lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </p>
)}
{autoSaveState.status === "saved" && !autoSaveState.lastSaved && (
    <p className="text-xs text-text/40 mt-0.5">Saved</p>
)}
{autoSaveState.status === "error" && (
    <p className="text-xs text-red-500 mt-0.5">{autoSaveState.error || "Save failed"}</p>
)}
```

Remove the previous `saveStatusText` computed variable and replace all references.

**Step 3: Commit**

```bash
git add components/blog/RichBlogEditor.tsx
git commit -m "feat(blog): show auto-save timestamp in editor header"
```

---

## Phase 7: UX Improvements

### Task 18: Change WriterDashboard default filter to "draft"

**Files:**
- Modify: `components/writer/WriterDashboard.tsx`

**Step 1: Change default filter from "all" to "draft"**

In `WriterDashboard.tsx`, line 30:
```typescript
// Change from:
const [filterStatus, setFilterStatus] = useState<BlogStatus | "all">("all")
// To:
const [filterStatus, setFilterStatus] = useState<BlogStatus | "all">("draft")
```

Also update `loadPosts` to only fetch when the filter or search changes. Add a `useEffect` that triggers `loadPosts` when `filterStatus` changes:

```typescript
useEffect(() => {
    loadPosts()
}, [filterStatus])
```

**Step 2: Commit**

```bash
git add components/writer/WriterDashboard.tsx
git commit -m "feat(blog): default writer dashboard filter to draft status"
```

### Task 19: Add published post edit warning in RichBlogEditor

**Files:**
- Modify: `components/blog/RichBlogEditor.tsx`

**Step 1: Add warning banner for published posts**

When editing a post that has `status === "published"`, show a prominent warning at the top of the editor (below the header bar):

```tsx
{post?.status === "published" && (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
            <p className="text-sm font-medium text-amber-800">
                This post is already published
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
                Any changes you save will be visible to readers immediately. Consider saving as a draft first.
            </p>
        </div>
    </div>
)}
```

Import `AlertTriangle` from `lucide-react` at the top of the file (it's already imported in `DraftPreviewBanner.tsx` but needs to be added to `RichBlogEditor.tsx`'s imports if not already there — check first, it's not).

**Step 2: Add "Revert to Draft" button for published posts**

When editing a published post, add a "Revert to Draft" option alongside the "Publish Post" button:

```tsx
{post?.status === "published" && (
    <button
        onClick={() => handleSubmit("draft")}
        disabled={isSubmitting}
        className="w-full px-4 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
    >
        <ArrowDownToLine className="w-4 h-4" />
        Revert to Draft
    </button>
)}
```

Import `ArrowDownToLine` from `lucide-react`.

**Step 3: Commit**

```bash
git add components/blog/RichBlogEditor.tsx
git commit -m "feat(blog): add published post edit warning and revert-to-draft option"
```

### Task 20: Ensure mobile-friendly horizontal navigation in ManageLayout

**Files:**
- Modify: `components/manage/ManageLayout.tsx`

**Step 1: Add mobile-friendly styles**

The new horizontal nav from Task 5 already includes `overflow-x-auto`. Enhance it with:
- `scrollbar-hide` class (needs Tailwind plugin or custom CSS)
- Touch-friendly tap targets (minimum 44px height)
- Active indicator that scrolls into view on page load

Add a scroll-into-view effect for the active nav item:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
// ... existing imports

export default function ManageLayout({ children, userRole }: ManageLayoutProps) {
    const pathname = usePathname()
    const activeRef = useRef<HTMLAnchorElement>(null)

    useEffect(() => {
        // Scroll active item into view on mount
        activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }, [])

    // ... rest of component

    return (
        // In the nav item map:
        <Link
            key={item.href}
            href={item.href}
            ref={(isActive || isCafePreview) ? activeRef : undefined}
            // ... rest of props
        >
```

Also add this to `globals.css` or the component's styling to hide scrollbars:

```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

(This may already exist in the project. Check `app/globals.css` first.)

**Step 2: Commit**

```bash
git add components/manage/ManageLayout.tsx
git commit -m "feat(manage): add mobile-friendly scroll-into-view for nav"
```

### Task 21: Unify "Write Blog" CTAs across all entry points

**Files:**
- Modify: `components/blog/UserBlogsList.tsx`
- Modify: `components/blog/CommunityBlogsTab.tsx`
- Modify: `components/manage/ContentManagement.tsx`

Currently:
- `/profile/blogs` → "Write Blog" links to `/blog/new`
- `/community` (blogs tab) → No write CTA
- `/manage/content` → "New Blog Post" opens inline modal

**Step 1: Determine the correct routing for each role**

For consistency:
- **Regular users** → `/blog/new` (community post, restricted categories)
- **Writers** → `/writer/new` (writer post, writer categories)
- **Admins** → `/manage/content` with inline editor (all categories)

This routing already works correctly. The change needed is to:
1. Ensure `/profile/blogs` always routes to `/blog/new` (already does ✅)
2. Add a "Write Blog" CTA to the CommunityBlogsTab for authenticated users
3. In the manage content modal, keep the inline editor as-is (it provides all categories) ✅

**Step 2: Add "Write Blog" CTA to CommunityBlogsTab**

In `components/blog/CommunityBlogsTab.tsx`, add a conditional "Write Blog" button at the top of the blogs section that routes to `/blog/new` (the system already handles role-based access).

```tsx
import Link from "next/link"
import { Plus } from "lucide-react"

// Inside the component, before the "Latest Posts" section:
<Link
    href="/blog/new"
    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors mb-6"
>
    <Plus className="w-4 h-4" />
    Write a Post
</Link>
```

**Step 3: Commit**

```bash
git add components/blog/CommunityBlogsTab.tsx
git commit -m "feat(blog): add write post CTA to community blogs tab"
```

---

## Phase 8: Image Download in Manage Preview

The `/manage/preview/[id]` page (CafeEditor) shows images for the cover thumbnail and gallery, but there's no way to download them. This is also relevant for the blog post preview — when previewing a draft, images in the cover and gallery should be downloadable. We'll add a download button to both the cafe ImageSection and the blog BlogImageGallery lightbox.

### Task 22: Add download functionality to cafe ImageSection gallery images

**Files:**
- Modify: `components/cafe-editor/ImageSection.tsx`

**Step 1: Add download button to gallery images**

In the `ImageSection` component, each gallery image (`Reorder.Item`) already has a hover overlay with move controls and a delete button. Add a download button next to the existing controls.

Add a `handleDownloadImage` helper function at the top of the component:

```typescript
const handleDownloadImage = async (url: string, filename: string) => {
    try {
        const response = await fetch(url)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = blobUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
    } catch {
        // Fallback: open in new tab if fetch fails (CORS)
        window.open(url, "_blank")
    }
}
```

Import `Download` from `lucide-react`.

In each gallery `Reorder.Item`, add a download button in the hover overlay (alongside the move controls):

```tsx
<button
    type="button"
    onClick={(e) => {
        e.stopPropagation()
        handleDownloadImage(url, `${cafeName.replace(/\s+/g, "-").toLowerCase()}-gallery-${idx + 1}`)
    }}
    className="p-1 text-white hover:text-white/80 transition"
    title="Download image"
>
    <Download className="w-4 h-4" />
</button>
```

Place this inside the bottom control bar (`<div className="absolute bottom-2 left-2 right-2...">`) alongside the move left/right buttons. Use a flex layout with `justify-between` items: left arrow, download + right arrow.

Actually, better placement: add a download icon button next to the delete button in the top-right overlay area, since the bottom bar is for reorder controls. Add it just before the delete `<button>`:

```tsx
{/* Download Button */}
<button
    type="button"
    onClick={(e) => {
        e.stopPropagation()
        handleDownloadImage(url, `${cafeName.replace(/\s+/g, "-").toLowerCase()}-gallery-${idx + 1}`)
    }}
    className="absolute top-2 left-2 p-2 bg-white/80 text-text rounded-full md:opacity-0 group-hover:opacity-100 transition hover:bg-white z-10"
    title="Download image"
>
    <Download className="w-4 h-4" />
</button>
```

**Step 2: Add download button to cover image overlay**

In the cover image section, the hover overlay already has "Change" and delete buttons. Add a "Download" button there too:

```tsx
{thumbnail && (
    <a
        href={getCafeThumbnailUrl(thumbnail)}
        download={`${cafeName.replace(/\s+/g, "-").toLowerCase()}-cover`}
        className="flex items-center gap-2 px-4 py-2 bg-white/80 text-text rounded-lg hover:bg-white transition"
        onClick={(e) => e.stopPropagation()}
    >
        <Download className="w-4 h-4" />
        Download
    </a>
)}
```

**Step 3: Commit**

```bash
git add components/cafe-editor/ImageSection.tsx
git commit -m "feat(manage): add image download buttons to cafe preview gallery"
```

### Task 23: Add download button to blog BlogImageGallery lightbox

**Files:**
- Modify: `components/blog/BlogImageGallery.tsx`

**Step 1: Add download button in the lightbox**

The `BlogImageGallery` component has a lightbox overlay (opened when clicking an image) with close, previous/next navigation, and a counter. Add a download button in the top bar of the lightbox.

Import `Download` from `lucide-react`.

Add a download handler inside the component:

```typescript
const handleDownload = async (url: string, filename: string) => {
    try {
        const response = await fetch(url)
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = blobUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
    } catch {
        window.open(url, "_blank")
    }
}
```

Add a download button next to the close button in the lightbox:

```tsx
{/* Close and Download buttons */}
<div className="absolute top-4 right-4 flex items-center gap-2 z-10">
    <button
        className="p-2 text-white/80 hover:text-white transition-colors"
        onClick={() => handleDownload(images[selectedIndex], `blog-gallery-${selectedIndex + 1}`)}
        title="Download image"
    >
        <Download className="w-6 h-6" />
    </button>
    <button
        className="p-2 text-white/80 hover:text-white transition-colors"
        onClick={closeLightbox}
    >
        <X className="w-8 h-8" />
    </button>
</div>
```

**Step 2: Add individual download button on gallery grid thumbnails**

Also add a small download icon on hover for each thumbnail in the grid, similar to the zoom icon. This gives a quick way to download without opening the lightbox:

```tsx
{/* Download overlay on hover */}
<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
    <button
        onClick={(e) => {
            e.stopPropagation()
            handleDownload(image, `blog-gallery-${index + 1}`)
        }}
        className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition"
        title="Download"
    >
        <Download className="w-3.5 h-3.5" />
    </button>
</div>
```

**Step 3: Commit**

```bash
git add components/blog/BlogImageGallery.tsx
git commit -m "feat(blog): add download buttons to image gallery and lightbox"
```

### Task 24: Add download to admin ContentManagement blog post preview modal

**Files:**
- Modify: `components/manage/PostPreviewModal.tsx`

**Step 1: Read PostPreviewModal to understand its current structure**

The `PostPreviewModal` is used in the moderation queue to preview blog posts. Check its structure and add download buttons for any cover images or gallery images shown in the preview.

**Step 2: Add download functionality**

If `PostPreviewModal` shows images (cover image, gallery), add download buttons similar to the pattern above. Import `Download` from `lucide-react`, add a `handleDownload` helper, and place download buttons on image overlays.

For the cover image in the preview:

```tsx
{post.cover_image && (
    <div className="relative group">
        <Image src={post.cover_image} alt={post.title} fill className="object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        <button
            onClick={() => handleDownload(post.cover_image!, `${post.slug}-cover`)}
            className="absolute top-3 right-3 p-2 bg-white/80 text-text rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-white"
            title="Download cover image"
        >
            <Download className="w-4 h-4" />
        </button>
    </div>
)}
```

**Step 3: Commit**

```bash
git add components/manage/PostPreviewModal.tsx
git commit -m "feat(manage): add image download buttons to blog post preview modal"
```

### Task 25: Create shared useImageDownload hook to DRY download logic

**Files:**
- Create: `hooks/useImageDownload.ts`
- Modify: `components/cafe-editor/ImageSection.tsx`
- Modify: `components/blog/BlogImageGallery.tsx`
- Modify: `components/manage/PostPreviewModal.tsx`

**Step 1: Create the shared hook**

Extract the download logic from Tasks 22-24 into a reusable hook:

```typescript
// hooks/useImageDownload.ts
"use client"

/**
 * Hook to download images by URL.
 * Attempts fetch+blob first (for same-origin images),
 * falls back to opening in a new tab (for CORS scenarios).
 */
export function useImageDownload() {
    const download = async (url: string, filename: string) => {
        try {
            const response = await fetch(url)
            const blob = await response.blob()
            const blobUrl = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = blobUrl
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(blobUrl)
        } catch {
            // Fallback: open in new tab if fetch fails (CORS)
            window.open(url, "_blank")
        }
    }

    return { download }
}
```

**Step 2: Refactor ImageSection to use the hook**

Remove the inline `handleDownloadImage` function from `ImageSection.tsx` and use:

```typescript
import { useImageDownload } from "@/hooks/useImageDownload"

// In the component:
const { download: downloadImage } = useImageDownload()
```

**Step 3: Refactor BlogImageGallery to use the hook**

Same pattern:

```typescript
import { useImageDownload } from "@/hooks/useImageDownload"

// In the component:
const { download: downloadImage } = useImageDownload()
```

**Step 4: Refactor PostPreviewModal to use the hook**

Same pattern.

**Step 5: Commit**

```bash
git add hooks/useImageDownload.ts components/cafe-editor/ImageSection.tsx components/blog/BlogImageGallery.tsx components/manage/PostPreviewModal.tsx
git commit -m "refactor: extract shared useImageDownload hook"
```

---

## Updated Summary

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
| 5 | 13 | Add `preview_token` column to blog_posts table |
| 5 | 14 | Add server actions for preview token generation and lookup |
| 5 | 15 | Create `/blog/preview/[token]` route and extract BlogPostContent component |
| 5 | 16 | Add "Copy Preview Link" buttons to dashboards and banner |
| 6 | 17 | Show "Last saved at" timestamp in editor header |
| 7 | 18 | Default WriterDashboard filter to "draft" status |
| 7 | 19 | Add published post edit warning and revert-to-draft option |
| 7 | 20 | Add mobile-friendly scroll-into-view for manage nav |
| 7 | 21 | Unify "Write Blog" CTAs across all entry points |
| 8 | 22 | Add download buttons to cafe preview ImageSection |
| 8 | 23 | Add download buttons to BlogImageGallery lightbox and grid |
| 8 | 24 | Add download buttons to admin PostPreviewModal |
| 8 | 25 | Extract shared `useImageDownload` hook to DRY download logic |