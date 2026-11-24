# Grounds Website - Agent Guide

## Commands

```bash
bun dev              # HTTPS dev server (self-signed cert; accept browser warning)
bun run build        # Production build (`bun build` is Bun's own bundler and errors)
bun start            # Production server
bun lint             # ESLint (flat config in eslint.config.mjs)
bun run test         # All tests, each file isolated (bun test --isolate; JSDOM via bunfig.toml)
bun test <file>      # Single test file, e.g. bun test utils/data/__tests__/location-matcher.test.ts
                     # Always pass --isolate (or use `bun run test`): bun module mocks are
                     # process-wide, so without it one file's mock.module()/timer stubs leak
                     # into every file that runs after it.
bun db:push          # Push schema to DB (dev)
bun db:generate      # Generate migration files
bun db:migrate       # Run migrations (prod)
bun db:studio        # Drizzle Studio
bun merge            # Stale: assumes a `dev` branch that does not exist. See "Remotes & deploys".
```

- `bun lint` runs ESLint 9 with `eslint-config-next`. No Prettier is configured.
- Self-signed certs live in `certificates/`. Dev server starts via `next dev --experimental-https`.

## Environment

- Copy `.env.example` → `.env.local`. Never commit `.env.local`.
- `drizzle.config.ts` loads `.env.local` explicitly via `dotenv`.
- `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_APP_URL` must all use `https://localhost:3000` locally.
- AI features are optional—leave `OPENAI_COMPATIBLE_*` empty to disable.
- `NEXT_PUBLIC_*` vars are inlined into the client bundle at **build** time, so they must also be set in Dokploy (the build platform), not only on the running server. This includes `NEXT_PUBLIC_CARTO_API_KEY`.

### Database environments

Two PostgreSQL databases, both reachable only over the private NetBird network. **Local `.env.local` points at the dev database, not prod.**

| | Database | Purpose |
|---|---|---|
| Local | `gph-dev` | Empty scratch database for local development. `bun db:push` creates the schema. Free to break, wipe and re-push. |
| Prod | `groundsph` | Live data. Never the target of a local script, a `db:push`, or an exploratory query. |

- Connection strings live **only** in `.env.local` (gitignored; `.env.*` is excluded apart from `.env.example`). Never write one, with its password, into a tracked file: `github.com/groundsph/www` is a **public** repository.
- To switch a machine between the two, edit `DATABASE_URL` in `.env.local`. The prod URL is kept there commented out for reference.
- `bun db:push` mirrors the schema into whichever database `DATABASE_URL` names — that is why local must never point at prod. Prod schema changes go through `bun db:migrate` with a committed migration.
- Both databases run `Etc/UTC`. Anything that reasons about calendar months or days must therefore anchor to Asia/Manila explicitly; see the Testing note below.

## Architecture

- **Next.js 16 App Router**, React 19, TypeScript strict.
- **DB**: PostgreSQL + Drizzle ORM. Schemas in `db/schema/`, migrations in `drizzle/migrations/`.
- **Auth**: Better Auth with Drizzle-backed sessions. Route at `app/api/auth/[...all]/route.ts`.
- **Storage**: Cloudflare R2 through the server — there are **no** presigned upload URLs. Flow: client posts `FormData` to `app/api/storage/upload/route.ts` (or a storage server action) → `validateFile` (extension, MIME, size, magic-byte sniff) → `PutObjectCommand` → public URL on `cdn.grounds.ph`. `getSignedUrl` is used only for reading private objects (ownership proofs).
- **Email**: Resend + React Email templates in `emails/`.
- **Maps**: Leaflet + react-leaflet.
- **Rich text**: Tiptap editor (blog writer at `app/writer/`).
- **Animations**: `motion/react` (not `framer-motion`).
- **Zod v4** for validation (`zod: ^4.2.1`).

### Key directories

| Directory | Purpose |
|---|---|
| `app/api/actions/` | Server actions (`"use server"`). Never put these in components or pages. |
| `app/api/` | API routes, webhooks, cron endpoints |
| `components/<domain>/` | All React components. Never place reusable components in `app/`. |
| `db/schema/` | Drizzle table schemas |
| `utils/` | Shared utilities, data helpers, types, validation |
| `utils/types/` | Shared TypeScript types |
| `hooks/` | Custom React hooks |
| `lib/` | Auth setup (`auth.ts`, `auth-client.ts`) |
| `emails/` | React Email templates |

### Component domains

`admin/`, `auth/`, `blog/`, `cafe/`, `cafe-editor/`, `chat/`, `collections/`, `events/`, `landing/`, `layout/`, `manage/`, `map/`, `modal/`, `owner/`, `profile/`, `reviews/`, `search/`, `submit/`, `ui/`

Add new components to the matching domain folder. Create a new domain only if none fit.

## Code conventions

