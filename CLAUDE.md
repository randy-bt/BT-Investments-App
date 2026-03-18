# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (next dev)
npm run build        # Production build (next build)
npm start            # Start production server (next start)
npm run lint         # Run ESLint
```

No test framework is configured yet.

## Architecture

This is a **Next.js 16 App Router** application (React 19, TypeScript 5, Tailwind CSS 4) for a real estate investment management platform called BT Investments.

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json).

### Route Organization

All routes live under `src/app/` using file-based routing:

- **`/`** — Public landing page
- **`/app/*`** — Internal SaaS application suite:
  - **`/app/acquisitions/`** — Lead management (all-leads, new-lead, lead-record)
  - **`/app/dispositions/`** — Investor management (investor-database, new-investor, investor-record)
  - **`/app/sms-marketing/`** — SMS campaign management (campaigns, inbox, create/run campaign, templates, settings)
  - **`/app/contract-creator/`**, **`/app/marketing-page-creator/`**, **`/app/housing-market-news/`**, **`/app/settings/`**
- **`/public-pages/*`** — Public-facing pages (where-we-buy, faq, sell-property, join-buyers-list)
- **`/special-portals/*`** — Partner portals (hello, signal, infinite-re, infinite-media), each with a main page and form subpage

### Component Patterns

- Pages are **Server Components** by default
- Client Components use `"use client"` directive (e.g., `AppBackLink` which uses `useRouter`)
- Shared components live in `src/components/`
- UI uses a dashed-border design system with neutral color palette and max-width containers

### Current State

Phase 1 structural prototype — pages are wireframes with placeholder content marked by `[ ]` comments. No backend, database, or API integrations yet.
