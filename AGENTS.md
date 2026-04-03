# Grounds Website - Agent Guide

This document is for coding agents working in this repo.
Follow project rules first; if something conflicts, ask a human.

## Quick Commands

### Dev/Build
- `bun dev` - Start local dev server (HTTPS).
- `bun build` - Production build.
- `bun start` - Start production server.

### Lint
- `bun lint` - Run ESLint (Next.js rules).

### Tests
- `bun test` - Run all tests (Bun test runner).
- `bun test <file-path>` - Run a single test file.
  Example: `bun test utils/data/__tests__/location-matcher.test.ts`.

### Database
- `bun db:generate` - Generate migration files.
- `bun db:push` - Push schema changes (dev).
- `bun db:migrate` - Run migrations (prod).
- `bun db:studio` - Open Drizzle Studio.

### Command Notes
- Scripts live in `package.json`; use `bun <script>` or `bun run <script>`.
- No Prettier config detected; keep existing formatting style.
- Tests run with JSDOM (browser env) preloaded via `bunfig.toml` → `test-setup.ts`.

## Code Style Guidelines

### Imports
- Use absolute imports with `@/` for internal modules.
- Group imports: third-party, then internal, then relative.
- Sort named imports alphabetically when convenient.
- Add `"use server"` at the very top of server actions.
- Add `"use client"` at the very top of client components.
- Example:
  ```ts
  import { useState } from "react"
  import { motion } from "motion/react"
  import { getCafeBySlug } from "@/app/api/actions/cafe"
  ```

### Formatting
- Keep existing style (no Prettier).
- Prefer double quotes in TS/TSX and JSON.
- Use trailing commas where existing code does.
- Avoid overly long lines in JSX; wrap props for readability.

### TypeScript and Types
- Strict mode is enabled; always provide proper types.
- Avoid `any`; use `unknown` when needed.
- Prefer explicit return types for server actions and utilities.
- Define shared types in `utils/types/`.
- Use Drizzle ORM generated types for DB ops.
- Use Zod for runtime validation.
- Prefer discriminated unions for action results when helpful.

### Naming
- Components: PascalCase (e.g., `CafeMap`).
- Files: kebab-case for utilities, PascalCase for components.
- Functions/variables: camelCase.
- Constants: UPPER_SNAKE_CASE (only for true constants).
- DB tables: snake_case.
- DB columns: camelCase.
- API routes: lowercase with hyphens.
- Boolean flags: `is`, `has`, `should` prefixes.

### Server Actions
- Return structured objects: `{ success: boolean, error?: string, data?: T }`.
- Check auth at the start (use `getCurrentUser()` from `@/lib/auth`).
- After mutations, call `revalidatePath()`.
- Wrap DB ops in try/catch; return user-safe messages.
- Do not throw raw errors to clients.

### Database
- Use Drizzle ORM for all queries.
- Select specific columns; avoid `*`.
- Use `eq()`, `and()`, `or()` for conditions.
- Use `desc()` for descending order.
- Prefer `leftJoin()` for optional relations.
- Use `Promise.all()` for independent queries.
- Store timestamps as ISO strings for client use.

### React Components
- Prefer Server Components; use `"use client"` only when needed.
- Functional components with hooks.
- Destructure props in the signature.
- Use interfaces for props.
- Motion: use `motion/react`.
- Use `useCallback`/`useMemo` when justified.

### Styling
- Tailwind CSS v4 (no separate config file).
- Favor utility classes over custom CSS.
- Use semantic tokens: `primary`, `secondary`, `tertiary`, `background`, `text`.
- Mobile-first responsive design.
- Use `cn()` from `@/utils/cn` for conditional classes.

### Error Handling
- Server actions: return `{ error: "message" }` objects.
- Client: show user-friendly error messages.
- Use try/catch for async flows.
- Log errors with `console.error()`.
- Validate user input before processing.

### Tests
- Place tests in `__tests__/` next to source.
- Use `describe()` for groupings.
- Use `it()`/`test()` for cases.
- Use `expect()` for assertions.
- Name test cases descriptively.

## Project Structure

- `app/` - App Router pages and routes only.
  - Allowed: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`,
    `not-found.tsx`, `route.ts`, `opengraph-image.tsx`.
  - Server actions live in `app/api/actions/`.
  - Do not place reusable components in `app/`.
- `components/` - All React components by domain.
- `db/schema/` - Drizzle schemas.
- `utils/` - Utilities.
- `utils/types/` - Shared types.
- `hooks/` - Custom hooks.
- `lib/` - Config and setup.

### Component Organization (selected)
- `components/admin/`, `components/auth/`, `components/blog/`.
- `components/cafe/`, `components/cafe-editor/`.
- `components/layout/`, `components/map/`, `components/modal/`.
- `components/reviews/`, `components/search/`, `components/ui/`.
- Follow existing domain folders before adding new ones.

## Performance Notes

- Use `revalidatePath()` after mutations.
- Lazy load heavy components when needed.
- Optimize images (see `utils/image-processing.ts`).
- Avoid unnecessary re-renders in hot paths.

## Tooling/Platform

- Package manager: Bun.
- Database: Postgres + Drizzle.
- Auth: Better Auth.
- Maps: Leaflet + react-leaflet.
- Versioning: `YEAR.FEATURE_NUM.FIXES`.

## Cursor/Copilot Rules

- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md`
  found in this repo at the time of writing.

## Git Hygiene for Agents

- Never commit or push unless explicitly asked.
- Do not amend commits unless asked.
- Do not use destructive commands (e.g., `git reset --hard`).
