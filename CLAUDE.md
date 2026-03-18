# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (next dev)
npm run build        # Production build (next build)
npm start            # Start production server (next start)
npm run lint         # Run ESLint
npm run test         # Run tests once (vitest run)
npm run test:watch   # Run tests in watch mode (vitest)
```

## Architecture

This is a **Next.js 16 App Router** application (React 19, TypeScript 5, Tailwind CSS 4) for a real estate investment management platform called BT Investments.

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json).

### Backend Stack

- **Supabase** — PostgreSQL database, Auth (Google OAuth), Storage (file attachments)
- **Zod v4** — Validation schemas shared between client and server
- **Resend** — Email notifications for form submissions
- **Vitest** — Test framework

### Data Flow

All internal CRUD uses **Server Actions** (`src/actions/`), not REST API routes. Server Actions return `ActionResult<T>` — a discriminated union of `{ success: true; data: T }` or `{ success: false; error: string }`.

Three API routes exist for specific needs:
- `POST /api/auth/callback` — Google OAuth callback (creates user record on first login)
- `POST /api/forms/submit` — Public form submission (no auth, rate-limited)
- `POST /api/properties/scrape` — Redfin property data scraping (auth required)

### Auth

- Google OAuth restricted to `@btinvestments.co` domain
- Two roles: `admin` and `member` — enforced in Server Actions via `requireAdmin()`/`requireAuth()`
- RLS as defense-in-depth on all tables
- Middleware (`src/middleware.ts`) handles session refresh and route protection

### Key Directories

- `src/actions/` — Server Actions (leads, investors, properties, updates, attachments, dashboard-notes, users, search)
- `src/lib/supabase/` — Supabase client factories (client.ts, server.ts, admin.ts)
- `src/lib/validations/` — Zod schemas for all entities
- `src/lib/types.ts` — Shared TypeScript types matching DB schema
- `src/lib/auth.ts` — Auth helpers (getAuthUser, requireAuth, requireAdmin)
- `supabase/migrations/` — SQL migration files (001-011)
- `src/__tests__/` — Test files

### Route Organization

- **`/`** — Public landing page
- **`/login`** — Google OAuth sign-in
- **`/app/*`** — Internal app (requires auth)
- **`/api/*`** — API routes
- **`/public-pages/*`** — Public-facing pages
- **`/special-portals/*`** — Partner portals

### Component Patterns

- Pages are **Server Components** by default
- Client Components use `"use client"` directive
- Shared components in `src/components/`
- UI uses a dashed-border design system with neutral color palette
- Editable content uses Source Code Pro font

### Current State

Phase 2 backend complete — Supabase schema, auth, server actions, search, file storage, email notifications, and property scraping all implemented. Frontend wireframes from Phase 1 are not yet connected to the backend.
