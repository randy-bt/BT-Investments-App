# Phase 2 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the core backend to the BT Investments Next.js app — Supabase database/auth/storage, full CRUD for leads/investors/properties, notes system, global search, public form handling, and property data scraping.

**Architecture:** Server Actions for all internal app CRUD (no REST routes except 3 specific endpoints). Supabase for database, auth, and file storage. Middleware handles auth checks and hostname-based routing. See `docs/superpowers/specs/2026-03-18-phase2-backend-architecture-design.md` for full spec.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + Auth + Storage), Zod (validation), Resend (email), Tiptap (rich text), TypeScript 5

---

## File Map

### New files to create

```
# Dependencies & config
.env.local                                    # Environment variables (gitignored)
.env.example                                  # Template for env vars (committed)

# Supabase clients
src/lib/supabase/client.ts                    # Browser-side Supabase client
src/lib/supabase/server.ts                    # Server-side Supabase client (Server Actions, RSCs)
src/lib/supabase/admin.ts                     # Service-role client (auth callback only)

# Auth helpers
src/lib/auth.ts                               # getAuthUser(), requireAdmin(), requireAuth()

# Validation schemas
src/lib/validations/leads.ts                  # Zod schemas for lead CRUD
src/lib/validations/investors.ts              # Zod schemas for investor CRUD
src/lib/validations/properties.ts             # Zod schemas for property CRUD
src/lib/validations/updates.ts                # Zod schemas for notes/updates
src/lib/validations/forms.ts                  # Zod schemas for public form submission
src/lib/validations/users.ts                  # Zod schemas for user management
src/lib/validations/search.ts                 # Zod schemas for search input

# Shared types
src/lib/types.ts                              # ActionResult<T>, entity types, DB row types

# Utilities
src/lib/email.ts                              # Resend email helper
src/lib/scraper.ts                            # Redfin property scraper
src/lib/rate-limit.ts                         # In-memory rate limiter for public endpoints

# Server Actions
src/actions/leads.ts                          # Lead CRUD + stage/status + phone/email
src/actions/investors.ts                      # Investor CRUD + status + phone/email + directory
src/actions/properties.ts                     # Property CRUD
src/actions/updates.ts                        # Notes/updates for leads & investors
src/actions/attachments.ts                    # File upload/download/delete
src/actions/search.ts                         # Global spotlight search
src/actions/users.ts                          # User management (admin only)
src/actions/dashboard-notes.ts                # Shared team notes + version history

# API routes
src/app/api/auth/callback/route.ts            # Google OAuth callback
src/app/api/forms/submit/route.ts             # Public form submission (no auth)
src/app/api/properties/scrape/route.ts        # Property data scraping

# Auth pages
src/app/login/page.tsx                        # Login page with Google OAuth button
src/app/auth/error/page.tsx                   # Auth error page (domain mismatch)

# Middleware
src/middleware.ts                             # Auth + hostname routing

# Database migrations
supabase/migrations/001_enums.sql             # Custom enum types
supabase/migrations/002_users.sql             # Users table + RLS
supabase/migrations/003_leads.sql             # Leads + phones + emails + RLS
supabase/migrations/004_properties.sql        # Properties table + RLS
supabase/migrations/005_investors.sql         # Investors + phones + emails + RLS
supabase/migrations/006_updates.sql           # Updates (notes) table + RLS
supabase/migrations/007_attachments.sql       # Attachments table + RLS
supabase/migrations/008_dashboard_notes.sql   # Dashboard notes + versions + RLS
supabase/migrations/009_public_forms.sql      # Public form submissions + RLS
supabase/migrations/010_search_indexes.sql    # Full-text search GIN indexes
supabase/migrations/011_seed.sql              # Seed data (dashboard notes rows)

# Tests
src/__tests__/lib/validations/leads.test.ts
src/__tests__/lib/validations/investors.test.ts
src/__tests__/lib/validations/properties.test.ts
src/__tests__/lib/validations/updates.test.ts
src/__tests__/lib/validations/forms.test.ts
src/__tests__/lib/rate-limit.test.ts
```

### Existing files to modify

```
package.json                                  # Add dependencies
tsconfig.json                                 # No changes expected
src/app/layout.tsx                            # Potentially wrap with auth provider
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Create: `.env.example`, `.env.local`

- [ ] **Step 1: Install Supabase packages**

```bash
cd /Users/groovehouseent/Desktop/Bt\ Investments\ App\ Development/bt-investments
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Install validation & utility packages**

```bash
npm install zod resend
```

- [ ] **Step 3: Install test framework**

```bash
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 4: Create .env.example**

Create `.env.example` with all required environment variable keys (no values):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend
RESEND_API_KEY=

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 5: Create .env.local**

Create `.env.local` with the same keys. Values will be filled in after Supabase project is created. Verify `.env.local` is in `.gitignore`.

- [ ] **Step 6: Add vitest config and test script**

Create `vitest.config.ts` at project root:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Verify setup**

Run: `npm run build`
Expected: Build succeeds (no dependency errors)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .env.example vitest.config.ts
git commit -m "chore: add Supabase, Zod, Resend, Vitest dependencies"
```

---

## Task 2: Database Migrations

**Files:**
- Create: `supabase/migrations/001_enums.sql` through `011_seed.sql`

These migration files define the full database schema. They are applied via the Supabase dashboard SQL editor or Supabase CLI.

- [ ] **Step 1: Create migration 001_enums.sql**

```sql
-- Custom enum types
CREATE TYPE user_role AS ENUM ('admin', 'member');
CREATE TYPE lead_stage AS ENUM ('follow_up', 'lead', 'marketing_on_hold', 'marketing_active', 'assigned_in_escrow');
CREATE TYPE entity_status AS ENUM ('active', 'closed');
CREATE TYPE entity_type AS ENUM ('lead', 'investor');

-- Shared trigger function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 2: Create migration 002_users.sql**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL CHECK (email LIKE '%@btinvestments.co'),
  name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin insert/delete handled via service-role client
```

- [ ] **Step 3: Create migration 003_leads.sql**

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mailing_address TEXT,
  occupancy_status TEXT,
  asking_price NUMERIC,
  selling_timeline TEXT,
  source_campaign_name TEXT,
  handoff_notes TEXT,
  date_converted DATE,
  stage lead_stage NOT NULL DEFAULT 'follow_up',
  status entity_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX leads_status_idx ON leads(status);
CREATE INDEX leads_stage_idx ON leads(stage);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all leads"
  ON leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert leads"
  ON leads FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can update leads"
  ON leads FOR UPDATE TO authenticated USING (true);

-- Lead phones
CREATE TABLE lead_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lead_phones_lead_id_idx ON lead_phones(lead_id);
CREATE UNIQUE INDEX lead_phones_primary_idx ON lead_phones(lead_id) WHERE is_primary = true;

ALTER TABLE lead_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead phones"
  ON lead_phones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lead emails
CREATE TABLE lead_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lead_emails_lead_id_idx ON lead_emails(lead_id);
CREATE UNIQUE INDEX lead_emails_primary_idx ON lead_emails(lead_id) WHERE is_primary = true;

ALTER TABLE lead_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead emails"
  ON lead_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 4: Create migration 004_properties.sql**

```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  apn TEXT,
  legal_description TEXT,
  year_built INTEGER,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  sqft INTEGER,
  lot_size TEXT,
  property_type TEXT,
  owner_name TEXT,
  owner_mailing_address TEXT,
  redfin_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX properties_lead_id_idx ON properties(lead_id);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage properties"
  ON properties FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 5: Create migration 005_investors.sql**

```sql
CREATE TABLE investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  locations_of_interest TEXT NOT NULL,
  deals_notes TEXT,
  status entity_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER investors_updated_at
  BEFORE UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX investors_status_idx ON investors(status);

ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all investors"
  ON investors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert investors"
  ON investors FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can update investors"
  ON investors FOR UPDATE TO authenticated USING (true);

