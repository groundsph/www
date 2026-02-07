# Component Reorganization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize all React components from the `/app` directory into the `/components` directory with a clear, functional structure, and update AGENTS.md to enforce this rule.

**Architecture:** Move all non-page components (anything not named `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, or API files) from `/app` to `/components`. Organize components by functional domain with logical subdirectories. Update all import paths in consuming files.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Drizzle ORM

---

## Task 1: Create New Component Directories

**Files:**
- Create: `components/cafe/` (directory)
- Create: `components/landing/` (directory)
- Create: `components/layout/` (directory)
- Create: `components/map/` (directory)
- Create: `components/manage/` (directory)
- Create: `components/menu/` (directory)
- Create: `components/modal/` (directory)
- Create: `components/recent/` (directory)

**Step 1: Create directory structure**

```bash
mkdir -p components/{cafe,landing,layout,map,manage,menu,modal,recent}
```

**Step 2: Verify directories created**

Run: `ls -la components/`
Expected: See new directories `cafe/`, `landing/`, `layout/`, `map/`, `manage/`, `menu/`, `modal/`, `recent/`

**Step 3: Commit**

```bash
git add components/
git commit -m "refactor: create new component directories for better organization"
```

---

## Task 2: Move Cafe Detail Components

**Files:**
- Move: `app/cafes/[slug]/components/CafeMobileContent.tsx` → `components/cafe/CafeMobileContent.tsx`
- Move: `app/cafes/[slug]/components/CafeHero.tsx` → `components/cafe/CafeHero.tsx`
- Move: `app/cafes/[slug]/components/CafeHeroImage.tsx` → `components/cafe/CafeHeroImage.tsx`
- Move: `app/cafes/[slug]/components/CafeTabs.tsx` → `components/cafe/CafeTabs.tsx`
- Move: `app/cafes/[slug]/components/CafeSidebar.tsx` → `components/cafe/CafeSidebar.tsx`
- Move: `app/cafes/[slug]/components/RatingDistribution.tsx` → `components/cafe/RatingDistribution.tsx`

**Step 1: Move cafe detail components**

```bash
mv app/cafes/\[slug\]/components/CafeMobileContent.tsx components/cafe/
mv app/cafes/\[slug\]/components/CafeHero.tsx components/cafe/
mv app/cafes/\[slug\]/components/CafeHeroImage.tsx components/cafe/
mv app/cafes/\[slug\]/components/CafeTabs.tsx components/cafe/
mv app/cafes/\[slug\]/components/CafeSidebar.tsx components/cafe/
mv app/cafes/\[slug\]/components/RatingDistribution.tsx components/cafe/
```

**Step 2: Verify files moved**

Run: `ls -la components/cafe/`
Expected: See all 6 cafe component files

**Step 3: Remove empty components directory**

```bash
rmdir app/cafes/\[slug\]/components/
```

**Step 4: Update imports in consuming files**

Find all files importing from `app/cafes/[slug]/components/` and update to `@/components/cafe/`

**Step 5: Commit**

```bash
git add components/cafe/ app/
git commit -m "refactor: move cafe detail components to /components/cafe/"
```

---

## Task 3: Move Menu Components

**Files:**
- Move: `app/cafes/[slug]/menu/MenuHeader.tsx` → `components/menu/MenuHeader.tsx`
- Move: `app/cafes/[slug]/menu/MenuContent.tsx` → `components/menu/MenuContent.tsx`

**Step 1: Move menu components**

```bash
mv app/cafes/\[slug\]/menu/MenuHeader.tsx components/menu/
mv app/cafes/\[slug\]/menu/MenuContent.tsx components/menu/
```

**Step 2: Verify files moved**

Run: `ls -la components/menu/`
Expected: See both menu component files

**Step 3: Remove empty menu directory**

```bash
rmdir app/cafes/\[slug\]/menu/
```

**Step 4: Update imports in consuming files**

Find all files importing from `app/cafes/[slug]/menu/` and update to `@/components/menu/`

**Step 5: Commit**

```bash
git add components/menu/ app/
git commit -m "refactor: move menu components to /components/menu/"
```

---

## Task 4: Move Manage Components

**Files:**
- Move: `app/manage/cafes/components/SubscriptionsTable.tsx` → `components/manage/SubscriptionsTable.tsx`
- Move: `app/manage/content/components/BlogReportsPanel.tsx` → `components/manage/BlogReportsPanel.tsx`
- Move: `app/manage/cafes/CafesManagement.tsx` → `components/manage/CafesManagement.tsx`
- Move: `app/manage/StatsCards.tsx` → `components/manage/StatsCards.tsx`
- Move: `app/manage/FeaturedScheduleManager.tsx` → `components/manage/FeaturedScheduleManager.tsx`
- Move: `app/manage/content/ContentManagement.tsx` → `components/manage/ContentManagement.tsx`
- Move: `app/manage/system/SystemManagement.tsx` → `components/manage/SystemManagement.tsx`
- Move: `app/manage/preview/[id]/CafeEditor.tsx` → `components/manage/CafeEditor.tsx`
- Move: `app/manage/community/CommunityManagement.tsx` → `components/manage/CommunityManagement.tsx`
- Move: `app/manage/ManageLayoutClient.tsx` → `components/manage/ManageLayout.tsx`

**Step 1: Move management components**

```bash
mv app/manage/cafes/components/SubscriptionsTable.tsx components/manage/
mv app/manage/content/components/BlogReportsPanel.tsx components/manage/
mv app/manage/cafes/CafesManagement.tsx components/manage/
mv app/manage/StatsCards.tsx components/manage/
mv app/manage/FeaturedScheduleManager.tsx components/manage/
mv app/manage/content/ContentManagement.tsx components/manage/
mv app/manage/system/SystemManagement.tsx components/manage/
mv app/manage/preview/\[id\]/CafeEditor.tsx components/manage/
mv app/manage/community/CommunityManagement.tsx components/manage/
mv app/manage/ManageLayoutClient.tsx components/manage/ManageLayout.tsx
```

**Step 2: Verify files moved**

Run: `ls -la components/manage/`
Expected: See all 10 management component files

**Step 3: Clean up empty directories**

```bash
rmdir app/manage/cafes/components/ app/manage/content/components/ app/manage/cafes/ app/manage/content/ app/manage/system/ app/manage/preview/\[id\]/ app/manage/preview/ app/manage/community/ 2>/dev/null || true
```

**Step 4: Update imports in consuming files**

Find all files importing from `app/manage/...` and update to `@/components/manage/`

**Step 5: Commit**

```bash
git add components/manage/ app/manage/
git commit -m "refactor: move management components to /components/manage/"
```

---

## Task 5: Move Client Components - Part 1 (Auth, Owner, Submit)

**Files:**
- Move: `app/auth/AuthPageClient.tsx` → `components/auth/AuthPage.tsx`
- Move: `app/owner/OwnerDashboardClient.tsx` → `components/owner/OwnerDashboard.tsx`
- Move: `app/owner/cafes/[slug]/edit/CafeEditClient.tsx` → `components/owner/CafeEdit.tsx`
- Move: `app/owner/cafes/[slug]/CafeManagementClient.tsx` → `components/owner/CafeManagement.tsx`
- Move: `app/submit/SubmitPageClient.tsx` → `components/submit/SubmitPage.tsx`

**Step 1: Create auth and owner directories**

```bash
mkdir -p components/auth components/owner
```

**Step 2: Move client components**

```bash
mv app/auth/AuthPageClient.tsx components/auth/AuthPage.tsx
mv app/owner/OwnerDashboardClient.tsx components/owner/OwnerDashboard.tsx
mv app/owner/cafes/\[slug\]/edit/CafeEditClient.tsx components/owner/CafeEdit.tsx
mv app/owner/cafes/\[slug\]/CafeManagementClient.tsx components/owner/CafeManagement.tsx
mv app/submit/SubmitPageClient.tsx components/submit/SubmitPage.tsx
```

**Step 3: Verify files moved**

Run: `ls -la components/auth/ components/owner/`
Expected: See moved files in respective directories

**Step 4: Clean up empty directories**

```bash
rmdir app/owner/cafes/\[slug\]/edit/ app/owner/cafes/\[slug\]/ app/owner/cafes/ app/owner/ 2>/dev/null || true
```

**Step 5: Update imports in consuming files**

Find all files importing from these locations and update paths

**Step 6: Commit**

```bash
git add components/auth/ components/owner/ components/submit/ app/auth/ app/owner/ app/submit/
git commit -m "refactor: move auth, owner, and submit client components to /components/"
```

---

## Task 6: Move Client Components - Part 2 (Writer, Profile, Contact, Donate)

**Files:**
- Move: `app/writer/WriterDashboard.tsx` → `components/writer/WriterDashboard.tsx`
- Move: `app/writer/[id]/edit/EditStoryClient.tsx` → `components/writer/EditStory.tsx`
- Move: `app/contact/ContactPageClient.tsx` → `components/contact/ContactPage.tsx`
- Move: `app/donate/SupporterSection.tsx` → `components/landing/SupportersSection.tsx`

**Step 1: Create directories**

```bash
mkdir -p components/writer components/contact
```

**Step 2: Move client components**

```bash
mv app/writer/WriterDashboard.tsx components/writer/
mv app/writer/\[id\]/edit/EditStoryClient.tsx components/writer/EditStory.tsx
mv app/contact/ContactPageClient.tsx components/contact/
mv app/donate/SupporterSection.tsx components/landing/
```

**Step 3: Verify files moved**

Run: `ls -la components/writer/ components/contact/ components/landing/`
Expected: See moved files in respective directories

**Step 4: Clean up empty directories**

```bash
rmdir app/writer/\[id\]/edit/ app/writer/\[id\]/ app/writer/ 2>/dev/null || true
```

**Step 5: Update imports in consuming files**

Find all files importing from these locations and update paths

**Step 6: Commit**

```bash
git add components/writer/ components/contact/ components/landing/ app/writer/ app/contact/ app/donate/
git commit -m "refactor: move writer, contact, and donate client components to /components/"
```

---

## Task 7: Move Profile Components

**Files:**
- Move: `app/profile/settings/SettingsClient.tsx` → `components/profile/Settings.tsx`
- Move: `app/profile/claim-supporter/ClaimSupporterClient.tsx` → `components/profile/ClaimSupporter.tsx`
- Move: `app/profile/collections/CreateCollectionModal.tsx` → `components/profile/CreateCollectionModal.tsx`
- Move: `app/profile/collections/CollectionsListClient.tsx` → `components/profile/CollectionsList.tsx`
- Move: `app/profile/collections/[id]/edit/CollectionEditorClient.tsx` → `components/profile/CollectionEditor.tsx`
- Move: `app/profile/ProfileClient.tsx` → `components/profile/Profile.tsx`
- Move: `app/profile/[username]/PublicProfileClient.tsx` → `components/profile/PublicProfile.tsx`

**Step 1: Move profile components**

```bash
mv app/profile/settings/SettingsClient.tsx components/profile/
mv app/profile/claim-supporter/ClaimSupporterClient.tsx components/profile/
mv app/profile/collections/CreateCollectionModal.tsx components/profile/
mv app/profile/collections/CollectionsListClient.tsx components/profile/
mv app/profile/collections/\[id\]/edit/CollectionEditorClient.tsx components/profile/
mv app/profile/ProfileClient.tsx components/profile/
mv app/profile/\[username\]/PublicProfileClient.tsx components/profile/
```

**Step 2: Verify files moved**

Run: `ls -la components/profile/`
Expected: See all 7 profile component files

**Step 3: Clean up empty directories**

```bash
rmdir app/profile/settings/ app/profile/claim-supporter/ app/profile/collections/\[id\]/edit/ app/profile/collections/\[id\]/ app/profile/collections/ app/profile/\[username\]/ app/profile/ 2>/dev/null || true
```

**Step 4: Update imports in consuming files**

Find all files importing from `app/profile/...` and update to `@/components/profile/`

**Step 5: Commit**

```bash
git add components/profile/ app/profile/
git commit -m "refactor: move profile client components to /components/profile/"
```

---

## Task 8: Move Community Components

**Files:**
- Move: `app/community/CommunityPageClient.tsx` → `components/community/CommunityPage.tsx`
- Move: `app/community/[slug]/CollectionViewClient.tsx` → `components/community/CollectionView.tsx`

**Step 1: Move community components**

```bash
mv app/community/CommunityPageClient.tsx components/community/
mv app/community/\[slug\]/CollectionViewClient.tsx components/community/
```

**Step 2: Verify files moved**

Run: `ls -la components/community/`
Expected: See both community component files

**Step 3: Clean up empty directory**

```bash
rmdir app/community/\[slug\]/ app/community/ 2>/dev/null || true
```

**Step 4: Update imports in consuming files**

Find all files importing from `app/community/...` and update to `@/components/community/`

**Step 5: Commit**

```bash
git add components/community/ app/community/
git commit -m "refactor: move community client components to /components/community/"
```

---

## Task 9: Reorganize Root Components to Subdirectories

**Files:**
- Move: `components/LandingHero.tsx` → `components/landing/LandingHero.tsx`
- Move: `components/SupportersSection.tsx` → `components/landing/SupportersSection.tsx` (if still at root)
- Move: `components/CafeMiniMap.tsx` → `components/map/CafeMiniMap.tsx`
- Move: `components/CafeMiniMapInternal.tsx` → `components/map/CafeMiniMapInternal.tsx`
- Move: `components/CafeMap.tsx` → `components/map/CafeMap.tsx`
- Move: `components/CafeMapWrapper.tsx` → `components/map/CafeMapWrapper.tsx`
- Move: `components/ClaimCafeModal.tsx` → `components/modal/ClaimCafeModal.tsx`
- Move: `components/ReportCafeModal.tsx` → `components/modal/ReportCafeModal.tsx`
- Move: `components/ImageLightbox.tsx` → `components/modal/ImageLightbox.tsx`
- Move: `components/navbar.tsx` → `components/layout/Navbar.tsx`
- Move: `components/Footer.tsx` → `components/layout/Footer.tsx`
- Move: `components/LayoutWrapper.tsx` → `components/layout/LayoutWrapper.tsx`
- Move: `components/NavigationProgress.tsx` → `components/ui/NavigationProgress.tsx`
- Move: `components/AnnouncementBanner.tsx` → `components/ui/AnnouncementBanner.tsx`
- Move: `components/AnalyticsBanner.tsx` → `components/ui/AnalyticsBanner.tsx`
- Move: `components/NotificationProvider.tsx` → `components/layout/NotificationProvider.tsx`
- Move: `components/AuthProvider.tsx` → `components/layout/AuthProvider.tsx`
- Move: `components/MarkdownRender.tsx` → `components/ui/MarkdownRender.tsx`
- Move: `components/RecentCard.tsx` → `components/recent/RecentCard.tsx`
- Move: `components/RecentlyAddedSection.tsx` → `components/recent/RecentlyAddedSection.tsx`
- Move: `components/RecentReviewsSection.tsx` → `components/recent/RecentReviewsSection.tsx`
- Move: `components/StoriesEventsSection.tsx` → `components/recent/StoriesEventsSection.tsx`
- Move: `components/SubmitCafeSection.tsx` → `components/recent/SubmitCafeSection.tsx`

**Step 1: Move components to new directories**

```bash
mv components/LandingHero.tsx components/landing/
mv components/CafeMiniMap.tsx components/map/
mv components/CafeMiniMapInternal.tsx components/map/
mv components/CafeMap.tsx components/map/
mv components/CafeMapWrapper.tsx components/map/
mv components/ClaimCafeModal.tsx components/modal/
mv components/ReportCafeModal.tsx components/modal/
mv components/ImageLightbox.tsx components/modal/
mv components/navbar.tsx components/layout/Navbar.tsx
mv components/Footer.tsx components/layout/
mv components/LayoutWrapper.tsx components/layout/
mv components/NavigationProgress.tsx components/ui/
mv components/AnnouncementBanner.tsx components/ui/
mv components/AnalyticsBanner.tsx components/ui/
mv components/NotificationProvider.tsx components/layout/
mv components/AuthProvider.tsx components/layout/
mv components/MarkdownRender.tsx components/ui/
mv components/RecentCard.tsx components/recent/
mv components/RecentlyAddedSection.tsx components/recent/
mv components/RecentReviewsSection.tsx components/recent/
mv components/StoriesEventsSection.tsx components/recent/
mv components/SubmitCafeSection.tsx components/recent/
```

**Step 2: Verify components moved**

Run: `ls -la components/landing/ components/map/ components/modal/ components/layout/ components/ui/ components/recent/`
Expected: See components in their respective directories

**Step 3: Update all imports in consuming files**

Find all files importing from these root-level components and update paths:
- Update imports for `navbar.tsx` to `@/components/layout/Navbar`
- Update imports for other moved components accordingly

**Step 4: Run linter to check for any broken imports**

Run: `bun lint`
Expected: No import errors

**Step 5: Commit**

```bash
git add components/
git commit -m "refactor: reorganize root-level components to functional subdirectories"
```

---

## Task 10: Move Remaining Root Components

**Files:**
- Move: `components/ActivityFeedSection.tsx` → `components/feed/ActivityFeedSection.tsx`
- Move: `components/ActivityFeedWrapper.tsx` → `components/feed/ActivityFeedWrapper.tsx`
- Move: `components/MiniSubmitCafeBanner.tsx` → `components/ui/MiniSubmitCafeBanner.tsx`
- Move: `components/MilestoneCelebration.tsx` → `components/ui/MilestoneCelebration.tsx`
- Move: `components/RandomCafeButton.tsx` → `components/map/RandomCafeButton.tsx`
- Move: `components/Loading.tsx` → `components/ui/Loading.tsx`

**Step 1: Create feed directory**

```bash
mkdir -p components/feed
```

**Step 2: Move remaining components**

```bash
mv components/ActivityFeedSection.tsx components/feed/
mv components/ActivityFeedWrapper.tsx components/feed/
mv components/MiniSubmitCafeBanner.tsx components/ui/
mv components/MilestoneCelebration.tsx components/ui/
mv components/RandomCafeButton.tsx components/map/
mv components/Loading.tsx components/ui/
```

**Step 3: Verify components moved**

Run: `ls -la components/feed/ components/ui/ components/map/`
Expected: See components in their respective directories

**Step 4: Update all imports in consuming files**

Find all files importing from these root-level components and update paths

**Step 5: Run linter to verify all imports are correct**

Run: `bun lint`
Expected: No import errors

**Step 6: Commit**

```bash
git add components/
git commit -m "refactor: move remaining root components to appropriate directories"
```

---

## Task 11: Update AGENTS.md Documentation

**Files:**
- Modify: `AGENTS.md`

**Step 1: Update File Structure section**

Add the following to the File Structure section:

```markdown
### Component Organization
- ALL React components (including Client components) MUST be stored in `/components` directory
- NEVER place component files in `/app` directory except for:
  - `page.tsx` (page files)
  - `layout.tsx` (layout files)
  - `loading.tsx` (loading states)
  - `error.tsx` (error states)
  - `not-found.tsx` (not-found states)
  - `route.ts` (API routes)
  - `opengraph-image.tsx` (OG image generation)
  - Server action files in `app/api/actions/`
- Components are organized by functional domain with subdirectories:
  - `components/admin/` - Admin-specific components
  - `components/auth/` - Authentication components
  - `components/badges/` - Badge components
  - `components/blog/` - Blog-related components
  - `components/cafe/` - Cafe detail components
  - `components/cafe-editor/` - Cafe editing components
  - `components/checkin/` - Check-in functionality
  - `components/collections/` - Collection management
  - `components/community/` - Community features
  - `components/contact/` - Contact page components
  - `components/events/` - Event components
  - `components/feed/` - Activity feed components
  - `components/landing/` - Landing page components
  - `components/layout/` - Layout components (navbar, footer, providers)
  - `components/map/` - Map-related components
  - `components/manage/` - Admin management components
  - `components/menu/` - Menu components
  - `components/modal/` - Modal components
  - `components/owner/` - Owner dashboard components
  - `components/profile/` - Profile components
  - `components/recent/` - Recent items sections
  - `components/reviews/` - Review components
  - `components/search/` - Search functionality
  - `components/social/` - Social features
  - `components/submit/` - Cafe submission components
  - `components/suggestions/` - Suggestion components
  - `components/ui/` - Reusable UI components
  - `components/writer/` - Writer dashboard components
```

**Step 2: Update File Structure section header**

Update the existing File Structure section to emphasize the component organization rule:

```markdown
### File Structure
- `app/` - Next.js App Router (pages and API routes)
  - **IMPORTANT:** Only page files (`page.tsx`), layout files (`layout.tsx`), API routes (`route.ts`), and server actions belong here
  - NEVER place React components in `/app` - they must go in `/components/`
- `components/` - ALL React components must be stored here, organized by domain
  - See "Component Organization" section above for detailed structure
- `app/api/actions/` - Server actions (grouped by domain)
```

**Step 3: Verify documentation is clear and comprehensive**

Read the updated AGENTS.md to ensure the component organization rules are clear

**Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md to enforce component organization rules"
```

---

## Task 12: Final Verification

**Files:**
- Test: All components are in `/components`
- Test: No component files remain in `/app` (except pages, layouts, API routes)

**Step 1: Search for any remaining .tsx files in /app**

Run: `find app -name "*.tsx" ! -name "page.tsx" ! -name "layout.tsx" ! -name "loading.tsx" ! -name "error.tsx" ! -name "not-found.tsx" -type f`
Expected: No results (all components moved)

**Step 2: Verify all components directory structure**

Run: `tree -L 2 components/` (or `find components -type d`)
Expected: See well-organized directory structure

**Step 3: Run linter to check for any broken imports**

Run: `bun lint`
Expected: No import errors, all imports resolve correctly

**Step 4: Run build to verify everything compiles**

Run: `bun build`
Expected: Build succeeds without errors

**Step 5: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 6: Final commit**

```bash
git add .
git commit -m "refactor: complete component reorganization - all components now in /components/"
```

---

## Summary

This plan will:
1. Create a well-organized component directory structure with functional subdirectories
2. Move all components from `/app` to `/components` with appropriate categorization
3. Update all import statements across the codebase
4. Update AGENTS.md to enforce component organization rules
5. Verify the reorganization through linting, building, and testing

**Total estimated time:** 60-90 minutes
**Total commits:** 12 commits (one per task for easy rollback if needed)
