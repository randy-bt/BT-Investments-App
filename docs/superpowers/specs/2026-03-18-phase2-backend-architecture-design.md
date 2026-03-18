# Phase 2 Backend Architecture — BT Investments

## Overview

Phase 2 adds the core backend to the existing Next.js 16 wireframe app: Supabase (database, auth, storage), Google OAuth, full CRUD for leads/investors/properties, notes system, public form handling, and global search. The architecture must support Phases 3-6 (public site polish, AI features, SMS marketing) without restructuring.

**Stack:** Next.js 16 App Router, Supabase (PostgreSQL + Auth + Storage), Resend (email), Tiptap (rich text), Redfin scraping (property data)

---

## 1. Project Structure

```
bt-investments/
├── src/
│   ├── app/
│   │   ├── api/                            # API routes (only where needed)
│   │   │   ├── forms/submit/route.ts       # Public form submissions (no auth)
│   │   │   ├── properties/scrape/route.ts  # Property data scraping
│   │   │   └── auth/callback/route.ts      # Google OAuth callback
│   │   ├── app/                            # Internal app pages (existing)
│   │   └── ...                             # Public pages (existing)
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Browser client (auth state)
│   │   │   ├── server.ts                   # Server client (Server Actions)
│   │   │   └── admin.ts                    # Service-role client (admin ops)
│   │   ├── validations/                    # Zod schemas for all entities
│   │   │   ├── leads.ts
│   │   │   ├── investors.ts
│   │   │   ├── properties.ts
│   │   │   ├── updates.ts
│   │   │   └── forms.ts
│   │   ├── email.ts                        # Resend helper
│   │   └── scraper.ts                      # Redfin property scraper
│   │
│   ├── actions/                            # Server Actions
│   │   ├── leads.ts                        # Lead CRUD + stage/status
│   │   ├── investors.ts                    # Investor CRUD + status
│   │   ├── properties.ts                   # Property CRUD
│   │   ├── updates.ts                      # Notes for leads & investors
│   │   ├── attachments.ts                  # File upload/download/delete
│   │   ├── search.ts                       # Global spotlight search
│   │   ├── users.ts                        # User management (admin)
│   │   └── dashboard-notes.ts              # Shared team notes + versioning
│   │
│   ├── components/                         # Existing + new UI components
│   └── middleware.ts                       # Auth + hostname routing
│
├── supabase/
│   └── migrations/                         # SQL migration files (version controlled)
```

### Key decisions

- **Server Actions** for all internal app CRUD — less boilerplate than REST routes, type-safe, idiomatic Next.js App Router.
- **API routes only where needed:** public form submissions (no auth), property scraping (isolated concern), OAuth callback (Supabase requirement).
- **`src/actions/`** — one file per entity, each file exports multiple server actions.
- **`src/lib/validations/`** — Zod schemas shared between client-side form validation and server-side action validation.
- **`supabase/migrations/`** — raw SQL migration files, version controlled, applied via Supabase CLI.

---

## 2. Database Schema

### Enums

```sql
CREATE TYPE user_role AS ENUM ('admin', 'member');
CREATE TYPE lead_stage AS ENUM ('follow_up', 'lead', 'marketing_on_hold', 'marketing_active', 'assigned_in_escrow');
CREATE TYPE entity_status AS ENUM ('active', 'closed');
CREATE TYPE entity_type AS ENUM ('lead', 'investor');
```

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | References Supabase auth.users |
| email | TEXT UNIQUE | Must be @btinvestments.co |
| name | TEXT | |
| role | user_role | Default: 'member' |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

#### `leads`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Default: gen_random_uuid() |
| name | TEXT NOT NULL | |
| mailing_address | TEXT | Optional |
| occupancy_status | TEXT | Optional |
| asking_price | NUMERIC | Optional |
| selling_timeline | TEXT | Optional |
| source_campaign_name | TEXT | Plain text, no FK |
| handoff_notes | TEXT | |
| date_converted | DATE | |
| stage | lead_stage | Default: 'follow_up' |
| status | entity_status | Default: 'active' |
| created_by | UUID FK → users | Who created this lead |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

#### `lead_phones`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| lead_id | UUID FK → leads ON DELETE CASCADE | |
| phone_number | TEXT NOT NULL | |
| label | TEXT | e.g., "cell", "home" |
| is_primary | BOOLEAN | Default: false |
| created_at | TIMESTAMPTZ | Default: now() |