-- Investor phones
CREATE TABLE investor_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX investor_phones_investor_id_idx ON investor_phones(investor_id);
CREATE UNIQUE INDEX investor_phones_primary_idx ON investor_phones(investor_id) WHERE is_primary = true;

ALTER TABLE investor_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage investor phones"
  ON investor_phones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Investor emails
CREATE TABLE investor_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX investor_emails_investor_id_idx ON investor_emails(investor_id);
CREATE UNIQUE INDEX investor_emails_primary_idx ON investor_emails(investor_id) WHERE is_primary = true;

ALTER TABLE investor_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage investor emails"
  ON investor_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 6: Create migration 006_updates.sql**

```sql
CREATE TABLE updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER updates_updated_at
  BEFORE UPDATE ON updates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX updates_entity_idx ON updates(entity_type, entity_id);

ALTER TABLE updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all updates"
  ON updates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert updates"
  ON updates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own updates"
  ON updates FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own updates"
  ON updates FOR DELETE TO authenticated
  USING (auth.uid() = author_id);
```

- [ ] **Step 7: Create migration 007_attachments.sql**

```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX attachments_update_id_idx ON attachments(update_id);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage attachments"
  ON attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 8: Create migration 008_dashboard_notes.sql**

```sql
CREATE TABLE dashboard_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT UNIQUE NOT NULL CHECK (module IN ('acquisitions', 'dispositions')),
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

CREATE TRIGGER dashboard_notes_updated_at
  BEFORE UPDATE ON dashboard_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE dashboard_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dashboard notes"
  ON dashboard_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE dashboard_note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_note_id UUID NOT NULL REFERENCES dashboard_notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dashboard_note_versions_note_id_idx ON dashboard_note_versions(dashboard_note_id);

ALTER TABLE dashboard_note_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dashboard note versions"
  ON dashboard_note_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 9: Create migration 009_public_forms.sql**

```sql
CREATE TABLE public_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  notified BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public_form_submissions ENABLE ROW LEVEL SECURITY;

-- Public can insert (no auth needed)
CREATE POLICY "Anyone can submit forms"
  ON public_form_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users can read
CREATE POLICY "Authenticated users can view submissions"
  ON public_form_submissions FOR SELECT
  TO authenticated
  USING (true);
```

- [ ] **Step 10: Create migration 010_search_indexes.sql**

```sql
-- Full-text search GIN indexes
CREATE INDEX leads_name_search_idx ON leads USING GIN (to_tsvector('english', name));
CREATE INDEX investors_name_search_idx ON investors USING GIN (to_tsvector('english', name));
CREATE INDEX properties_address_search_idx ON properties USING GIN (to_tsvector('english', address));
CREATE INDEX investors_locations_search_idx ON investors USING GIN (to_tsvector('english', locations_of_interest));
```

- [ ] **Step 11: Create migration 011_seed.sql**

```sql
-- Seed dashboard notes rows (one per module)
INSERT INTO dashboard_notes (module, content) VALUES
  ('acquisitions', ''),
  ('dispositions', '');
```

- [ ] **Step 12: Commit**

```bash
git add supabase/
git commit -m "feat: add database migration files for all Phase 2 tables"
```

---

## Task 3: Supabase Clients & Auth Helpers

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/auth.ts`
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create shared types**

Create `src/lib/types.ts`:

```typescript
// Standard response shape for all Server Actions
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// Pagination
export type PaginationParams = {
  page?: number
  pageSize?: number
}

export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// Database row types (match migration schema)
export type UserRole = 'admin' | 'member'
export type LeadStage = 'follow_up' | 'lead' | 'marketing_on_hold' | 'marketing_active' | 'assigned_in_escrow'
export type EntityStatus = 'active' | 'closed'
export type EntityType = 'lead' | 'investor'

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export type Lead = {
  id: string
  name: string
  mailing_address: string | null
  occupancy_status: string | null
  asking_price: number | null
  selling_timeline: string | null
  source_campaign_name: string | null
  handoff_notes: string | null
  date_converted: string | null
  stage: LeadStage
  status: EntityStatus
  created_by: string
  created_at: string
  updated_at: string
}

export type LeadPhone = {
  id: string
  lead_id: string
  phone_number: string
  label: string | null
  is_primary: boolean
  created_at: string
}

export type LeadEmail = {
  id: string
  lead_id: string
  email: string
  label: string | null
  is_primary: boolean
  created_at: string
}

export type Property = {
  id: string
  lead_id: string
  address: string
  apn: string | null
  legal_description: string | null
  year_built: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lot_size: string | null
  property_type: string | null
  owner_name: string | null
  owner_mailing_address: string | null
  redfin_value: number | null
  created_at: string
  updated_at: string
}

export type Investor = {
  id: string
  name: string
  company: string | null
  locations_of_interest: string
  deals_notes: string | null
  status: EntityStatus
  created_by: string
  created_at: string
  updated_at: string
}

export type InvestorPhone = {
  id: string
  investor_id: string
  phone_number: string
  label: string | null
  is_primary: boolean
  created_at: string
}

export type InvestorEmail = {
  id: string
  investor_id: string
  email: string
  label: string | null
  is_primary: boolean
  created_at: string
}

export type Update = {
  id: string
  entity_type: EntityType
  entity_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
}

export type Attachment = {
  id: string
  update_id: string
  file_name: string
  file_type: string | null
  file_size: number | null
  storage_path: string
  created_at: string
}

export type DashboardNote = {
  id: string
  module: 'acquisitions' | 'dispositions'
  content: string
  updated_at: string
  updated_by: string | null
}

export type DashboardNoteVersion = {
  id: string
  dashboard_note_id: string
  content: string
  edited_by: string
  created_at: string
}

export type PublicFormSubmission = {
  id: string
  form_name: string
  data: Record<string, unknown>
  submitted_at: string
  ip_address: string | null
  notified: boolean
}

// Lead with all relations loaded
export type LeadWithRelations = Lead & {
  phones: LeadPhone[]
  emails: LeadEmail[]
  properties: Property[]
}

// Investor with all relations loaded
export type InvestorWithRelations = Investor & {
  phones: InvestorPhone[]
  emails: InvestorEmail[]
}

// Search results
export type SearchResults = {
  leads: Pick<Lead, 'id' | 'name' | 'status' | 'stage'>[]
  investors: Pick<Investor, 'id' | 'name' | 'status'>[]
  properties: (Pick<Property, 'id' | 'address' | 'lead_id'> & { lead_name: string })[]
}
```

- [ ] **Step 2: Create browser Supabase client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create server Supabase client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Create admin Supabase client**

Create `src/lib/supabase/admin.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

// WARNING: This client bypasses all RLS.
// Only use for: (a) auth callback user creation, (b) admin operations.
// NEVER import in client-side code.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 5: Create auth helpers**

Create `src/lib/auth.ts`:

```typescript
import { createServerClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types'

export async function getAuthUser(): Promise<User | null> {
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return data as User | null
}

export function requireAuth(user: User | null): asserts user is User {
  if (!user) {
    throw new Error('Authentication required')
  }
}

export function requireAdmin(user: User | null): asserts user is User {
  requireAuth(user)
  if (user.role !== 'admin') {
    throw new Error('Admin access required')
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/supabase/ src/lib/auth.ts
git commit -m "feat: add Supabase clients and auth helpers"
```

---

## Task 4: Validation Schemas