- **Imports**: absolute `@/` paths (maps to project root via `tsconfig.json`). Group: third-party → internal → relative.
- **Quotes**: double quotes in TS/TSX.
- **Server actions**: return `{ success, error?, data? }`. Check auth with `getCurrentUser()` from `@/lib/auth`. Call `revalidatePath()` after mutations. Wrap DB ops in try/catch.
- **Client components**: `"use client"` at top. Prefer Server Components by default.
- **Naming**: PascalCase components, camelCase functions/vars, kebab-case utility files, snake_case DB tables, `is`/`has`/`should` prefix for booleans.
- **Styling**: Tailwind CSS v4 (PostCSS plugin `@tailwindcss/postcss`, no `tailwind.config.js`). Use `cn()` from `@/utils/cn` for conditional classes.
- **Lucide icons — dim with `opacity-*`, never a slash-alpha colour.** Lucide renders `stroke="currentColor"`, so `text-text/40` sets alpha on `color` and every stroke becomes independently translucent. Lucide icons are drawn as several sibling elements, so where two overlap their alphas composite — 0.4 over 0.4 renders at 64% — and the icon grows the dark patches at stroke intersections. Worst on multi-element icons such as `ImageUp`, `Camera`, `Ticket`, `QrCode`, `Users`, `CreditCard`, `Coffee`, `UtensilsCrossed`.

  Write the colour at full strength and dim the element instead: `className="text-text opacity-40"`, **not** `className="text-text/40"`. When a hover changes the colour, swap the opacity too and transition both properties:

  ```tsx
  <ImageUp className="w-10 h-10 text-text opacity-30 group-hover:text-primary group-hover:opacity-60 transition-[color,opacity]" />
  ```

  This applies to any icon whose dimming currently comes from a slash-alpha colour utility, decorative background icons included (`text-primary/5` → `text-primary opacity-5`). Slash-alpha on ordinary text is fine and is not covered by this rule.

  It also applies to **inherited** alpha: an icon sitting inside a dimmed row (`<div className="text-text/50">` wrapping a `<Clock />`) inherits the transparent colour and gets the same compounding. Do not rely on inheritance to dim a new icon — give the icon its own `text-*` at full strength plus `opacity-*` matching the row's alpha, so the group composites once.
- **DB**: Drizzle ORM only. Select specific columns, never `*`. Use `eq()`, `and()`, `or()` for conditions.

## Testing

- Tests live in `__tests__/` next to source files.
- JSDOM environment is preloaded via `bunfig.toml` → `test-setup.ts` (provides `document`, `window`, `navigator`, `requestAnimationFrame`, `scrollIntoView`).
- Test files are excluded from `tsconfig.json` compilation.
- **There is no CI.** Tests run only when someone runs them, so a green suite is only ever as trustworthy as the machine that ran it.
- **Timezone matters, and the databases do not share your clock.** The DB and prod servers run `Etc/UTC`; a developer machine is often somewhere else entirely. Code that derives a calendar day or month from ambient local time passes locally and fails in prod (and vice versa). Two rules: anchor month/day boundaries to Asia/Manila with explicit offset arithmetic rather than `new Date(y, m, d)`, and assert absolute instants (`2026-09-30T16:00:00Z`) rather than local getters. Run the suite twice — `bun run test` and `TZ=UTC bun run test` — before trusting a change to date logic.

## Remotes & deploys

Two remotes exist and **both must be kept in sync**:

| Remote | URL | Role |
|---|---|---|
| `origin` | `git.ranio.xyz/groundsph/www` (Gitea) | Source of truth for review. Feature branches and PRs live here. |
| `github` | `github.com/groundsph/www` (public) | What **Dokploy builds from**. |

- **Dokploy builds automatically on `prod` changes to GitHub.** Pushing to Gitea alone does *not*
  trigger a build or update production.
- `bun merge` is stale and unsafe: its script expects a `dev` branch and pushes only to `origin`.
  Never use it to deploy.
- A change is not finished until GitHub has the merge **and** Dokploy has picked it up. Build and
  deploy logs live in the Dokploy dashboard, not in the Gitea UI.
- Build-time env vars live in Dokploy — see `## Environment`.

After merging to `prod`, sync GitHub:

```sh
git checkout prod && git merge --ff-only origin/prod
git push github prod
```

## Branching

- `prod` = production. It is the default branch on both remotes and **the only branch — there is no
  `dev`**. Cut short-lived feature branches from `prod`.
- Open the PR against `prod` on **Gitea** (`tea pr create --base prod`), squash-merge, then delete the
  branch locally and on the remote. Finish by syncing `prod` to GitHub (see *Remotes & deploys*).
- Commits: Conventional Commits format. Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`. Scopes (optional): `cafe`, `blog`, `auth`, `map`, `owner`, `manage`, `ai`, etc.

## Gotchas

- Dev server uses `--experimental-https`. Browsers will warn about the self-signed cert—accept it.
- `next.config.ts` sets `images.unoptimized: true` and allows remote images from `images.unsplash.com` and `cdn.grounds.ph`.
- Server actions body size limit is 10MB (`experimental.serverActions.bodySizeLimit`).
- Versioning: `YEAR.FEATURE_NUM.FIXES` (e.g., `2026.17.0`).
- `bun db:push` for dev schema sync; `bun db:migrate` for prod. Don't mix them up.
- **No destructive SQL.** The prod database is always in use—never run `DROP TABLE`, `TRUNCATE`, `DELETE` without a `WHERE`, or any irreversible migration. Schema changes must be additive (new columns, new tables). Renaming or dropping requires a multi-step migration with a human-approved plan.
- Never commit or push unless explicitly asked. Never use destructive git commands.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