#### `lead_emails`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| lead_id | UUID FK → leads ON DELETE CASCADE | |
| email | TEXT NOT NULL | |
| label | TEXT | |
| is_primary | BOOLEAN | Default: false |
| created_at | TIMESTAMPTZ | Default: now() |

#### `properties`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| lead_id | UUID FK → leads ON DELETE CASCADE | |
| address | TEXT NOT NULL | |
| apn | TEXT | |
| legal_description | TEXT | |
| year_built | INTEGER | |
| bedrooms | INTEGER | |
| bathrooms | NUMERIC | |
| sqft | INTEGER | |
| lot_size | TEXT | |
| property_type | TEXT | SFR, multi, land, etc. |
| owner_name | TEXT | |
| owner_mailing_address | TEXT | |
| redfin_value | NUMERIC | Estimated value |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

#### `investors`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| company | TEXT | Optional |
| locations_of_interest | TEXT NOT NULL | For future AI matching |
| deals_notes | TEXT | Rich text, dedicated section |
| status | entity_status | Default: 'active' |
| created_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

#### `investor_phones`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| investor_id | UUID FK → investors ON DELETE CASCADE | |
| phone_number | TEXT NOT NULL | |
| label | TEXT | |
| is_primary | BOOLEAN | Default: false |
| created_at | TIMESTAMPTZ | Default: now() |

#### `investor_emails`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| investor_id | UUID FK → investors ON DELETE CASCADE | |
| email | TEXT NOT NULL | |
| label | TEXT | |
| is_primary | BOOLEAN | Default: false |
| created_at | TIMESTAMPTZ | Default: now() |

#### `updates` (notes for leads and investors)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| entity_type | entity_type | 'lead' or 'investor' |
| entity_id | UUID | FK to leads or investors (not enforced at DB level, enforced in app) |
| author_id | UUID FK → users | Who wrote this update |
| content | TEXT | Rich text stored as HTML (Tiptap output) |
| created_at | TIMESTAMPTZ | Default: now() |
| updated_at | TIMESTAMPTZ | Default: now() |

#### `attachments`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| update_id | UUID FK → updates ON DELETE CASCADE | |
| file_name | TEXT NOT NULL | |
| file_type | TEXT | MIME type |
| file_size | INTEGER | Bytes |
| storage_path | TEXT NOT NULL | Path in Supabase Storage |
| created_at | TIMESTAMPTZ | Default: now() |

#### `dashboard_notes` (shared team notes)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| module | TEXT UNIQUE | 'acquisitions' or 'dispositions' |
| content | TEXT | Rich text stored as HTML |
| updated_at | TIMESTAMPTZ | Default: now() |
| updated_by | UUID FK → users | Last editor |

#### `dashboard_note_versions` (version history for revert)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| dashboard_note_id | UUID FK → dashboard_notes ON DELETE CASCADE | |
| content | TEXT | Snapshot of content at that time |
| edited_by | UUID FK → users | Who made this version |
| created_at | TIMESTAMPTZ | When this version was saved |

#### `public_form_submissions` (completely separate from app data)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| form_name | TEXT NOT NULL | e.g., "BT Investments - Sell Your Property" |
| data | JSONB | Flexible key-value for any form fields |
| submitted_at | TIMESTAMPTZ | Default: now() |
| ip_address | TEXT | Optional |
| notified | BOOLEAN | Default: false |

### Triggers

A shared `set_updated_at()` trigger function auto-updates `updated_at` on every UPDATE for: `users`, `leads`, `properties`, `investors`, `updates`, `dashboard_notes`.

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Applied to each table with: `CREATE TRIGGER ... BEFORE UPDATE ON {table} FOR EACH ROW EXECUTE FUNCTION set_updated_at();`

### Constraints

- `properties.lead_id` is `NOT NULL` — a property cannot exist without a lead
- Partial unique index on `is_primary` for phone/email tables to prevent multiple primaries per parent:
  - `CREATE UNIQUE INDEX ON lead_phones (lead_id) WHERE is_primary = true;`
  - `CREATE UNIQUE INDEX ON lead_emails (lead_id) WHERE is_primary = true;`
  - `CREATE UNIQUE INDEX ON investor_phones (investor_id) WHERE is_primary = true;`
  - `CREATE UNIQUE INDEX ON investor_emails (investor_id) WHERE is_primary = true;`
- `ON DELETE CASCADE` on child tables is intentional defense-in-depth. The app never hard-deletes leads/investors (uses status archiving), but if a record were ever removed, cascades prevent orphaned data.

### Row Level Security

RLS policies enforce defense-in-depth access control. Role-based logic (admin vs member) is primarily enforced in Server Actions for simplicity, but RLS provides a safety net:

