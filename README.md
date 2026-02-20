# Grounds

Community-driven platform for discovering, reviewing, and supporting cafes across the Philippines. Includes map-based exploration, profiles, submissions, events, subscriptions, and blog workflows built on Next.js and PostgreSQL.

## Key Features

- Cafe discovery with map search, filters, and reviews
- Community submissions for cafes and events
- User profiles, collections, and supporter badges
- Owner claims and subscription management
- Blog editor with AI-assisted excerpting and moderation checks
- Admin/Moderator tools for content and community management

## Versioning

This project uses a custom versioning scheme: `YEAR.FEATURE_NUM.FIXES` (e.g., `2026.11.0`).

## Table of Contents

- [Tech Stack](#tech-stack)
- [Versioning](#versioning)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Storage](#storage)
- [Auth](#auth)
- [AI](#ai)
- [Webhooks and Cron Jobs](#webhooks-and-cron-jobs)
- [Testing](#testing)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Deployment Notes](#deployment-notes)
- [Troubleshooting](#troubleshooting)

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

## Prerequisites

- Bun (https://bun.sh)
- PostgreSQL 15+
- Node.js 20+ (required by Next.js tooling)
- OpenAI-compatible API account (optional, for AI features)

## Getting Started

### 1) Clone and install

```bash
git clone https://github.com/AdrianBonpin/grounds-website.git
cd grounds-website
bun install
```

### 2) Configure environment

Copy the example file and update values:

```bash
cp .env.example .env.local
```

See [Environment Variables](#environment-variables) for details.

### 3) Set up the database

This project uses Drizzle with a PostgreSQL database. Run:

```bash
bun db-push
```

### 4) Start the dev server

```bash
bun dev
```

The app will be available at `https://localhost:3000`.

The dev server runs with HTTPS via `next dev --experimental-https`. If your browser warns about a self-signed certificate, you will need to accept it for local development.

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
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications |
| `KOFI_WEBHOOK_VERIFICATION_TOKEN` | Ko-fi webhook verification token |
| `HELIX_API_KEY` | HelixPay API key |
| `HELIX_WEBHOOK_SECRET` | HelixPay webhook secret |
| `HELIX_PRO_PRODUCT_ID` | HelixPay product ID for Pro tier |
| `HELIX_PREMIUM_PRODUCT_ID` | HelixPay product ID for Premium tier |
| `HIDDEN_GEM_VISITOR_THRESHOLD` | Threshold for hidden gem evaluation |

## Database

- Connection is configured via `DATABASE_URL`.
- Schema lives in `db/schema` and migrations in `drizzle/migrations`.
- Use `bun db-push` for schema sync in development.
- Use `bun db-migrate` for production migrations.

## Storage

Storage is handled via Cloudflare R2 (S3-compatible). Credentials are required:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

Uploads are organized under bucket prefixes (cafes, reviews, avatars, events, blogs, etc.).

## Auth

Authentication uses Better Auth with:

- Email/password
- Google OAuth
- Discord OAuth
- Passkey support

The Better Auth routes are mounted at `app/api/auth/[...all]/route.ts`.

## AI

AI features use an OpenAI-compatible API and are optional. To enable model listing, excerpt generation, and chat:

- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`

You can list available models with:

```bash
bun run llm:models
```

### AI Chat

The platform includes an AI chat assistant that helps users discover cafes and answers questions about locations, amenities, and reviews. See [docs/ai.md](docs/ai.md) for detailed configuration and rate limiting information.

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

Example:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://localhost:3000/api/cron/hidden-gems
```

## Testing

```bash
bun test
bun lint
```

## Available Scripts

| Command | Description |
| --- | --- |
| `bun dev` | Start dev server (HTTPS) |
| `bun build` | Production build |
| `bun start` | Start production server |
| `bun lint` | Run ESLint |
| `bun db-push` | Push schema changes to database |
| `bun db-migrate` | Run database migrations |
| `bun db-studio` | Open Drizzle Studio |
| `bun llm:models` | List available AI models |

## Project Structure

```
app/                    Next.js App Router pages and routes
components/             Reusable UI components
db/                     Drizzle schema and database client
drizzle/                Migrations
emails/                 React Email templates
hooks/                  Custom hooks
lib/                    Auth/config utilities
public/                 Static assets
scripts/                CLI scripts
utils/                  Shared utilities
```

## Architecture Overview

- App Router routes live in `app/` and server actions in `app/api/actions`.
- Auth is powered by Better Auth with Drizzle-backed sessions in Postgres.
- Media uploads go through Cloudflare R2 using bucket prefixes per domain (cafes, reviews, avatars, etc.).
- Blog tooling uses an OpenAI-compatible API for excerpts and moderation checks.

## Deployment Notes

- Ensure all required environment variables are set in the hosting provider.
- Use `bun build` followed by `bun start` for production.
- Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` to the production domain.
- Protect cron endpoints with a strong `CRON_SECRET` and call them from your scheduler.

## Troubleshooting

### Database connection issues

Check `DATABASE_URL` and ensure PostgreSQL is running. Example:

```bash
psql "postgresql://user:password@localhost:5432/grounds"
```

### AI model list fails

Ensure `OPENAI_COMPATIBLE_BASE_URL` and `OPENAI_COMPATIBLE_API_KEY` are set, then run:

```bash
bun run llm:models
```

### Cron endpoints return 401

Verify the `Authorization` header matches `CRON_SECRET`.
