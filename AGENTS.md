# Grounds Website - Agent Guide

## Development Commands

### Build & Development
- `bun dev` - Start development server with HTTPS
- `bun build` - Build for production
- `bun start` - Start production server
- `bun lint` - Run ESLint

### Database
- `bun db-push` - Push schema changes to database (development)
- `bun db-migrate` - Run database migrations (production)
- `bun db-studio` - Open Drizzle Studio for database inspection

### Testing
- `bun test` - Run all tests
- `bun test <file-path>` - Run a single test file (e.g., `bun test utils/data/__tests__/location-matcher.test.ts`)
- Tests use Bun's test framework with `describe`, `it`, `expect`

## Code Style Guidelines

### Imports
- Use absolute imports with `@/` alias for internal modules
- Group imports: third-party first, then internal, then relative paths
- Server actions must include `"use server"` at the very top
- Client components must include `"use client"` at the very top
- Example:
  ```ts
  import { useState } from "react"
  import { motion } from "motion/react"
  import { getCafeBySlug } from "@/app/api/actions/cafe"
  ```

### TypeScript & Types
- Strict mode enabled - always provide proper types
- Define interfaces/types in `utils/types/` directory when reusable
- Use Drizzle ORM's generated types for database operations
- Use Zod for runtime validation (package includes `zod`)
- Avoid `any` - use `unknown` for truly unknown types
- Type functions explicitly, especially server actions

### Naming Conventions
- **Components**: PascalCase (e.g., `CafeMap`, `ReviewModal`)
- **Files**: kebab-case for utilities, PascalCase for components
- **Functions/Variables**: camelCase (e.g., `getCafeBySlug`, `hasWifi`)
- **Constants**: UPPER_SNAKE_CASE when truly constant
- **Database tables**: snake_case (e.g., `cafes`, `cafe_rating_stats`)
- **Database columns**: camelCase (e.g., `addressDisplay`, `hasWifi`)
- **API routes**: lowercase with hyphens (e.g., `/api/storage/upload/route.ts`)
- **Boolean flags**: `is`, `has`, `should` prefix (e.g., `isPublished`, `hasWifi`)

### Server Actions
- Always return structured objects: `{ success: boolean, error?: string, data?: T }`
- Include authentication checks at the start
- Use `getCurrentUser()` from `@/lib/auth` for user context
- Use `revalidatePath()` after mutations to update cache
- Example:
  ```ts
  "use server"
  export async function createReview(cafeId: string, rating: number, comment: string) {
    const user = await getCurrentUser()
    if (!user) return { error: "Unauthorized" }
    try {
      const [inserted] = await db.insert(reviews).values({...}).returning()
      revalidatePath(`/cafes/[slug]`)
      return { success: true, data: inserted }
    } catch (error) {
      return { error: "Failed to create review" }
    }
  }
  ```

### Database Operations
- Use Drizzle ORM for all database queries
- Always select specific columns, avoid `*` (except in rare cases)
- Use `eq()`, `and()`, `or()` for conditions
- Use `desc()` for descending order
- Use `leftJoin()` for optional relationships
- Use `Promise.all()` for parallel independent queries
- Store timestamps in ISO string format for client consumption

### React Components
- Use `"use client"` only when necessary (hooks, event handlers, browser APIs)
- Prefer server components by default
- Use functional components with hooks
- Destructure props in function signature
- Use TypeScript interfaces for props
- Motion library for animations: `motion/react`
- Use `useCallback` and `useMemo` for performance optimization

### Styling
- Use Tailwind CSS v4 (no separate config file)
- Prefer utility classes over custom CSS
- Use semantic color tokens: `primary`, `secondary`, `tertiary`, `background`, `text`
- Responsive design: mobile-first approach
- Use `cn()` utility for conditional class merging (from `@/utils/cn`)
- Example:
  ```tsx
  className="w-full p-4 bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors"
  ```

### Error Handling
- Server actions: return `{ error: "message" }` objects
- Client components: display user-friendly error messages
- Use try/catch for async operations
- Log errors with `console.error()` for debugging
- Validate user input before processing

### File Structure
- `app/` - Next.js App Router (pages and API routes)
  - **IMPORTANT:** Only page files (`page.tsx`), layout files (`layout.tsx`), API routes (`route.ts`), and server actions belong here
  - NEVER place React components in `/app` - they must go in `/components/`
- `components/` - ALL React components must be stored here, organized by domain
  - See "Component Organization" section above for detailed structure
- `app/api/actions/` - Server actions (grouped by domain)
- `db/schema/` - Drizzle database schema definitions
- `utils/` - Utility functions and helpers
- `utils/types/` - Shared TypeScript type definitions
- `hooks/` - Custom React hooks
- `lib/` - Configuration and setup (auth, db connection)

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

### Testing
- Place test files in `__tests__/` directories alongside source code
- Use `describe()` to group related tests
- Use `it()` or `test()` for individual test cases
- Use `expect()` for assertions
- Describe test cases with descriptive names (e.g., `P1-T01: Cebu City, Cebu, Region VII`)

### Additional Notes
- Package manager: Bun (required)
- Database: PostgreSQL with Drizzle ORM
- Authentication: Better Auth
- State management: React hooks, Context API
- Forms: Controlled components with validation
- Images: Use optimized image handling, compression utilities in `utils/image-processing.ts`
- Maps: Leaflet with react-leaflet
- Versioning follows: `YEAR.FEATURE_NUM.FIXES` format

### ESLint
- Uses Next.js recommended configs
- Lint before committing: `bun lint`
- Fix linting errors before pushing

### Performance
- Use `revalidatePath()` strategically after mutations
- Lazy load heavy components when appropriate
- Optimize images (compression utilities available)
- Use `useCallback` for event handlers passed to child components
- Use `useMemo` for expensive computations

### Git Workflow
- NEVER commit changes unless explicitly requested by the user
- NEVER push to remote repositories unless explicitly requested
- This is VERY IMPORTANT - only commit and push when explicitly asked
