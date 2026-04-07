# Grounds

Community-driven platform for discovering, reviewing, and supporting cafes across the Philippines. Includes map-based exploration, profiles, submissions, events, subscriptions, and blog workflows built on Next.js and PostgreSQL.

## Key Features

- Cafe discovery with map search, filters, and reviews
- Community submissions for cafes and events
- User profiles, collections, and supporter badges
- Owner claims and subscription management
- Blog editor with AI-assisted excerpting and moderation checks
- Admin/Moderator tools for content and community management

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Auth**: Better Auth (email/password, Google, Discord, passkey)
- **Maps**: Leaflet + React Leaflet
- **Email**: Resend + React Email
- **Storage**: Cloudflare R2 (S3-compatible)
- **AI**: OpenAI-compatible API
- **Package Manager**: Bun

## Getting Started

### Prerequisites

- [Bun](https://bun.sh)
- PostgreSQL 15+
- Node.js 20+ (required by Next.js tooling)

### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/AdrianBonpin/grounds-website.git
cd grounds-website
bun install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables below)

# 3. Push database schema
bun db-push

# 4. Start the dev server
bun dev
```

The app runs at `https://localhost:3000`. The dev server uses HTTPS via `next dev --experimental-https` — accept the self-signed certificate warning in your browser.

### First-Time Setup Checklist

- [ ] `.env.local` has all **Required** variables filled in
- [ ] PostgreSQL is running and `DATABASE_URL` is correct
- [ ] `bun db-push` completed without errors
- [ ] Dev server starts and you can load the homepage
- [ ] You can sign up / log in via Google or Discord OAuth