**Files:**
- Create: `src/lib/validations/leads.ts`
- Create: `src/lib/validations/investors.ts`
- Create: `src/lib/validations/properties.ts`
- Create: `src/lib/validations/updates.ts`
- Create: `src/lib/validations/forms.ts`
- Create: `src/lib/validations/users.ts`
- Create: `src/lib/validations/search.ts`
- Create: `src/__tests__/lib/validations/leads.test.ts`
- Create: `src/__tests__/lib/validations/investors.test.ts`
- Create: `src/__tests__/lib/validations/properties.test.ts`
- Create: `src/__tests__/lib/validations/updates.test.ts`
- Create: `src/__tests__/lib/validations/forms.test.ts`

- [ ] **Step 1: Write lead validation tests**

Create `src/__tests__/lib/validations/leads.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createLeadSchema, updateLeadSchema, leadPhoneSchema, leadEmailSchema } from '@/lib/validations/leads'

describe('createLeadSchema', () => {
  it('accepts valid lead with required fields', () => {
    const result = createLeadSchema.safeParse({
      name: 'John Doe',
      phones: [{ phone_number: '555-1234', is_primary: true }],
      properties: [{ address: '123 Main St' }],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Motivated seller',
    })
    expect(result.success).toBe(true)
  })

  it('rejects lead without name', () => {
    const result = createLeadSchema.safeParse({
      phones: [{ phone_number: '555-1234', is_primary: true }],
      properties: [{ address: '123 Main St' }],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Notes',
    })
    expect(result.success).toBe(false)
  })

  it('rejects lead without at least one phone', () => {
    const result = createLeadSchema.safeParse({
      name: 'John Doe',
      phones: [],
      properties: [{ address: '123 Main St' }],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Notes',
    })
    expect(result.success).toBe(false)
  })

  it('rejects lead without at least one property', () => {
    const result = createLeadSchema.safeParse({
      name: 'John Doe',
      phones: [{ phone_number: '555-1234', is_primary: true }],
      properties: [],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Notes',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = createLeadSchema.safeParse({
      name: 'John Doe',
      phones: [{ phone_number: '555-1234', is_primary: true }],
      properties: [{ address: '123 Main St' }],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Notes',
      mailing_address: '456 Oak Ave',
      asking_price: 250000,
      occupancy_status: 'Vacant',
      selling_timeline: '30 days',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateLeadSchema', () => {
  it('accepts partial updates', () => {
    const result = updateLeadSchema.safeParse({ name: 'Jane Doe' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = updateLeadSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/validations/leads.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Create lead validation schemas**

Create `src/lib/validations/leads.ts`:

```typescript
import { z } from 'zod'

export const leadPhoneSchema = z.object({
  phone_number: z.string().min(1, 'Phone number is required'),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const leadEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const leadPropertySchema = z.object({
  address: z.string().min(1, 'Address is required'),
})

export const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phones: z.array(leadPhoneSchema).min(1, 'At least one phone number is required'),
  emails: z.array(leadEmailSchema).optional().default([]),
  properties: z.array(leadPropertySchema).min(1, 'At least one property is required'),
  date_converted: z.string().min(1, 'Date converted is required'),
  source_campaign_name: z.string().min(1, 'Source campaign name is required'),
  handoff_notes: z.string().min(1, 'Handoff notes are required'),
  mailing_address: z.string().optional(),
  occupancy_status: z.string().optional(),
  asking_price: z.number().positive().optional(),
  selling_timeline: z.string().optional(),
})

export const updateLeadSchema = z.object({
  name: z.string().min(1),
  mailing_address: z.string().nullable(),
  occupancy_status: z.string().nullable(),
  asking_price: z.number().positive().nullable(),
  selling_timeline: z.string().nullable(),
  handoff_notes: z.string(),
  source_campaign_name: z.string(),
  date_converted: z.string(),
}).partial()

export const changeLeadStageSchema = z.object({
  stage: z.enum(['follow_up', 'lead', 'marketing_on_hold', 'marketing_active', 'assigned_in_escrow']),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/lib/validations/leads.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Write investor validation tests**

Create `src/__tests__/lib/validations/investors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createInvestorSchema, updateInvestorSchema } from '@/lib/validations/investors'

describe('createInvestorSchema', () => {
  it('accepts valid investor', () => {
    const result = createInvestorSchema.safeParse({
      name: 'Jane Smith',
      locations_of_interest: 'Phoenix AZ, Tucson AZ',
    })
    expect(result.success).toBe(true)
  })

  it('rejects investor without name', () => {
    const result = createInvestorSchema.safeParse({
      locations_of_interest: 'Phoenix AZ',
    })
    expect(result.success).toBe(false)
  })

  it('rejects investor without locations', () => {
    const result = createInvestorSchema.safeParse({
      name: 'Jane Smith',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = createInvestorSchema.safeParse({
      name: 'Jane Smith',
      locations_of_interest: 'Phoenix AZ',
      company: 'Smith RE LLC',
      deals_notes: 'Interested in SFR under 200k',
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 6: Create investor validation schemas**

Create `src/lib/validations/investors.ts`:

```typescript
import { z } from 'zod'

export const investorPhoneSchema = z.object({
  phone_number: z.string().min(1, 'Phone number is required'),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const investorEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const createInvestorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  locations_of_interest: z.string().min(1, 'Locations of interest is required'),
  company: z.string().optional(),
  deals_notes: z.string().optional(),
  phones: z.array(investorPhoneSchema).optional().default([]),
  emails: z.array(investorEmailSchema).optional().default([]),
})

export const updateInvestorSchema = z.object({
  name: z.string().min(1).optional(),
  locations_of_interest: z.string().min(1).optional(),
  company: z.string().nullable().optional(),
  deals_notes: z.string().nullable().optional(),
}).partial()

export type CreateInvestorInput = z.infer<typeof createInvestorSchema>
export type UpdateInvestorInput = z.infer<typeof updateInvestorSchema>
```

- [ ] **Step 7: Run investor tests**

Run: `npx vitest run src/__tests__/lib/validations/investors.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Write property validation tests**

Create `src/__tests__/lib/validations/properties.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { addPropertySchema, updatePropertySchema } from '@/lib/validations/properties'

describe('addPropertySchema', () => {
  it('accepts valid property with just address', () => {
    const result = addPropertySchema.safeParse({
      address: '123 Main St, Phoenix, AZ 85001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects property without address', () => {
    const result = addPropertySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts all optional fields', () => {
    const result = addPropertySchema.safeParse({
      address: '123 Main St',
      apn: '123-45-678',
      year_built: 1995,
      bedrooms: 3,
      bathrooms: 2.5,
      sqft: 1800,
      lot_size: '0.25 acres',
      property_type: 'SFR',
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 9: Create property validation schemas**

Create `src/lib/validations/properties.ts`:

```typescript
import { z } from 'zod'

export const addPropertySchema = z.object({
  address: z.string().min(1, 'Address is required'),
  apn: z.string().optional(),
  legal_description: z.string().optional(),
  year_built: z.number().int().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().nonnegative().optional(),
  sqft: z.number().int().positive().optional(),
  lot_size: z.string().optional(),
  property_type: z.string().optional(),
  owner_name: z.string().optional(),
  owner_mailing_address: z.string().optional(),
  redfin_value: z.number().positive().optional(),
})

export const updatePropertySchema = addPropertySchema.partial()

export type AddPropertyInput = z.infer<typeof addPropertySchema>
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>
```

- [ ] **Step 10: Run property tests**

Run: `npx vitest run src/__tests__/lib/validations/properties.test.ts`
Expected: All tests PASS

- [ ] **Step 11: Create remaining validation schemas**

Create `src/lib/validations/updates.ts`:

```typescript
import { z } from 'zod'

export const createUpdateSchema = z.object({
  entity_type: z.enum(['lead', 'investor']),
  entity_id: z.string().uuid(),
  content: z.string().min(1, 'Content is required'),
})

export const editUpdateSchema = z.object({
  content: z.string().min(1, 'Content is required'),
})

export type CreateUpdateInput = z.infer<typeof createUpdateSchema>
export type EditUpdateInput = z.infer<typeof editUpdateSchema>
```

Create `src/lib/validations/forms.ts`:

```typescript
import { z } from 'zod'

const ALLOWED_FORM_NAMES = [
  'BT Investments - Sell Your Property',
  'BT Investments - Join Buyers List',
  'Signal - Contact Form',
  'Infinite RE - Contact Form',
  'Infinite Media - Contact Form',
] as const

export const formSubmissionSchema = z.object({
  form_name: z.enum(ALLOWED_FORM_NAMES),
  data: z.record(z.string().max(5000)).refine(
    (data) => JSON.stringify(data).length <= 10240,
    { message: 'Form data too large (max 10KB)' }
  ),
})

export type FormSubmissionInput = z.infer<typeof formSubmissionSchema>
```

Create `src/lib/validations/users.ts`:

```typescript
import { z } from 'zod'

export const changeUserRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
})

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>
```

Create `src/lib/validations/search.ts`:

```typescript
import { z } from 'zod'