- **All app tables:** authenticated users can SELECT. INSERT/UPDATE/DELETE require either `auth.uid() = created_by` or user has admin role.
- **`public_form_submissions`:** INSERT allowed without auth (public forms); SELECT restricted to authenticated users.
- **`updates` table:** INSERT by any authenticated user; UPDATE/DELETE only by the author (`auth.uid() = author_id`).
- **Service-role client (`admin.ts`)** bypasses all RLS. It must ONLY be used for: (a) creating user records in the auth callback, (b) admin operations that cross RLS boundaries. Never import it in client-side code.

### Indexes

- `leads(status)` — filter active vs closed
- `leads(stage)` — filter by pipeline stage
- `investors(status)` — filter active vs closed
- `properties(lead_id)` — find properties for a lead
- `updates(entity_type, entity_id)` — find notes for a lead/investor
- `attachments(update_id)` — find attachments for an update
- `dashboard_note_versions(dashboard_note_id)` — find versions for a dashboard note
- `lead_phones(lead_id)`, `lead_emails(lead_id)` — contact lookups
- `investor_phones(investor_id)`, `investor_emails(investor_id)` — contact lookups
- Full-text search GIN indexes on: `leads(name)`, `investors(name)`, `properties(address)`, `investors(locations_of_interest)`
- Phone/email searches use `ILIKE` prefix matching (not full-text search) since phone numbers and emails are structured data

---

## 3. Authentication & Authorization

### Google OAuth Flow

1. User visits `app.btinvestments.co` → middleware detects no session → redirects to `/login`
2. Login page: single "Sign in with Google" button
3. Supabase Auth handles Google OAuth
4. Callback route checks email domain — must end with `@btinvestments.co`
5. If domain mismatch → session destroyed, error shown: "Access restricted to BT Investments team"
6. On first-ever login, user record created in `users` table
7. First user (or seeded user: `randy@btinvestments.co`) gets admin role

### Middleware (`src/middleware.ts`)

```
Hostname: app.btinvestments.co (or /app/* routes in dev)
  → Check Supabase session
  → No session → redirect to /login
  → Has session → allow through

Hostname: btinvestments.co (or all other routes)
  → No auth check, allow through

Route: /api/forms/submit
  → No auth check (public)

Route: /api/* (other API routes)
  → Check Supabase session
```

### Role Enforcement

Checked in each Server Action:
- `createLead()` → requires admin
- `archiveLead()` → requires admin
- `changeLeadStage()` → requires admin
- `createInvestor()` → requires admin
- `archiveInvestor()` → requires admin
- `manageUsers()` → requires admin
- `addUpdate()` → any authenticated user
- `editUpdate()` → only the author
- `deleteUpdate()` → only the author
- `addAttachment()` → any authenticated user
- View operations → any authenticated user

---

## 4. Server Actions

Each action file exports named async functions. Pattern:

```typescript
'use server'

export async function createLead(formData: CreateLeadInput) {
  const user = await getAuthUser()        // Get session, verify auth
  requireAdmin(user)                       // Check role
  const validated = createLeadSchema.parse(formData)  // Zod validation
  const supabase = createServerClient()
  // ... insert into database
  // ... return result or error
}
```

### Standard response shape

All Server Actions return a consistent shape:

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

### Pagination

List actions (`getLeads`, `getInvestors`, `getUpdates`) accept optional pagination params:

```typescript
{ page?: number; pageSize?: number }  // defaults: page=1, pageSize=50
```

Returns: `{ items: T[]; total: number; page: number; pageSize: number }`