If any step fails, check [Troubleshooting](#troubleshooting) below.

## Project Structure

```
grounds-website/
├── app/                        Next.js App Router — pages, layouts, routes
│   ├── api/                    API routes and server-only logic
│   │   ├── actions/            Server actions (cafe, blog, auth, etc.)
│   │   ├── auth/               Better Auth catch-all route
│   │   ├── chat/               AI chat endpoint
│   │   ├── cron/               Scheduled job endpoints
│   │   ├── storage/            File upload endpoints
│   │   └── webhooks/           Ko-fi, HelixPay webhooks
│   ├── cafes/                  Cafe detail pages
│   ├── blog/                   Blog listing and detail pages
│   ├── community/              Community pages
│   ├── manage/                 Admin/Moderator dashboard
│   ├── map/                    Map exploration page
│   ├── owner/                  Cafe owner dashboard
│   ├── profile/                User profile pages
│   ├── submit/                 Cafe submission flow
│   └── writer/                 Blog writer/editor
├── components/                 React components, organized by domain
│   ├── admin/                  Admin-specific UI
│   ├── auth/                   Login, signup, auth guards
│   ├── blog/                   Blog rendering and editor components
│   ├── cafe/                   Cafe cards, details, filters
│   ├── cafe-editor/            Cafe profile editing UI
│   ├── chat/                   AI chat widget
│   ├── collections/            User collections
│   ├── events/                 Event components
│   ├── landing/                Landing/homepage sections
│   ├── layout/                 Navbar, footer, sidebar, shell
│   ├── manage/                 Admin dashboard components
│   ├── map/                    Map markers, popups, controls
│   ├── modal/                  Reusable modal/dialog system
│   ├── owner/                  Owner dashboard components
│   ├── profile/                User profile components
│   ├── reviews/                Review forms and display
│   ├── search/                 Search UI and logic
│   ├── submit/                 Submission form components
│   └── ui/                     Generic UI primitives (buttons, inputs, etc.)
├── db/                         Drizzle ORM
│   └── schema/                 Database table schemas
├── drizzle/
│   └── migrations/             Generated SQL migrations
├── emails/                     React Email templates
├── hooks/                      Custom React hooks
├── lib/                        Config and setup (auth, db client, etc.)
├── public/                     Static assets
├── scripts/                    CLI scripts (e.g., LLM model listing)
├── utils/                      Shared utilities
│   ├── ai/                     AI/LLM helpers
│   ├── blog/                   Blog-related utilities
│   ├── data/                   Data fetching and transformation
│   ├── map/                    Map/geo utilities
│   ├── storage/                R2 upload helpers
│   ├── types/                  Shared TypeScript types
│   └── validation/             Zod schemas and validators
├── assets/                     Logos, stamps, design assets
├── docs/                       Project documentation
├── AGENTS.md                   Guide for coding agents
└── README.md                   You are here
```

### Key Conventions

- **Server actions** live in `app/api/actions/` — not in components or pages.
- **Reusable components** go in `components/<domain>/` — never inside `app/`.
- **Shared types** go in `utils/types/`.
- **Custom hooks** go in `hooks/`.
- **Client components** must have `"use client"` at the top.
- **Server actions** must have `"use server"` at the top.

See [AGENTS.md](AGENTS.md) for the full coding style guide.

## Architecture Overview

### Request Flow

```
Browser → Next.js App Router (page/route)
  → Server Component (default) or Client Component ("use client")
    → Server Action ("use server") for mutations
      → Drizzle ORM → PostgreSQL
      → RevalidatePath() → fresh data on next render
```

### Auth Flow

Better Auth handles authentication with Drizzle-backed sessions in Postgres.

- Routes mounted at `app/api/auth/[...all]/route.ts`
- Supports email/password, Google OAuth, Discord OAuth, and passkeys
- Use `getCurrentUser()` from `@/lib/auth` in server actions to check auth

### File Upload Flow

```
Client (react-dropzone) → presigned URL request
  → API route generates R2 presigned URL
    → Client uploads directly to Cloudflare R2
      → Public URL via R2_PUBLIC_URL CDN
```

Uploads are organized by domain prefix: `cafes/`, `reviews/`, `avatars/`, `events/`, `blogs/`.

### AI Features

AI features use an OpenAI-compatible API and are optional. Set `OPENAI_COMPATIBLE_BASE_URL` and `OPENAI_COMPATIBLE_API_KEY` to enable:

- Blog excerpt generation
- Blog content moderation checks
- AI chat assistant for cafe discovery

Disable the chat widget with `CHAT_ENABLED=false` or via `/manage/system/settings`.

## Development Workflow

### Branch Strategy

```
dev (active development)
  └── feature/<name> (feature branches, optional)
prod (production, deployed)
```

- All work happens on `dev`.
- Use feature branches for larger changes (`feature/ai-chat-rate-limit`).
- Merge `dev` → `prod` for releases using `bun merge`.

### Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Examples:
  feat: add cafe bookmarking
  feat(community-blog): remove model selector
  fix: resolve build errors
  chore: delete deprecated cron routes
  docs: clarify mall cafe guidelines
  style: fix lint errors
```

**Types**: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`

**Scopes** (optional): `cafe`, `blog`, `community-blog`, `auth`, `map`, `owner`, `manage`, `nav`, `ai`, etc. Use the domain or feature area.

### Merging to Production

```bash
bun merge
```

This runs: `git checkout prod && git merge dev && git push origin prod && git checkout dev`.

## Environment Variables

Environment values live in `.env.local`. The example template is `.env.example`.

### Required

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_URL` | Better Auth base URL (match app URL) |
| `BETTER_AUTH_SECRET` | Better Auth secret for signing tokens |
| `NEXT_PUBLIC_SITE_URL` | Public base URL used in metadata/emails |
| `NEXT_PUBLIC_APP_URL` | Auth base URL used by Better Auth client |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `DISCORD_CLIENT_ID` | Discord OAuth client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key ID |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | Public CDN base URL for uploaded assets |

### Required for production/admin

| Variable | Description |
| --- | --- |
| `ADMIN_USER_IDS` | Comma-separated Better Auth user IDs for admins |
| `CRON_SECRET` | Shared secret for cron endpoints |

### Optional

| Variable | Description |
| --- | --- |
| `OPENAI_COMPATIBLE_BASE_URL` | OpenAI-compatible API base URL |
| `OPENAI_COMPATIBLE_API_KEY` | OpenAI-compatible API key |
| `OPENAI_COMPATIBLE_EXCERPT_MODEL` | Model used for blog excerpts |
| `OPENAI_COMPATIBLE_MODEL` | Model used for AI chat (default: gpt-4o-mini) |
| `BLOG_CHECK_MODEL` | Model used for blog moderation checks |
| `CHAT_ENABLED` | Set to "false" to disable AI chat |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications |
| `KOFI_WEBHOOK_VERIFICATION_TOKEN` | Ko-fi webhook verification token |
| `HELIX_API_KEY` | HelixPay API key |
| `HELIX_WEBHOOK_SECRET` | HelixPay webhook secret |
| `HELIX_PRO_PRODUCT_ID` | HelixPay product ID for Pro tier |
| `HELIX_PREMIUM_PRODUCT_ID` | HelixPay product ID for Premium tier |
| `HIDDEN_GEM_VISITOR_THRESHOLD` | Threshold for hidden gem evaluation |

## Scripts

| Command | Description |
| --- | --- |
| `bun dev` | Start dev server (HTTPS) |
| `bun build` | Production build |
| `bun start` | Start production server |
| `bun lint` | Run ESLint |
| `bun test` | Run tests (Bun test runner) |
| `bun db-push` | Push schema changes to database |
| `bun db-migrate` | Run database migrations |
| `bun db-studio` | Open Drizzle Studio |
| `bun merge` | Merge `dev` branch into `prod` |
| `bun run llm:models` | List available AI models |
| `bun generate:icons` | Regenerate all PWA icons from source |
| `./scripts/generate-icons.sh` | Regenerate all PWA icons from source |

### PWA Icons

The site supports "Add to Home Screen" on iOS and Android. Icons and metadata are configured in two places:

- `app/manifest.ts` — Android web app manifest (name, icons, theme, display mode)
- `app/layout.tsx` — iOS meta tags via Next.js metadata API (`appleWebApp`, `icons.apple`)

#### Source icon

The single source of truth is `public/icon.png` (2048x2048 PNG, no transparency). All other icon files are generated from this.

#### Regenerating icons

After replacing `public/icon.png` with a new design, run:

```bash
bun generate:icons
```

This generates all required sizes using macOS `sips`:

- **Apple**: 57, 60, 72, 76, 114, 120, 144, 152, 180
- **Android**: 36, 48, 72, 96, 144, 192
- **Favicon**: 16, 32, 96
- **MS**: 70, 144, 150, 310

#### Icon design tips

- **iOS**: The icon is a flat PNG. Design the final look into the image — there's no layering or glass effect for web app icons.
- **Android (maskable)**: Keep critical elements (logo, text) inside the center ~80% of the canvas. The outer 20% may be clipped by device-specific masks (circle, squircle, rounded square). The 192x192 icon has `purpose: "maskable"` in the manifest.
- **Start at 1024x1024 minimum** (2048x2048 preferred). Use a solid background — no transparency.

## Testing and Linting

```bash
bun test              # Run all tests
bun test <file-path>  # Run a single test file
bun lint              # Run ESLint
```

Tests live in `__tests__/` directories next to their source files.

## Database

- Schema lives in `db/schema/`.
- Migrations in `drizzle/migrations/`.
- Use `bun db-push` for schema sync in development.
- Use `bun db-migrate` for production migrations.
- Open `bun db-studio` to browse data with Drizzle Studio.

## Webhooks and Cron Jobs

### Ko-fi webhook

- Endpoint: `POST /api/webhooks/kofi`
- Required: `KOFI_WEBHOOK_VERIFICATION_TOKEN`

### HelixPay webhook

- Endpoint: `POST /api/webhooks/helix`
- Required: `HELIX_WEBHOOK_SECRET`

### Cron endpoints (protected by `CRON_SECRET`)

- `GET /api/cron/check-subscriptions`
- `GET /api/cron/hidden-gems`

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://localhost:3000/api/cron/hidden-gems
```

## Deployment

- Ensure all required environment variables are set in the hosting provider.
- Use `bun build` followed by `bun start` for production.
- Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` to the production domain.
- Protect cron endpoints with a strong `CRON_SECRET` and call them from your scheduler.

## Versioning

This project uses a custom versioning scheme: `YEAR.FEATURE_NUM.FIXES` (e.g., `2026.13.0`).

## Troubleshooting

### Database connection issues

Check `DATABASE_URL` and ensure PostgreSQL is running:

```bash
psql "postgresql://user:password@localhost:5432/grounds"
```

### AI model list fails

Ensure `OPENAI_COMPATIBLE_BASE_URL` and `OPENAI_COMPATIBLE_API_KEY` are set:

```bash
bun run llm:models
```

### Cron endpoints return 401

Verify the `Authorization` header matches `CRON_SECRET`.

### HTTPS certificate warnings

The dev server uses self-signed certificates. Accept the browser warning or add the cert to your system trust store. Certificates live in `certificates/`.