export const searchSchema = z.object({
  query: z.string().min(1).max(200),
})

export type SearchInput = z.infer<typeof searchSchema>
```

- [ ] **Step 12: Write and run form validation tests**

Create `src/__tests__/lib/validations/forms.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formSubmissionSchema } from '@/lib/validations/forms'

describe('formSubmissionSchema', () => {
  it('accepts valid submission', () => {
    const result = formSubmissionSchema.safeParse({
      form_name: 'BT Investments - Sell Your Property',
      data: { name: 'John', email: 'john@example.com', message: 'Hello' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown form name', () => {
    const result = formSubmissionSchema.safeParse({
      form_name: 'Fake Form',
      data: { name: 'John' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects field values over 5000 chars', () => {
    const result = formSubmissionSchema.safeParse({
      form_name: 'Signal - Contact Form',
      data: { message: 'x'.repeat(5001) },
    })
    expect(result.success).toBe(false)
  })
})
```

Run: `npx vitest run src/__tests__/lib/validations/`
Expected: All tests PASS

- [ ] **Step 13: Write and run update validation tests**

Create `src/__tests__/lib/validations/updates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createUpdateSchema, editUpdateSchema } from '@/lib/validations/updates'

describe('createUpdateSchema', () => {
  it('accepts valid update for lead', () => {
    const result = createUpdateSchema.safeParse({
      entity_type: 'lead',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      content: '<p>Called seller, no answer.</p>',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid entity_type', () => {
    const result = createUpdateSchema.safeParse({
      entity_type: 'property',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Note',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty content', () => {
    const result = createUpdateSchema.safeParse({
      entity_type: 'investor',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      content: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('editUpdateSchema', () => {
  it('accepts valid edit', () => {
    const result = editUpdateSchema.safeParse({
      content: '<p>Updated note content</p>',
    })
    expect(result.success).toBe(true)
  })
})
```

Run: `npx vitest run src/__tests__/lib/validations/`
Expected: All tests PASS

- [ ] **Step 14: Commit**

```bash
git add src/lib/validations/ src/__tests__/
git commit -m "feat: add Zod validation schemas for all entities with tests"
```

---

## Task 5: Middleware (Auth + Hostname Routing)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Public form submission endpoint — no auth
  if (pathname.startsWith('/api/forms/')) {
    return NextResponse.next()
  }

  // Determine if this is an app request
  const isAppRequest =
    hostname.startsWith('app.') || // Production: app.btinvestments.co
    pathname.startsWith('/app') || // Dev: localhost:3000/app
    pathname.startsWith('/api/')   // API routes need auth (except forms, handled above)

  // Public pages — no auth needed
  if (!isAppRequest && !pathname.startsWith('/login') && !pathname.startsWith('/auth')) {
    return NextResponse.next()
  }

  // Refresh Supabase session via middleware
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Login page — if already authenticated, redirect to app
  if (pathname === '/login') {
    if (user) {
      return NextResponse.redirect(new URL('/app', request.url))
    }
    return response
  }

  // App routes — require auth
  if (isAppRequest && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware with hostname routing"
```

---

## Task 6: Auth Callback & Login Page

**Files:**
- Create: `src/app/api/auth/callback/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/error/page.tsx`

- [ ] **Step 1: Create OAuth callback route**

Create `src/app/api/auth/callback/route.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error?reason=no_code', origin))
  }

  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(new URL('/auth/error?reason=exchange_failed', origin))
  }

  const email = data.user.email || ''

  // Domain restriction
  if (!email.endsWith('@btinvestments.co')) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/auth/error?reason=domain_restricted', origin))
  }

  // Create or update user record
  const adminClient = createAdminClient()

  // Check if user exists
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id')
    .eq('id', data.user.id)
    .single()

  if (!existingUser) {
    // Check if this is the first user (they become admin)
    const { count } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })

    const isFirstUser = (count ?? 0) === 0
    const isRandy = email === 'randy@btinvestments.co'

    await adminClient.from('users').insert({
      id: data.user.id,
      email,
      name: data.user.user_metadata?.full_name || email.split('@')[0],
      role: (isFirstUser || isRandy) ? 'admin' : 'member',
    })
  }

  const redirectResponse = NextResponse.redirect(new URL('/app', origin))
  // Copy cookies from the exchange response
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value)
  })

  return redirectResponse
}
```

- [ ] **Step 2: Create login page**

Create `src/app/login/page.tsx`:

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm rounded-lg border border-dashed border-neutral-300 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-neutral-900">
          BT Investments
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-500">
          Sign in to access the app
        </p>
        <button
          onClick={handleLogin}
          className="w-full rounded-md border border-neutral-400 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create auth error page**

Create `src/app/auth/error/page.tsx`:

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const messages: Record<string, string> = {
    domain_restricted: 'Access is restricted to @btinvestments.co email addresses only.',
    exchange_failed: 'Authentication failed. Please try again.',
    no_code: 'Invalid authentication request.',
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm rounded-lg border border-dashed border-neutral-300 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-neutral-900">
          Access Denied
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-600">
          {messages[reason || ''] || 'An unknown error occurred.'}
        </p>
        <Link
          href="/login"
          className="block w-full rounded-md border border-neutral-400 bg-neutral-50 px-4 py-3 text-center text-sm font-medium text-neutral-900 hover:bg-neutral-100 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <AuthErrorContent />
    </Suspense>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/ src/app/login/ src/app/auth/
git commit -m "feat: add Google OAuth login flow with domain restriction"
```

---

## Task 7: Lead Server Actions

**Files:**
- Create: `src/actions/leads.ts`

- [ ] **Step 1: Create lead actions**

Create `src/actions/leads.ts`:

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { createLeadSchema, updateLeadSchema, changeLeadStageSchema } from '@/lib/validations/leads'
import { leadPhoneSchema, leadEmailSchema } from '@/lib/validations/leads'
import type { ActionResult, Lead, LeadWithRelations, LeadStage, PaginationParams, PaginatedResult, EntityStatus, LeadPhone, LeadEmail } from '@/lib/types'

export async function getLeads(
  params: PaginationParams & { status?: EntityStatus; stage?: LeadStage } = {}
): Promise<ActionResult<PaginatedResult<Lead>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const { page = 1, pageSize = 50, status, stage } = params
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = await createServerClient()
    let query = supabase.from('leads').select('*', { count: 'exact' })

    if (status) {
      query = query.eq('status', status)
    }
    if (stage) {
      query = query.eq('stage', stage)
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: { items: data as Lead[], total: count ?? 0, page, pageSize },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getLead(id: string): Promise<ActionResult<LeadWithRelations>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const [leadRes, phonesRes, emailsRes, propsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('lead_phones').select('*').eq('lead_id', id).order('created_at'),
      supabase.from('lead_emails').select('*').eq('lead_id', id).order('created_at'),
      supabase.from('properties').select('*').eq('lead_id', id).order('created_at'),
    ])

    if (leadRes.error) return { success: false, error: leadRes.error.message }

    return {
      success: true,
      data: {
        ...(leadRes.data as Lead),
        phones: (phonesRes.data ?? []) as LeadPhone[],
        emails: (emailsRes.data ?? []) as LeadEmail[],
        properties: propsRes.data ?? [],
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createLead(input: unknown): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const validated = createLeadSchema.parse(input)
    const supabase = await createServerClient()

    // Insert lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        name: validated.name,
        mailing_address: validated.mailing_address,
        occupancy_status: validated.occupancy_status,
        asking_price: validated.asking_price,
        selling_timeline: validated.selling_timeline,
        source_campaign_name: validated.source_campaign_name,
        handoff_notes: validated.handoff_notes,
        date_converted: validated.date_converted,
        created_by: user.id,
      })
      .select()
      .single()

    if (leadError) return { success: false, error: leadError.message }

    // Insert phones
    if (validated.phones.length > 0) {
      await supabase.from('lead_phones').insert(
        validated.phones.map((p) => ({ ...p, lead_id: lead.id }))
      )
    }

    // Insert emails
    if (validated.emails && validated.emails.length > 0) {
      await supabase.from('lead_emails').insert(
        validated.emails.map((e) => ({ ...e, lead_id: lead.id }))
      )
    }

    // Insert properties
    if (validated.properties.length > 0) {
      await supabase.from('properties').insert(
        validated.properties.map((p) => ({ ...p, lead_id: lead.id }))
      )
    }

    return { success: true, data: lead as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateLead(id: string, input: unknown): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = updateLeadSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('leads')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function changeLeadStage(id: string, input: unknown): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const validated = changeLeadStageSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('leads')
      .update({ stage: validated.stage })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function archiveLead(id: string): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('leads')
      .update({ status: 'closed' as EntityStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Admin-only: reopening is a significant state change (same logic as archiving)
export async function reopenLead(id: string): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('leads')
      .update({ status: 'active' as EntityStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addLeadPhone(leadId: string, input: unknown): Promise<ActionResult<LeadPhone>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = leadPhoneSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('lead_phones')
      .insert({ ...validated, lead_id: leadId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as LeadPhone }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeLeadPhone(phoneId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('lead_phones').delete().eq('id', phoneId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addLeadEmail(leadId: string, input: unknown): Promise<ActionResult<LeadEmail>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = leadEmailSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('lead_emails')
      .insert({ ...validated, lead_id: leadId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as LeadEmail }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeLeadEmail(emailId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('lead_emails').delete().eq('id', emailId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/actions/leads.ts
git commit -m "feat: add lead server actions (CRUD, stage, archive, contacts)"
```

---

## Task 8: Investor Server Actions

**Files:**
- Create: `src/actions/investors.ts`

- [ ] **Step 1: Create investor actions**

Create `src/actions/investors.ts` following the same pattern as leads. Actions: `getInvestors`, `getInvestor`, `createInvestor`, `updateInvestor`, `archiveInvestor`, `reopenInvestor`, `addInvestorPhone`, `removeInvestorPhone`, `addInvestorEmail`, `removeInvestorEmail`, `getInvestorDirectory`.

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { createInvestorSchema, updateInvestorSchema, investorPhoneSchema, investorEmailSchema } from '@/lib/validations/investors'
import type { ActionResult, Investor, InvestorWithRelations, InvestorPhone, InvestorEmail, PaginationParams, PaginatedResult, EntityStatus } from '@/lib/types'

export async function getInvestors(
  params: PaginationParams & { status?: EntityStatus } = {}
): Promise<ActionResult<PaginatedResult<Investor>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const { page = 1, pageSize = 50, status } = params
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = await createServerClient()
    let query = supabase.from('investors').select('*', { count: 'exact' })

    if (status) query = query.eq('status', status)

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: { items: data as Investor[], total: count ?? 0, page, pageSize },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getInvestor(id: string): Promise<ActionResult<InvestorWithRelations>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const [investorRes, phonesRes, emailsRes] = await Promise.all([
      supabase.from('investors').select('*').eq('id', id).single(),
      supabase.from('investor_phones').select('*').eq('investor_id', id).order('created_at'),
      supabase.from('investor_emails').select('*').eq('investor_id', id).order('created_at'),
    ])

    if (investorRes.error) return { success: false, error: investorRes.error.message }

    return {
      success: true,
      data: {
        ...(investorRes.data as Investor),
        phones: (phonesRes.data ?? []) as InvestorPhone[],
        emails: (emailsRes.data ?? []) as InvestorEmail[],
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createInvestor(input: unknown): Promise<ActionResult<Investor>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const validated = createInvestorSchema.parse(input)
    const supabase = await createServerClient()

    const { data: investor, error } = await supabase
      .from('investors')
      .insert({
        name: validated.name,
        company: validated.company,
        locations_of_interest: validated.locations_of_interest,
        deals_notes: validated.deals_notes,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    // Insert phones
    if (validated.phones && validated.phones.length > 0) {
      await supabase.from('investor_phones').insert(
        validated.phones.map((p) => ({ ...p, investor_id: investor.id }))
      )
    }

    // Insert emails
    if (validated.emails && validated.emails.length > 0) {
      await supabase.from('investor_emails').insert(
        validated.emails.map((e) => ({ ...e, investor_id: investor.id }))
      )
    }

    return { success: true, data: investor as Investor }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateInvestor(id: string, input: unknown): Promise<ActionResult<Investor>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = updateInvestorSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('investors')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Investor }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function archiveInvestor(id: string): Promise<ActionResult<Investor>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('investors')
      .update({ status: 'closed' as EntityStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Investor }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Admin-only: reopening is a significant state change (same logic as archiving)
export async function reopenInvestor(id: string): Promise<ActionResult<Investor>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('investors')
      .update({ status: 'active' as EntityStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Investor }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addInvestorPhone(investorId: string, input: unknown): Promise<ActionResult<InvestorPhone>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = investorPhoneSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('investor_phones')
      .insert({ ...validated, investor_id: investorId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as InvestorPhone }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeInvestorPhone(phoneId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('investor_phones').delete().eq('id', phoneId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addInvestorEmail(investorId: string, input: unknown): Promise<ActionResult<InvestorEmail>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = investorEmailSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('investor_emails')
      .insert({ ...validated, investor_id: investorId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as InvestorEmail }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeInvestorEmail(emailId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('investor_emails').delete().eq('id', emailId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getInvestorDirectory(): Promise<ActionResult<Pick<Investor, 'id' | 'name' | 'locations_of_interest' | 'company'>[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('investors')
      .select('id, name, locations_of_interest, company')
      .eq('status', 'active')
      .order('name')

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Pick<Investor, 'id' | 'name' | 'locations_of_interest' | 'company'>[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/actions/investors.ts
git commit -m "feat: add investor server actions (CRUD, archive, contacts, directory)"
```

---

## Task 9: Property Server Actions

**Files:**
- Create: `src/actions/properties.ts`

- [ ] **Step 1: Create property actions**

Create `src/actions/properties.ts`:

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { addPropertySchema, updatePropertySchema } from '@/lib/validations/properties'
import type { ActionResult, Property } from '@/lib/types'

export async function getProperties(leadId: string): Promise<ActionResult<Property[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at')

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Property[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addProperty(leadId: string, input: unknown): Promise<ActionResult<Property>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = addPropertySchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('properties')
      .insert({ ...validated, lead_id: leadId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Property }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateProperty(id: string, input: unknown): Promise<ActionResult<Property>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = updatePropertySchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('properties')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Property }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeProperty(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('properties').delete().eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/properties.ts
git commit -m "feat: add property server actions (CRUD)"
```

---

## Task 10: Updates (Notes) & Attachments Server Actions

**Files:**
- Create: `src/actions/updates.ts`
- Create: `src/actions/attachments.ts`
- Create: `src/actions/dashboard-notes.ts`

- [ ] **Step 1: Create update actions**

Create `src/actions/updates.ts`:

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { createUpdateSchema, editUpdateSchema } from '@/lib/validations/updates'
import type { ActionResult, Update, PaginationParams, PaginatedResult } from '@/lib/types'

export async function getUpdates(
  entityType: 'lead' | 'investor',
  entityId: string,
  params: PaginationParams = {}
): Promise<ActionResult<PaginatedResult<Update & { author_name: string }>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const { page = 1, pageSize = 50 } = params
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = await createServerClient()
    const { data, count, error } = await supabase
      .from('updates')
      .select('*, users!author_id(name)', { count: 'exact' })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return { success: false, error: error.message }

    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      author_name: (row.users as { name: string } | null)?.name ?? 'Unknown',
      users: undefined,
    })) as (Update & { author_name: string })[]

    return {
      success: true,
      data: { items, total: count ?? 0, page, pageSize },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createUpdate(input: unknown): Promise<ActionResult<Update>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = createUpdateSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('updates')
      .insert({
        entity_type: validated.entity_type,
        entity_id: validated.entity_id,
        author_id: user.id,
        content: validated.content,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Update }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function editUpdate(id: string, input: unknown): Promise<ActionResult<Update>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = editUpdateSchema.parse(input)
    const supabase = await createServerClient()

    // Verify author
    const { data: existing } = await supabase
      .from('updates')
      .select('author_id')
      .eq('id', id)
      .single()

    if (!existing) return { success: false, error: 'Update not found' }
    if (existing.author_id !== user.id) return { success: false, error: 'You can only edit your own updates' }

    const { data, error } = await supabase
      .from('updates')
      .update({ content: validated.content })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Update }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteUpdate(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Verify author
    const { data: existing } = await supabase
      .from('updates')
      .select('author_id')
      .eq('id', id)
      .single()

    if (!existing) return { success: false, error: 'Update not found' }
    if (existing.author_id !== user.id) return { success: false, error: 'You can only delete your own updates' }

    const { error } = await supabase.from('updates').delete().eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Create attachment actions**

Create `src/actions/attachments.ts`:

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, Attachment } from '@/lib/types'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
const MAX_ATTACHMENTS_PER_UPDATE = 10

export async function getUploadUrl(
  updateId: string,
  entityType: 'lead' | 'investor',
  entityId: string,
  fileName: string,
  fileSize: number
): Promise<ActionResult<{ path: string; signedUrl: string }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    if (fileSize > MAX_FILE_SIZE) {
      return { success: false, error: `File size exceeds maximum of 25 MB` }
    }

    // Check attachment count
    const supabase = await createServerClient()
    const { count } = await supabase
      .from('attachments')
      .select('*', { count: 'exact', head: true })
      .eq('update_id', updateId)

    if ((count ?? 0) >= MAX_ATTACHMENTS_PER_UPDATE) {
      return { success: false, error: `Maximum ${MAX_ATTACHMENTS_PER_UPDATE} attachments per update` }
    }

    const folder = entityType === 'lead' ? 'leads' : 'investors'
    const path = `${folder}/${entityId}/${updateId}/${fileName}`

    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUploadUrl(path)

    if (error) return { success: false, error: error.message }
    return { success: true, data: { path, signedUrl: data.signedUrl } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createAttachmentRecord(
  updateId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  storagePath: string
): Promise<ActionResult<Attachment>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('attachments')
      .insert({
        update_id: updateId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: storagePath,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Attachment }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function listAttachments(updateId: string): Promise<ActionResult<Attachment[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('update_id', updateId)
      .order('created_at')

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Attachment[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteAttachment(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Get storage path before deleting record
    const { data: attachment } = await supabase
      .from('attachments')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (!attachment) return { success: false, error: 'Attachment not found' }

    // Delete from storage
    await supabase.storage.from('attachments').remove([attachment.storage_path])

    // Delete record
    const { error } = await supabase.from('attachments').delete().eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getDownloadUrl(id: string): Promise<ActionResult<string>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const { data: attachment } = await supabase
      .from('attachments')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (!attachment) return { success: false, error: 'Attachment not found' }

    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(attachment.storage_path, 3600) // 1 hour

    if (error) return { success: false, error: error.message }
    return { success: true, data: data.signedUrl }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 3: Create dashboard notes actions**

Create `src/actions/dashboard-notes.ts`:

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, DashboardNote, DashboardNoteVersion } from '@/lib/types'

export async function getDashboardNote(
  module: 'acquisitions' | 'dispositions'
): Promise<ActionResult<DashboardNote>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('dashboard_notes')
      .select('*')
      .eq('module', module)
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as DashboardNote }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateDashboardNote(
  module: 'acquisitions' | 'dispositions',
  content: string,
  expectedUpdatedAt: string
): Promise<ActionResult<DashboardNote>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Concurrency check: verify no one else edited since we loaded
    const { data: current } = await supabase
      .from('dashboard_notes')
      .select('updated_at, updated_by')
      .eq('module', module)
      .single()

    if (current && current.updated_at !== expectedUpdatedAt && current.updated_by !== user.id) {
      // Get the other editor's name
      const { data: editor } = await supabase
        .from('users')
        .select('name')
        .eq('id', current.updated_by)
        .single()

      return {
        success: false,
        error: `CONFLICT:${editor?.name || 'Someone'}:${current.updated_at}`,
      }
    }

    // Save version snapshot of the previous content
    const { data: note } = await supabase
      .from('dashboard_notes')
      .select('id, content, updated_by')
      .eq('module', module)
      .single()

    if (note && note.content !== '') {
      await supabase.from('dashboard_note_versions').insert({
        dashboard_note_id: note.id,
        content: note.content,
        edited_by: note.updated_by ?? user.id, // Previous editor, not current user
      })
    }

    // Update the note
    const { data, error } = await supabase
      .from('dashboard_notes')
      .update({ content, updated_by: user.id })
      .eq('module', module)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as DashboardNote }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getDashboardNoteVersions(
  module: 'acquisitions' | 'dispositions'
): Promise<ActionResult<(DashboardNoteVersion & { editor_name: string })[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const { data: note } = await supabase
      .from('dashboard_notes')
      .select('id')
      .eq('module', module)
      .single()

    if (!note) return { success: false, error: 'Dashboard note not found' }

    const { data, error } = await supabase
      .from('dashboard_note_versions')
      .select('*, users!edited_by(name)')
      .eq('dashboard_note_id', note.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return { success: false, error: error.message }

    const versions = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      editor_name: (row.users as { name: string } | null)?.name ?? 'Unknown',
      users: undefined,
    })) as (DashboardNoteVersion & { editor_name: string })[]

    return { success: true, data: versions }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function revertDashboardNote(
  module: 'acquisitions' | 'dispositions',
  versionId: string
): Promise<ActionResult<DashboardNote>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Get the version content
    const { data: version } = await supabase
      .from('dashboard_note_versions')
      .select('content')
      .eq('id', versionId)
      .single()

    if (!version) return { success: false, error: 'Version not found' }

    // Save current content as a version before reverting
    const { data: current } = await supabase
      .from('dashboard_notes')
      .select('id, content')
      .eq('module', module)
      .single()

    if (current) {
      await supabase.from('dashboard_note_versions').insert({
        dashboard_note_id: current.id,
        content: current.content,
        edited_by: user.id,
      })
    }

    // Revert
    const { data, error } = await supabase
      .from('dashboard_notes')
      .update({ content: version.content, updated_by: user.id })
      .eq('module', module)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as DashboardNote }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/actions/updates.ts src/actions/attachments.ts src/actions/dashboard-notes.ts
git commit -m "feat: add updates, attachments, and dashboard notes server actions"
```

---

## Task 11: User Management Server Actions

**Files:**
- Create: `src/actions/users.ts`

- [ ] **Step 1: Create user actions**

Create `src/actions/users.ts`:

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAdmin } from '@/lib/auth'
import { changeUserRoleSchema } from '@/lib/validations/users'
import type { ActionResult, User } from '@/lib/types'

export async function getUsers(): Promise<ActionResult<User[]>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at')

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as User[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Invite is handled by sharing the app URL — new users log in with Google OAuth
// and are auto-provisioned in the auth callback. This stub exists for future
// email-based invite flow if needed.
export async function inviteUser(_email: string): Promise<ActionResult<null>> {
  return { success: false, error: 'Invite not yet implemented. New users can sign in directly with their @btinvestments.co Google account.' }
}

export async function changeUserRole(userId: string, input: unknown): Promise<ActionResult<User>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    if (userId === user.id) {
      return { success: false, error: 'Cannot change your own role' }
    }

    const validated = changeUserRoleSchema.parse(input)
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('users')
      .update({ role: validated.role })
      .eq('id', userId)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as User }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeUser(userId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    if (userId === user.id) {
      return { success: false, error: 'Cannot remove yourself' }
    }

    const adminClient = createAdminClient()

    // Delete from auth.users — CASCADE will remove the users table row
    const { error } = await adminClient.auth.admin.deleteUser(userId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/users.ts
git commit -m "feat: add user management server actions (admin only)"
```

---

## Task 12: Global Search Server Action

**Files:**
- Create: `src/actions/search.ts`

- [ ] **Step 1: Create search action**

Create `src/actions/search.ts`:

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { searchSchema } from '@/lib/validations/search'
import type { ActionResult, SearchResults } from '@/lib/types'

export async function globalSearch(input: unknown): Promise<ActionResult<SearchResults>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const { query } = searchSchema.parse(input)
    const supabase = await createServerClient()

    // Prepare search terms for full-text search and ILIKE
    const tsQueryTerms = query.split(/\s+/).filter(Boolean).map(t => `${t}:*`).join(' & ')
    const ilikePattern = `%${query}%`

    // Search leads by name (full-text, uses GIN index) and campaign name (ILIKE)
    const leadsPromise = supabase
      .from('leads')
      .select('id, name, status, stage')
      .or(`name.fts.${tsQueryTerms},source_campaign_name.ilike.${ilikePattern}`)
      .limit(10)

    // Search investors by name (full-text) and locations (full-text)
    const investorsPromise = supabase
      .from('investors')
      .select('id, name, status')
      .or(`name.fts.${tsQueryTerms},locations_of_interest.fts.${tsQueryTerms}`)
      .limit(10)

    // Search properties by address (full-text), APN (ILIKE), owner name (ILIKE)
    const propertiesPromise = supabase
      .from('properties')
      .select('id, address, lead_id, leads!inner(name)')
      .or(`address.fts.${tsQueryTerms},apn.ilike.${ilikePattern},owner_name.ilike.${ilikePattern}`)
      .limit(10)

    // Search phones/emails for leads (ILIKE — structured data)
    const leadPhonesPromise = supabase
      .from('lead_phones')
      .select('lead_id, leads!inner(id, name, status, stage)')
      .ilike('phone_number', ilikePattern)
      .limit(10)

    const leadEmailsPromise = supabase
      .from('lead_emails')
      .select('lead_id, leads!inner(id, name, status, stage)')
      .ilike('email', ilikePattern)
      .limit(10)

    // Search phones/emails for investors (ILIKE — structured data)
    const investorPhonesPromise = supabase
      .from('investor_phones')
      .select('investor_id, investors!inner(id, name, status)')
      .ilike('phone_number', ilikePattern)
      .limit(10)

    const investorEmailsPromise = supabase
      .from('investor_emails')
      .select('investor_id, investors!inner(id, name, status)')
      .ilike('email', ilikePattern)
      .limit(10)

    const [leads, investors, properties, leadPhones, leadEmails, investorPhones, investorEmails] =
      await Promise.all([
        leadsPromise,
        investorsPromise,
        propertiesPromise,
        leadPhonesPromise,
        leadEmailsPromise,
        investorPhonesPromise,
        investorEmailsPromise,
      ])

    // Merge and deduplicate lead results
    const leadMap = new Map<string, { id: string; name: string; status: string; stage: string }>()
    for (const lead of leads.data ?? []) {
      leadMap.set(lead.id, lead)
    }
    for (const row of [...(leadPhones.data ?? []), ...(leadEmails.data ?? [])]) {
      const lead = row.leads as unknown as { id: string; name: string; status: string; stage: string }
      if (lead) leadMap.set(lead.id, lead)
    }

    // Merge and deduplicate investor results
    const investorMap = new Map<string, { id: string; name: string; status: string }>()
    for (const inv of investors.data ?? []) {
      investorMap.set(inv.id, inv)
    }
    for (const row of [...(investorPhones.data ?? []), ...(investorEmails.data ?? [])]) {
      const inv = row.investors as unknown as { id: string; name: string; status: string }
      if (inv) investorMap.set(inv.id, inv)
    }

    // Format property results
    const propertyResults = (properties.data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      address: p.address as string,
      lead_id: p.lead_id as string,
      lead_name: ((p.leads as { name: string }) || { name: 'Unknown' }).name,
    }))

    return {
      success: true,
      data: {
        leads: Array.from(leadMap.values()).slice(0, 10),
        investors: Array.from(investorMap.values()).slice(0, 10),
        properties: propertyResults.slice(0, 10),
      } as SearchResults,
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/search.ts
git commit -m "feat: add global spotlight search across leads, investors, properties"
```

---

## Task 13: Public Form API Route & Email Notifications

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/lib/rate-limit.ts`
- Create: `src/app/api/forms/submit/route.ts`
- Create: `src/__tests__/lib/rate-limit.test.ts`

- [ ] **Step 1: Write rate limiter tests**

Create `src/__tests__/lib/rate-limit.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { RateLimiter } from '@/lib/rate-limit'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter(3, 60000) // 3 requests per minute
  })

  it('allows requests under the limit', () => {
    expect(limiter.check('1.2.3.4')).toBe(true)
    expect(limiter.check('1.2.3.4')).toBe(true)
    expect(limiter.check('1.2.3.4')).toBe(true)
  })

  it('blocks requests over the limit', () => {
    limiter.check('1.2.3.4')
    limiter.check('1.2.3.4')
    limiter.check('1.2.3.4')
    expect(limiter.check('1.2.3.4')).toBe(false)
  })

  it('tracks different IPs separately', () => {
    limiter.check('1.2.3.4')
    limiter.check('1.2.3.4')
    limiter.check('1.2.3.4')
    expect(limiter.check('1.2.3.4')).toBe(false)
    expect(limiter.check('5.6.7.8')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/rate-limit.test.ts`
Expected: FAIL

- [ ] **Step 3: Create rate limiter**

Create `src/lib/rate-limit.ts`:

```typescript
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  check(key: string): boolean {
    const now = Date.now()
    const timestamps = this.requests.get(key) ?? []

    // Remove expired timestamps
    const valid = timestamps.filter((t) => now - t < this.windowMs)

    if (valid.length >= this.maxRequests) {
      this.requests.set(key, valid)
      return false
    }

    valid.push(now)
    this.requests.set(key, valid)
    return true
  }
}
```

- [ ] **Step 4: Run rate limiter tests**

Run: `npx vitest run src/__tests__/lib/rate-limit.test.ts`
Expected: All PASS

- [ ] **Step 5: Create email helper**

Create `src/lib/email.ts`:

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendFormNotification(
  formName: string,
  formData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const dataRows = Object.entries(formData)
    .map(([key, value]) => `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">${key}</td><td style="padding:8px;border-bottom:1px solid #eee">${String(value)}</td></tr>`)
    .join('')

  try {
    await resend.emails.send({
      from: 'BT Investments <notifications@btinvestments.co>',
      to: 'randy@btinvestments.co',
      subject: `New submission: ${formName}`,
      html: `
        <h2>New Form Submission</h2>
        <p><strong>Form:</strong> ${formName}</p>
        <table style="border-collapse:collapse;width:100%;max-width:600px">
          ${dataRows}
        </table>
      `,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 6: Create public form submission route**

Create `src/app/api/forms/submit/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formSubmissionSchema } from '@/lib/validations/forms'
import { sendFormNotification } from '@/lib/email'
import { RateLimiter } from '@/lib/rate-limit'

// 5 requests per IP per minute
const rateLimiter = new RateLimiter(5, 60000)

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimiter.check(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const validated = formSubmissionSchema.parse(body)

    // Use anon client — RLS allows anon INSERT on public_form_submissions
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: insertedRow, error: dbError } = await supabase
      .from('public_form_submissions')
      .insert({
        form_name: validated.form_name,
        data: validated.data,
        ip_address: ip,
      })
      .select('id')
      .single()

    if (dbError || !insertedRow) {
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    // Send email notification (don't fail the request if email fails)
    const emailResult = await sendFormNotification(validated.form_name, validated.data)

    // Update notified flag by ID
    if (emailResult.success) {
      await supabase
        .from('public_form_submissions')
        .update({ notified: true })
        .eq('id', insertedRow.id)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/email.ts src/lib/rate-limit.ts src/app/api/forms/ src/__tests__/lib/rate-limit.test.ts
git commit -m "feat: add public form submission API with rate limiting and email notifications"
```

---

## Task 14: Property Scraping API Route

**Files:**
- Create: `src/lib/scraper.ts`
- Create: `src/app/api/properties/scrape/route.ts`

- [ ] **Step 1: Create Redfin scraper**

Create `src/lib/scraper.ts`:

```typescript
type ScrapedPropertyData = {
  apn?: string
  year_built?: number
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  lot_size?: string
  property_type?: string
  owner_name?: string
  owner_mailing_address?: string
  redfin_value?: number
}

export async function scrapePropertyData(address: string): Promise<ScrapedPropertyData> {
  try {
    // Step 1: Search Redfin for the address using their autocomplete endpoint
    const searchUrl = `https://www.redfin.com/stingray/do/location-autocomplete?location=${encodeURIComponent(address)}&v=2`

    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!searchRes.ok) return {}

    const searchText = await searchRes.text()
    // Redfin prepends "{}&&" to JSON responses
    const cleanJson = searchText.replace(/^{}&&/, '')
    const searchData = JSON.parse(cleanJson)

    // Find the first exact match result
    const payload = searchData?.payload
    if (!payload?.sections) return {}

    let propertyUrl: string | null = null
    for (const section of payload.sections) {
      for (const row of section.rows || []) {
        if (row.url) {
          propertyUrl = row.url
          break
        }
      }
      if (propertyUrl) break
    }

    if (!propertyUrl) return {}

    // Step 2: Fetch property details via Redfin's API
    const detailUrl = `https://www.redfin.com/stingray/api/home/details/avm?path=${encodeURIComponent(propertyUrl)}`

    const detailRes = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!detailRes.ok) {
      // Fallback: try to scrape the HTML page directly
      return await scrapeFromHtml(propertyUrl)
    }

    const detailText = await detailRes.text()
    const cleanDetailJson = detailText.replace(/^{}&&/, '')
    const detailData = JSON.parse(cleanDetailJson)

    const result: ScrapedPropertyData = {}
    const propertyInfo = detailData?.payload

    if (propertyInfo) {
      if (propertyInfo.predictedValue) result.redfin_value = propertyInfo.predictedValue
    }

    // Also try the main property page for more details
    const pageData = await scrapeFromHtml(propertyUrl)
    return { ...pageData, ...result }
  } catch {
    return {}
  }
}

async function scrapeFromHtml(propertyPath: string): Promise<ScrapedPropertyData> {
  try {
    const url = `https://www.redfin.com${propertyPath}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!res.ok) return {}

    const html = await res.text()
    const result: ScrapedPropertyData = {}

    // Parse key facts from HTML
    const bedsMatch = html.match(/(\d+)\s*(?:bed|Bed|BR)/i)
    if (bedsMatch) result.bedrooms = parseInt(bedsMatch[1])

    const bathsMatch = html.match(/([\d.]+)\s*(?:bath|Bath|BA)/i)
    if (bathsMatch) result.bathrooms = parseFloat(bathsMatch[1])

    const sqftMatch = html.match(/([\d,]+)\s*(?:sq\s*ft|Sq\.\s*Ft)/i)
    if (sqftMatch) result.sqft = parseInt(sqftMatch[1].replace(/,/g, ''))

    const yearMatch = html.match(/(?:Built|Year Built)[:\s]*(\d{4})/i)
    if (yearMatch) result.year_built = parseInt(yearMatch[1])

    const lotMatch = html.match(/(?:Lot Size)[:\s]*([\d,.]+\s*(?:acres?|sq\s*ft))/i)
    if (lotMatch) result.lot_size = lotMatch[1]

    const typeMatch = html.match(/(?:Property Type|Style)[:\s]*(Single Family|Multi[- ]?Family|Condo|Townhouse|Land|Mobile)/i)
    if (typeMatch) result.property_type = typeMatch[1]

    const priceMatch = html.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*(?:Redfin Estimate|Estimate)/i)
    if (priceMatch) result.redfin_value = parseFloat(priceMatch[1].replace(/,/g, ''))

    return result
  } catch {
    return {}
  }
}
```

- [ ] **Step 2: Create scrape API route**

Create `src/app/api/properties/scrape/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { scrapePropertyData } from '@/lib/scraper'

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // Read-only for API routes
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { address } = await request.json()

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const data = await scrapePropertyData(address)
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ error: 'Scraping failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/scraper.ts src/app/api/properties/
git commit -m "feat: add property data scraping via Redfin"
```

---

## Task 15: Map Placeholder Component

**Files:**
- Create: `src/components/PropertyMap.tsx`

- [ ] **Step 1: Create placeholder map component**

Create `src/components/PropertyMap.tsx`:

```typescript
'use client'

import { useState } from 'react'

type MapProvider = 'google' | 'apple'

export default function PropertyMap({ address }: { address: string }) {
  const [provider, setProvider] = useState<MapProvider>('google')

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white overflow-hidden">
      {/* Map toggle */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setProvider('google')}
          disabled
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            provider === 'google'
              ? 'bg-neutral-100 text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-600'
          } opacity-50 cursor-not-allowed`}
        >
          Google Maps
        </button>
        <button
          onClick={() => setProvider('apple')}
          disabled
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            provider === 'apple'
              ? 'bg-neutral-100 text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-600'
          } opacity-50 cursor-not-allowed`}
        >
          Apple Maps
        </button>
      </div>

      {/* Placeholder */}
      <div className="flex h-48 flex-col items-center justify-center bg-neutral-50 px-4">
        <p className="text-sm font-medium text-neutral-500">Map coming soon</p>
        <p className="mt-1 text-center text-xs text-neutral-400 font-mono">{address}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PropertyMap.tsx
git commit -m "feat: add placeholder map component with Google/Apple toggle"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit any fixes needed**

If any of the above checks revealed issues, fix them and commit.

- [ ] **Step 6: Final commit with updated CLAUDE.md**

Update `CLAUDE.md` to reflect the new backend structure, then commit:

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Phase 2 backend architecture"
```