For spotlight search, results are capped at 10 per category (no pagination — it's a quick-find tool).

### Actions by file

**`actions/leads.ts`**: getLeads, getLead, createLead, updateLead, changeLeadStage, archiveLead, reopenLead, addLeadPhone, removeLeadPhone, addLeadEmail, removeLeadEmail

**`actions/investors.ts`**: getInvestors, getInvestor, createInvestor, updateInvestor, archiveInvestor, reopenInvestor, addInvestorPhone, removeInvestorPhone, addInvestorEmail, removeInvestorEmail, getInvestorDirectory

**`actions/properties.ts`**: getProperties, addProperty, updateProperty, removeProperty

**`actions/updates.ts`**: getUpdates, createUpdate, editUpdate, deleteUpdate

**`actions/attachments.ts`**: uploadAttachment, listAttachments, deleteAttachment, getDownloadUrl

**`actions/search.ts`**: globalSearch (spotlight-style, returns results grouped by category)

**`actions/users.ts`**: getUsers, inviteUser, removeUser, changeUserRole

**`actions/dashboard-notes.ts`**: getDashboardNote, updateDashboardNote (with autosave), getDashboardNoteVersions, revertDashboardNote

---

## 5. API Routes (3 total)

### `POST /api/forms/submit`
- No auth required
- Accepts: `{ form_name, data: { name, email, message, ...any } }`
- Validates with Zod — `form_name` must be from allowed list, `data` max payload 10KB, individual field values max 5000 chars
- Rate limited: max 5 submissions per IP per minute (using in-memory store; sufficient for this traffic level)
- Inserts into `public_form_submissions`
- Sends email via Resend to `randy@btinvestments.co`
- Subject: "New submission: {form_name}"
- Returns success/error

### `POST /api/properties/scrape`
- Auth required
- Accepts: `{ address: string }`
- Scrapes Redfin for property data
- Returns: `{ apn?, year_built?, bedrooms?, bathrooms?, sqft?, lot_size?, property_type?, owner_name?, owner_mailing_address?, redfin_value? }`
- Graceful fallback — returns whatever fields it can find

### `GET /api/auth/callback`
- Handles Google OAuth callback from Supabase
- Verifies email domain
- Creates user record if first login
- Redirects to app homepage

---

## 6. Property Scraping (Redfin)

### Approach
1. Receive address string
2. Hit Redfin's search/autocomplete endpoint with the address
3. Extract the property page URL from results
4. Fetch the property page
5. Parse HTML for: beds, baths, sqft, lot size, year built, property type, APN, estimated value
6. Return structured data

### Fallback behavior
- If Redfin search returns no results → return empty object
- If specific fields can't be parsed → omit them from response
- If scraping fails entirely → return error message
- Frontend shows "Populate" button → user clicks → loading state → fields fill in → user reviews and saves

### Technical approach
- Use HTTP fetching (not a headless browser) for speed and simplicity
- Target Redfin's stingray JSON API endpoints where possible (faster, more reliable than HTML parsing)
- Fall back to HTML parsing if JSON endpoints change

### Maintenance note
Redfin actively changes their site structure. The scraper will break periodically and need updates. This is expected. The isolated design (`src/lib/scraper.ts`) makes fixes quick — change one file, redeploy.

### Future-proofing
- Scraper is isolated in `src/lib/scraper.ts`
- Can be swapped to a paid API (ATTOM, Estated) later by changing one file
- The action and frontend don't know or care about the data source

---

## 7. File Storage (Supabase Storage)

### Bucket: `attachments`

```
attachments/
  leads/{lead_id}/{update_id}/{filename}
  investors/{investor_id}/{update_id}/{filename}
```

### Upload flow
1. User adds files to an update (note)
2. Server Action generates signed upload URL (expires in 5 minutes, scoped to specific path)
3. Client uploads directly to Supabase Storage (avoids routing large files through the server)
4. On upload complete, Server Action creates `attachments` record with storage path

### Limits
- Max file size: 25 MB per file
- Max attachments per update: 10
- Enforced in both the Supabase Storage bucket policy and the Server Action

### Supported file types
Photos (JPEG, PNG, HEIC), recordings (MP3, M4A, WAV), screenshots (PNG), documents (PDF, DOCX)

### Download
- Server Action generates signed download URL (expires in 1 hour)
- Frontend opens URL in new tab or triggers download

---

## 8. Search (Spotlight-style)

### Implementation
- PostgreSQL full-text search using `to_tsvector` / `to_tsquery`
- GIN indexes on searchable columns
- Debounced input (300ms) on the frontend

### Searchable fields
- **Leads:** name, source_campaign_name
- **Lead phones:** phone_number
- **Lead emails:** email
- **Properties:** address, apn, owner_name
- **Investors:** name, locations_of_interest
- **Investor phones:** phone_number
- **Investor emails:** email

### Response format
```typescript
{
  leads: [{ id, name, status, stage }],
  investors: [{ id, name, status }],
  properties: [{ id, address, lead_id, lead_name }]
}
```

Results grouped by category, each linking to the detail page.

### Search strategy
- Single query using `UNION ALL` across the relevant tables
- Full-text search (`to_tsvector`/`to_tsquery`) for name and text fields
- `ILIKE` prefix matching for phone numbers and emails (structured data, not natural text)
- Results capped at 10 per category
- Sufficient for a team of 2-5 with modest data volumes

---

## 9. Rich Text Editor

### Technology: Tiptap
- Lightweight, extensible, built for React
- Extensions: Bold, Italic, Underline, Strike, BulletList, OrderedList, Heading, Placeholder
- Stores content as HTML string in the database

### Font
- **Source Code Pro** for all editable content: notes, lead/investor info fields, dashboard text
- Loaded via Google Fonts or self-hosted

### Dashboard notes autosave
- Debounce: 2 seconds after typing stops
- Each save creates a new row in `dashboard_note_versions`
- Version history UI: browse timestamped versions → select one → confirm dialog ("Are you sure you want to revert to the version from {timestamp}?") → revert

### Dashboard notes concurrency
- Last-write-wins with notification: when saving, check if `updated_at` has changed since you loaded the note
- If another user edited it in the meantime, show a warning: "{User} edited this note at {time}. Your changes will overwrite theirs. Continue?"
- This is sufficient for a team of 2-5 where simultaneous edits are rare

---

## 10. Email Notifications (Resend)

### Setup
- Resend account with `btinvestments.co` domain verified
- API key stored in environment variable

### Usage
- Public form submissions → email to `randy@btinvestments.co`
- Email format: HTML email with form name as subject, form data rendered in body
- `notified` flag on `public_form_submissions` updated after send

### Future
- Can be extended for other notifications (Phase 4+) without changing architecture

---

## 11. Hosting & Domain Routing

### Vercel deployment
- Single Next.js app deployed to Vercel
- Two domains configured:
  - `btinvestments.co` → serves public pages
  - `app.btinvestments.co` → serves internal app (same deployment)

### Middleware routing
- `middleware.ts` checks `request.headers.get('host')`
- `app.btinvestments.co` requests: require auth, rewrite to `/app/*` routes if needed
- `btinvestments.co` requests: no auth, serve public pages directly
- During local development: `/app/*` path prefix used instead of hostname

---

## 12. Map Placeholder

### Current (Phase 2)
- Placeholder component at `src/components/PropertyMap.tsx`
- Accepts `address: string` prop
- Shows a styled placeholder box with the address and "Map coming soon" message
- Toggle buttons for Google Maps / Apple Maps (disabled, visually present)

### Future (when API keys available)
- Google Maps embed using Maps Embed API (free tier: 28,000 loads/month)
- Apple Maps via MapKit JS
- Toggle switches between the two views
- Both accept the address string directly — no geocoding needed

---

## 13. Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth (configured in Supabase dashboard)
# No separate env vars needed — Supabase handles OAuth provider config

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://app.btinvestments.co
NEXT_PUBLIC_SITE_URL=https://btinvestments.co

# Maps (future — leave empty for now)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_APPLE_MAPKIT_TOKEN=
```

---

## 14. Future Phase Compatibility

### Phase 3 (Public Site Frontend)
- Public forms already have backend handling — just need to replace placeholder forms with real designs
- No schema changes needed

### Phase 4 (Marketing Page Creator, Contract Creator)
- Marketing pages can be stored in a new `marketing_pages` table, linked to properties/leads
- Contract templates can live in a `contract_templates` table, generated contracts in `contracts`
- Both plug into existing lead/property data without restructuring

### Phase 5 (AI, APIs)
- AI investor matching queries `investors.locations_of_interest` — already indexed
- AI chat can use existing data via Server Actions
- Gmail/QUO integrations add new lib files, no schema changes needed

### Phase 6 (SMS Marketing)
- SMS campaigns, templates, conversations → new tables
- Can reference leads/investors via existing IDs
- Bird API integration → new lib file
- SMS marketing pages already exist in the wireframe

---

## 15. Third-Party Service Setup Guide

### Supabase
1. Create account at supabase.com
2. Create new project (choose region closest to team)
3. Note the project URL and anon key
4. Enable Google OAuth provider in Authentication settings
5. Create Storage bucket named "attachments"
6. Run migration files via Supabase CLI or dashboard SQL editor

### Google OAuth
1. Go to Google Cloud Console
2. Create or select a project
3. Enable Google Identity API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `{SUPABASE_URL}/auth/v1/callback`
6. Copy Client ID and Client Secret into Supabase Auth provider settings
7. Domain restriction (@btinvestments.co) is enforced in the app callback, not in Google

### Resend
1. Create account at resend.com
2. Add and verify `btinvestments.co` domain (requires DNS records)
3. Generate API key
4. Store in `RESEND_API_KEY` environment variable

### Vercel (deployment)
1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Add custom domains: `btinvestments.co` and `app.btinvestments.co`
4. Configure DNS at domain registrar to point to Vercel
