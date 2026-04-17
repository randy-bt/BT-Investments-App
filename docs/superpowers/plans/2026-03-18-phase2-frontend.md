# Phase 2 Frontend Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all wireframe placeholder pages to backend server actions, creating a fully functional internal app with real data flow.

**Architecture:** Server Components fetch data via server actions and pass to Client Components for interactivity. Auth context is provided at the app layout level for client-side role checks. Shared UI components (DataTable, FormField, etc.) maintain the dashed-border design system.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Tiptap (rich text), Source Code Pro font (editable content), Supabase Auth

---

## File Structure

### New files to create:
- `src/app/app/layout.tsx` — App layout with auth context provider, Source Code Pro font
- `src/components/AuthProvider.tsx` — Client component: auth context for role checks
- `src/components/DashboardNotes.tsx` — Client component: Tiptap editor with autosave, version history, revert
- `src/components/SearchCommand.tsx` — Client component: Cmd+K spotlight search overlay
- `src/components/LeadsTable.tsx` — Client component: leads data table with filters
- `src/components/InvestorsTable.tsx` — Client component: investors data table with filters
- `src/components/LeadForm.tsx` — Client component: new lead form with dynamic phone/email/property rows
- `src/components/InvestorForm.tsx` — Client component: new investor form with dynamic phone/email rows
- `src/components/ActivityFeed.tsx` — Client component: updates feed with add/edit/delete
- `src/components/PropertyCard.tsx` — Client component: property details card with Populate button
- `src/components/PhoneEmailList.tsx` — Client component: inline add/remove phones and emails
- `src/components/StageBadge.tsx` — Server component: colored badge for lead stage
- `src/components/StatusBadge.tsx` — Server component: badge for active/closed status
- `src/components/ConfirmDialog.tsx` — Client component: simple confirm modal
- `src/components/UserManagement.tsx` — Client component: user table with role change/remove
- `src/app/app/acquisitions/lead-record/[id]/page.tsx` — Dynamic lead detail page (replaces static route)
- `src/app/app/dispositions/investor-database/page.tsx` — All investors list page
- `src/app/app/dispositions/new-investor/page.tsx` — New investor form page
- `src/app/app/dispositions/investor-record/[id]/page.tsx` — Dynamic investor detail page

### Files to modify:
- `src/app/layout.tsx` — Add Source Code Pro font import, update metadata
- `src/app/globals.css` — Add Source Code Pro CSS variable
- `src/app/app/page.tsx` — Wire up search, keep module links
- `src/app/app/acquisitions/page.tsx` — Wire up dashboard notes + lead search
- `src/app/app/acquisitions/all-leads/page.tsx` — Replace placeholder with LeadsTable
- `src/app/app/acquisitions/new-lead/page.tsx` — Replace placeholder with LeadForm
- `src/app/app/dispositions/page.tsx` — Wire up dashboard notes + investor search
- `src/app/app/settings/page.tsx` — Wire up user management

### Files to delete:
- `src/app/app/acquisitions/lead-record/page.tsx` — Replaced by dynamic `[id]/page.tsx`

---

### Task 1: Install Dependencies & Configure Fonts

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Install Tiptap packages**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline
```

- [ ] **Step 2: Add Source Code Pro font import to root layout**

Update `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Source_Code_Pro } from "next/font/google";
import "./globals.css";

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-source-code-pro",
});

export const metadata: Metadata = {
  title: "BT Investments",
  description: "Real estate investment management platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sourceCodePro.variable}>
      <body className="min-h-screen bg-neutral-100 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Add Source Code Pro utility class to globals.css**

Append to `src/app/globals.css`:

```css
.font-editable {
  font-family: var(--font-source-code-pro), ui-monospace, monospace;
}
```

- [ ] **Step 4: Verify the build compiles**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx src/app/globals.css
git commit -m "feat: install Tiptap and configure Source Code Pro font"
```

---

### Task 2: Auth Context Provider & App Layout

**Files:**
- Create: `src/components/AuthProvider.tsx`
- Create: `src/app/app/layout.tsx`

- [ ] **Step 1: Create AuthProvider client component**

Create `src/components/AuthProvider.tsx`:

```tsx
"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/types";

type AuthContextType = {
  user: User;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  return (
    <AuthContext.Provider value={{ user, isAdmin: user.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 2: Create app layout that fetches auth and wraps children**

Create `src/app/app/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { AuthProvider } from "@/components/AuthProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return <AuthProvider user={user}>{children}</AuthProvider>;
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/AuthProvider.tsx src/app/app/layout.tsx
git commit -m "feat: add auth context provider and app layout"
```

---

### Task 3: Shared UI Components (StatusBadge, StageBadge, ConfirmDialog)

**Files:**
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/StageBadge.tsx`
- Create: `src/components/ConfirmDialog.tsx`

- [ ] **Step 1: Create StatusBadge**

Create `src/components/StatusBadge.tsx`:

```tsx
import type { EntityStatus } from "@/lib/types";

const styles: Record<EntityStatus, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  closed: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

export function StatusBadge({ status }: { status: EntityStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
```

- [ ] **Step 2: Create StageBadge**

Create `src/components/StageBadge.tsx`:

```tsx
import type { LeadStage } from "@/lib/types";

const labels: Record<LeadStage, string> = {
  follow_up: "Follow Up",
  lead: "Lead",
  marketing_on_hold: "Marketing On Hold",
  marketing_active: "Marketing Active",
  assigned_in_escrow: "Assigned / In Escrow",
};

const styles: Record<LeadStage, string> = {
  follow_up: "bg-yellow-50 text-yellow-700 border-yellow-200",
  lead: "bg-blue-50 text-blue-700 border-blue-200",
  marketing_on_hold: "bg-orange-50 text-orange-700 border-orange-200",
  marketing_active: "bg-purple-50 text-purple-700 border-purple-200",
  assigned_in_escrow: "bg-green-50 text-green-700 border-green-200",
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${styles[stage]}`}
    >
      {labels[stage]}
    </span>
  );
}
```

- [ ] **Step 3: Create ConfirmDialog**

Create `src/components/ConfirmDialog.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-lg backdrop:bg-black/30"
    >
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <p className="mt-2 text-sm text-neutral-600">{message}</p>
      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusBadge.tsx src/components/StageBadge.tsx src/components/ConfirmDialog.tsx
git commit -m "feat: add StatusBadge, StageBadge, and ConfirmDialog components"
```

---

### Task 4: PhoneEmailList Component

**Files:**
- Create: `src/components/PhoneEmailList.tsx`

- [ ] **Step 1: Create PhoneEmailList component**

Create `src/components/PhoneEmailList.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";

type PhoneItem = {
  id: string;
  phone_number: string;
  label: string | null;
  is_primary: boolean;
};

type EmailItem = {
  id: string;
  email: string;
  label: string | null;
  is_primary: boolean;
};

type PhoneEmailListProps = {
  phones: PhoneItem[];
  emails: EmailItem[];
  onAddPhone: (data: {
    phone_number: string;
    label?: string;
    is_primary: boolean;
  }) => Promise<void>;
  onRemovePhone: (id: string) => Promise<void>;
  onAddEmail: (data: {
    email: string;
    label?: string;
    is_primary: boolean;
  }) => Promise<void>;
  onRemoveEmail: (id: string) => Promise<void>;
};

export function PhoneEmailList({
  phones,
  emails,
  onAddPhone,
  onRemovePhone,
  onAddEmail,
  onRemoveEmail,
}: PhoneEmailListProps) {
  const [isPending, startTransition] = useTransition();
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  function handleAddPhone() {
    if (!newPhone.trim()) return;
    startTransition(async () => {
      await onAddPhone({
        phone_number: newPhone.trim(),
        is_primary: phones.length === 0,
      });
      setNewPhone("");
    });
  }

  function handleAddEmail() {
    if (!newEmail.trim()) return;
    startTransition(async () => {
      await onAddEmail({
        email: newEmail.trim(),
        is_primary: emails.length === 0,
      });
      setNewEmail("");
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-medium text-neutral-700 mb-1">Phones</h4>
        <ul className="space-y-1">
          {phones.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border border-dashed border-neutral-200 px-2 py-1 text-sm font-editable"
            >
              <span>
                {p.phone_number}
                {p.label && (
                  <span className="ml-1 text-xs text-neutral-400">
                    ({p.label})
                  </span>
                )}
                {p.is_primary && (
                  <span className="ml-1 text-xs text-green-600">★</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => startTransition(() => onRemovePhone(p.id))}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex gap-1">
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Add phone..."
            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            onKeyDown={(e) => e.key === "Enter" && handleAddPhone()}
          />
          <button
            type="button"
            onClick={handleAddPhone}
            disabled={isPending}
            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
          >
            +
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-neutral-700 mb-1">Emails</h4>
        <ul className="space-y-1">
          {emails.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded border border-dashed border-neutral-200 px-2 py-1 text-sm font-editable"
            >
              <span>
                {e.email}
                {e.label && (
                  <span className="ml-1 text-xs text-neutral-400">
                    ({e.label})
                  </span>
                )}
                {e.is_primary && (
                  <span className="ml-1 text-xs text-green-600">★</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => startTransition(() => onRemoveEmail(e.id))}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex gap-1">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Add email..."
            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
          />
          <button
            type="button"
            onClick={handleAddEmail}
            disabled={isPending}
            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PhoneEmailList.tsx
git commit -m "feat: add PhoneEmailList component for inline phone/email management"
```

---

### Task 5: DashboardNotes Component (Tiptap + Autosave)

**Files:**
- Create: `src/components/DashboardNotes.tsx`

- [ ] **Step 1: Create DashboardNotes component**

Create `src/components/DashboardNotes.tsx`:

```tsx
"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  getDashboardNote,
  updateDashboardNote,
  getDashboardNoteVersions,
  revertDashboardNote,
} from "@/actions/dashboard-notes";
import type { DashboardNoteVersion } from "@/lib/types";

type DashboardNotesProps = {
  module: "acquisitions" | "dispositions";
};

export function DashboardNotes({ module }: DashboardNotesProps) {
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error" | "conflict"
  >("saved");
  const [conflictMsg, setConflictMsg] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<
    (DashboardNoteVersion & { editor_name: string })[]
  >([]);
  const [isPending, startTransition] = useTransition();

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none font-editable focus:outline-none min-h-[6rem] px-3 py-2",
      },
    },
    onUpdate: () => {
      setSaveStatus("saving");
    },
  });

  // Load initial content
  useEffect(() => {
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success && editor) {
        editor.commands.setContent(result.data.content || "");
        setUpdatedAt(result.data.updated_at);
        setSaveStatus("saved");
      }
    });
  }, [module, editor, startTransition]);

  // Autosave with debounce
  const save = useCallback(async () => {
    if (!editor || !updatedAt) return;
    const content = editor.getHTML();
    const result = await updateDashboardNote(module, content, updatedAt);
    if (result.success) {
      setUpdatedAt(result.data.updated_at);
      setSaveStatus("saved");
      setConflictMsg("");
    } else if (result.error.startsWith("CONFLICT:")) {
      const [, editor_name] = result.error.split(":");
      setConflictMsg(`${editor_name} edited this note. Reload to see changes.`);
      setSaveStatus("conflict");
    } else {
      setSaveStatus("error");
    }
  }, [editor, module, updatedAt]);

  useEffect(() => {
    if (saveStatus !== "saving") return;
    const timer = setTimeout(save, 1500);
    return () => clearTimeout(timer);
  }, [saveStatus, save]);

  async function loadVersions() {
    const result = await getDashboardNoteVersions(module);
    if (result.success) {
      setVersions(result.data);
      setShowVersions(true);
    }
  }

  async function handleRevert(versionId: string) {
    const result = await revertDashboardNote(module, versionId);
    if (result.success && editor) {
      editor.commands.setContent(result.data.content || "");
      setUpdatedAt(result.data.updated_at);
      setShowVersions(false);
      setSaveStatus("saved");
    }
  }

  if (!editor) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-700">Dashboard Notes</p>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "error" && (
            <span className="text-red-500">Save failed</span>
          )}
          {saveStatus === "conflict" && (
            <span className="text-orange-500">{conflictMsg}</span>
          )}
          <button
            type="button"
            onClick={loadVersions}
            className="underline hover:text-neutral-600"
          >
            History
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex gap-1 border-b border-dashed border-neutral-200 pb-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-2 py-0.5 text-xs ${
            editor.isActive("bold")
              ? "bg-neutral-200 font-bold"
              : "hover:bg-neutral-100"
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-2 py-0.5 text-xs italic ${
            editor.isActive("italic") ? "bg-neutral-200" : "hover:bg-neutral-100"
          }`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded px-2 py-0.5 text-xs underline ${
            editor.isActive("underline")
              ? "bg-neutral-200"
              : "hover:bg-neutral-100"
          }`}
        >
          U
        </button>
      </div>

      {/* Editor */}
      <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50">
        <EditorContent editor={editor} />
      </div>

      {/* Version history panel */}
      {showVersions && (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-neutral-700">
              Version History
            </h4>
            <button
              type="button"
              onClick={() => setShowVersions(false)}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              Close
            </button>
          </div>
          {versions.length === 0 ? (
            <p className="text-xs text-neutral-400">No previous versions</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-neutral-600">
                    {new Date(v.created_at).toLocaleString()} — {v.editor_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevert(v.id)}
                    disabled={isPending}
                    className="text-blue-600 hover:underline"
                  >
                    Revert
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardNotes.tsx
git commit -m "feat: add DashboardNotes component with Tiptap, autosave, and version history"
```

---

### Task 6: SearchCommand Component (Cmd+K Spotlight)

**Files:**
- Create: `src/components/SearchCommand.tsx`

- [ ] **Step 1: Create SearchCommand component**

Create `src/components/SearchCommand.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch } from "@/actions/search";
import type { SearchResults } from "@/lib/types";

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Cmd+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch({ query: query.trim() });
        if (res.success) setResults(res.data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, startTransition]);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery("");
      setResults(null);
      router.push(path);
    },
    [router]
  );

  if (!open) return null;

  const hasResults =
    results &&
    (results.leads.length > 0 ||
      results.investors.length > 0 ||
      results.properties.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-dashed border-neutral-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-dashed border-neutral-200 px-4">
          <span className="text-neutral-400 text-sm mr-2">⌘K</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads, investors, properties..."
            className="flex-1 py-3 text-sm outline-none font-editable"
          />
          {isPending && (
            <span className="text-xs text-neutral-400">Searching...</span>
          )}
        </div>

        {hasResults && (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.leads.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-medium text-neutral-400 uppercase">
                  Leads
                </p>
                {results.leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() =>
                      navigate(`/app/acquisitions/lead-record/${lead.id}`)
                    }
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
                  >
                    {lead.name}
                    <span className="ml-2 text-xs text-neutral-400">
                      {lead.stage}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {results.investors.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-medium text-neutral-400 uppercase">
                  Investors
                </p>
                {results.investors.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() =>
                      navigate(`/app/dispositions/investor-record/${inv.id}`)
                    }
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
                  >
                    {inv.name}
                  </button>
                ))}
              </div>
            )}

            {results.properties.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-medium text-neutral-400 uppercase">
                  Properties
                </p>
                {results.properties.map((prop) => (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/app/acquisitions/lead-record/${prop.lead_id}`
                      )
                    }
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
                  >
                    {prop.address}
                    <span className="ml-2 text-xs text-neutral-400">
                      ({prop.lead_name})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {query.length >= 2 && !isPending && !hasResults && (
          <p className="p-4 text-center text-sm text-neutral-400">
            No results found
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add SearchCommand to app layout**

Update `src/app/app/layout.tsx` to include `<SearchCommand />` alongside the `<AuthProvider>`:

```tsx
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { AuthProvider } from "@/components/AuthProvider";
import { SearchCommand } from "@/components/SearchCommand";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider user={user}>
      <SearchCommand />
      {children}
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SearchCommand.tsx src/app/app/layout.tsx
git commit -m "feat: add Cmd+K spotlight search with global search integration"
```

---

### Task 7: ActivityFeed Component

**Files:**
- Create: `src/components/ActivityFeed.tsx`

- [ ] **Step 1: Create ActivityFeed component**

Create `src/components/ActivityFeed.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createUpdate, editUpdate, deleteUpdate } from "@/actions/updates";
import type { Update, EntityType } from "@/lib/types";

type UpdateWithAuthor = Update & { author_name: string };

type ActivityFeedProps = {
  entityType: EntityType;
  entityId: string;
  initialUpdates: UpdateWithAuthor[];
};

export function ActivityFeed({
  entityType,
  entityId,
  initialUpdates,
}: ActivityFeedProps) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState(initialUpdates);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!newContent.trim()) return;
    startTransition(async () => {
      const result = await createUpdate({
        entity_type: entityType,
        entity_id: entityId,
        content: newContent.trim(),
      });
      if (result.success) {
        setUpdates((prev) => [
          { ...result.data, author_name: user.name },
          ...prev,
        ]);
        setNewContent("");
      }
    });
  }

  function handleEdit(id: string) {
    startTransition(async () => {
      const result = await editUpdate(id, { content: editContent });
      if (result.success) {
        setUpdates((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, content: result.data.content } : u
          )
        );
        setEditingId(null);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteUpdate(id);
      if (result.success) {
        setUpdates((prev) => prev.filter((u) => u.id !== id));
      }
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-neutral-700">
        Notes / Activity
      </h3>

      {/* Add new update */}
      <div className="flex gap-2">
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable resize-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !newContent.trim()}
          className="self-end rounded border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-xs hover:bg-neutral-100 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* Updates list */}
      <ul className="space-y-2">
        {updates.map((update) => (
          <li
            key={update.id}
            className="rounded border border-dashed border-neutral-200 p-2"
          >
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span>
                {update.author_name} —{" "}
                {new Date(update.created_at).toLocaleString()}
              </span>
              {update.author_id === user.id && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(update.id);
                      setEditContent(update.content);
                    }}
                    className="hover:text-neutral-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(update.id)}
                    disabled={isPending}
                    className="text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            {editingId === update.id ? (
              <div className="flex gap-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={2}
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable resize-none"
                />
                <div className="flex flex-col gap-1 self-end">
                  <button
                    type="button"
                    onClick={() => handleEdit(update.id)}
                    disabled={isPending}
                    className="rounded border border-neutral-400 px-2 py-0.5 text-xs hover:bg-neutral-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap font-editable">
                {update.content}
              </p>
            )}
          </li>
        ))}
      </ul>

      {updates.length === 0 && (
        <p className="text-xs text-neutral-400">No notes yet</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ActivityFeed.tsx
git commit -m "feat: add ActivityFeed component for notes/updates on leads and investors"
```

---

### Task 8: PropertyCard Component

**Files:**
- Create: `src/components/PropertyCard.tsx`

- [ ] **Step 1: Create PropertyCard component**

Create `src/components/PropertyCard.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateProperty } from "@/actions/properties";
import type { Property } from "@/lib/types";

type PropertyCardProps = {
  property: Property;
  onPopulate: (propertyId: string) => Promise<void>;
};

export function PropertyCard({ property, onPopulate }: PropertyCardProps) {
  const [prop, setProp] = useState(property);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function handleSave(field: keyof Property, value: string | number | null) {
    startTransition(async () => {
      const result = await updateProperty(prop.id, { [field]: value });
      if (result.success) {
        setProp(result.data);
      }
    });
  }

  const fields: { label: string; key: keyof Property; type: "text" | "number" }[] = [
    { label: "Address", key: "address", type: "text" },
    { label: "APN", key: "apn", type: "text" },
    { label: "Year Built", key: "year_built", type: "number" },
    { label: "Beds", key: "bedrooms", type: "number" },
    { label: "Baths", key: "bathrooms", type: "number" },
    { label: "Sqft", key: "sqft", type: "number" },
    { label: "Lot Size", key: "lot_size", type: "text" },
    { label: "Type", key: "property_type", type: "text" },
    { label: "Owner", key: "owner_name", type: "text" },
    { label: "Redfin Value", key: "redfin_value", type: "number" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-700">{prop.address}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => startTransition(() => onPopulate(prop.id))}
            disabled={isPending}
            className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50 disabled:opacity-50"
          >
            Populate
          </button>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50"
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {fields.map(({ label, key, type }) => (
          <div key={key} className="flex justify-between">
            <dt className="text-neutral-500">{label}</dt>
            {editing ? (
              <dd>
                <input
                  defaultValue={String(prop[key] ?? "")}
                  onBlur={(e) => {
                    const val =
                      type === "number"
                        ? e.target.value
                          ? Number(e.target.value)
                          : null
                        : e.target.value || null;
                    handleSave(key, val as string | number | null);
                  }}
                  className="w-24 rounded border border-neutral-200 px-1 py-0.5 text-right text-xs font-editable"
                />
              </dd>
            ) : (
              <dd className="text-neutral-700 font-editable">
                {key === "redfin_value" && prop[key]
                  ? `$${(prop[key] as number).toLocaleString()}`
                  : String(prop[key] ?? "—")}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PropertyCard.tsx
git commit -m "feat: add PropertyCard component with inline editing and Populate button"
```

---

### Task 9: LeadsTable Component

**Files:**
- Create: `src/components/LeadsTable.tsx`

- [ ] **Step 1: Create LeadsTable component**

Create `src/components/LeadsTable.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getLeads } from "@/actions/leads";
import { StatusBadge } from "@/components/StatusBadge";
import { StageBadge } from "@/components/StageBadge";
import type { Lead, LeadStage, EntityStatus, PaginatedResult } from "@/lib/types";

type LeadsTableProps = {
  initialData: PaginatedResult<Lead>;
};

export function LeadsTable({ initialData }: LeadsTableProps) {
  const [data, setData] = useState(initialData);
  const [statusFilter, setStatusFilter] = useState<EntityStatus | "">("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "">("");
  const [isPending, startTransition] = useTransition();

  function loadPage(page: number) {
    startTransition(async () => {
      const result = await getLeads({
        page,
        status: statusFilter || undefined,
        stage: stageFilter || undefined,
      });
      if (result.success) setData(result.data);
    });
  }

  function applyFilters() {
    loadPage(1);
  }

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 text-sm">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EntityStatus | "")}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as LeadStage | "")}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="">All Stages</option>
          <option value="follow_up">Follow Up</option>
          <option value="lead">Lead</option>
          <option value="marketing_on_hold">Marketing On Hold</option>
          <option value="marketing_active">Marketing Active</option>
          <option value="assigned_in_escrow">Assigned / In Escrow</option>
        </select>
        <button
          type="button"
          onClick={applyFilters}
          disabled={isPending}
          className="rounded border border-neutral-400 bg-neutral-50 px-3 py-1 hover:bg-neutral-100"
        >
          Filter
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-dashed border-neutral-100 hover:bg-neutral-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/app/acquisitions/lead-record/${lead.id}`}
                    className="text-neutral-800 hover:underline font-editable"
                  >
                    {lead.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <StageBadge stage={lead.stage} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {lead.source_campaign_name || "—"}
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-neutral-400"
                >
                  No leads found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>
            Page {data.page} of {totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadPage(data.page - 1)}
              disabled={data.page <= 1 || isPending}
              className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => loadPage(data.page + 1)}
              disabled={data.page >= totalPages || isPending}
              className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LeadsTable.tsx
git commit -m "feat: add LeadsTable component with filters and pagination"
```

---

### Task 10: InvestorsTable Component

**Files:**
- Create: `src/components/InvestorsTable.tsx`

- [ ] **Step 1: Create InvestorsTable component**

Create `src/components/InvestorsTable.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getInvestors } from "@/actions/investors";
import { StatusBadge } from "@/components/StatusBadge";
import type { Investor, EntityStatus, PaginatedResult } from "@/lib/types";

type InvestorsTableProps = {
  initialData: PaginatedResult<Investor>;
};

export function InvestorsTable({ initialData }: InvestorsTableProps) {
  const [data, setData] = useState(initialData);
  const [statusFilter, setStatusFilter] = useState<EntityStatus | "">("");
  const [isPending, startTransition] = useTransition();

  function loadPage(page: number) {
    startTransition(async () => {
      const result = await getInvestors({
        page,
        status: statusFilter || undefined,
      });
      if (result.success) setData(result.data);
    });
  }

  function applyFilters() {
    loadPage(1);
  }

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 text-sm">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EntityStatus | "")}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <button
          type="button"
          onClick={applyFilters}
          disabled={isPending}
          className="rounded border border-neutral-400 bg-neutral-50 px-3 py-1 hover:bg-neutral-100"
        >
          Filter
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Locations</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((investor) => (
              <tr
                key={investor.id}
                className="border-b border-dashed border-neutral-100 hover:bg-neutral-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/app/dispositions/investor-record/${investor.id}`}
                    className="text-neutral-800 hover:underline font-editable"
                  >
                    {investor.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {investor.company || "—"}
                </td>
                <td className="px-3 py-2 text-neutral-500 max-w-[200px] truncate">
                  {investor.locations_of_interest}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={investor.status} />
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {new Date(investor.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-neutral-400"
                >
                  No investors found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>
            Page {data.page} of {totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadPage(data.page - 1)}
              disabled={data.page <= 1 || isPending}
              className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => loadPage(data.page + 1)}
              disabled={data.page >= totalPages || isPending}
              className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/InvestorsTable.tsx
git commit -m "feat: add InvestorsTable component with filters and pagination"
```

---

### Task 11: LeadForm Component (New Lead)

**Files:**
- Create: `src/components/LeadForm.tsx`

- [ ] **Step 1: Create LeadForm component**

Create `src/components/LeadForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/actions/leads";

type PhoneRow = { phone_number: string; label: string; is_primary: boolean };
type EmailRow = { email: string; label: string; is_primary: boolean };
type PropertyRow = { address: string };

export function LeadForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [dateConverted, setDateConverted] = useState("");
  const [sourceCampaign, setSourceCampaign] = useState("");
  const [handoffNotes, setHandoffNotes] = useState("");
  const [mailingAddress, setMailingAddress] = useState("");
  const [occupancyStatus, setOccupancyStatus] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [sellingTimeline, setSellingTimeline] = useState("");

  const [phones, setPhones] = useState<PhoneRow[]>([
    { phone_number: "", label: "", is_primary: true },
  ]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([
    { address: "" },
  ]);

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await createLead({
        name,
        date_converted: dateConverted,
        source_campaign_name: sourceCampaign,
        handoff_notes: handoffNotes,
        mailing_address: mailingAddress || undefined,
        occupancy_status: occupancyStatus || undefined,
        asking_price: askingPrice ? Number(askingPrice) : undefined,
        selling_timeline: sellingTimeline || undefined,
        phones: phones.filter((p) => p.phone_number.trim()),
        emails: emails.filter((e) => e.email.trim()),
        properties: properties.filter((p) => p.address.trim()),
      });
      if (result.success) {
        router.push(`/app/acquisitions/lead-record/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Required fields */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Required Information
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs text-neutral-500">Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Date Converted *</span>
            <input
              type="date"
              value={dateConverted}
              onChange={(e) => setDateConverted(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">
              Source Campaign *
            </span>
            <input
              value={sourceCampaign}
              onChange={(e) => setSourceCampaign(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-neutral-500">Handoff Notes *</span>
          <textarea
            value={handoffNotes}
            onChange={(e) => setHandoffNotes(e.target.value)}
            rows={3}
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable resize-none"
          />
        </label>
      </div>

      {/* Optional fields */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Optional Details
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs text-neutral-500">Mailing Address</span>
            <input
              value={mailingAddress}
              onChange={(e) => setMailingAddress(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Occupancy Status</span>
            <input
              value={occupancyStatus}
              onChange={(e) => setOccupancyStatus(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Asking Price</span>
            <input
              type="number"
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">
              Selling Timeline
            </span>
            <input
              value={sellingTimeline}
              onChange={(e) => setSellingTimeline(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
        </div>
      </div>

      {/* Phones */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">
          Phone Numbers *
        </h3>
        {phones.map((phone, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={phone.phone_number}
              onChange={(e) => {
                const next = [...phones];
                next[i] = { ...next[i], phone_number: e.target.value };
                setPhones(next);
              }}
              placeholder="Phone number"
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            <input
              value={phone.label}
              onChange={(e) => {
                const next = [...phones];
                next[i] = { ...next[i], label: e.target.value };
                setPhones(next);
              }}
              placeholder="Label (mobile, home...)"
              className="w-32 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            {phones.length > 1 && (
              <button
                type="button"
                onClick={() => setPhones(phones.filter((_, j) => j !== i))}
                className="text-xs text-red-400 hover:text-red-600"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPhones([
              ...phones,
              { phone_number: "", label: "", is_primary: false },
            ])
          }
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add phone
        </button>
      </div>

      {/* Emails */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">Emails</h3>
        {emails.map((email, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={email.email}
              onChange={(e) => {
                const next = [...emails];
                next[i] = { ...next[i], email: e.target.value };
                setEmails(next);
              }}
              placeholder="Email address"
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            <button
              type="button"
              onClick={() => setEmails(emails.filter((_, j) => j !== i))}
              className="text-xs text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setEmails([
              ...emails,
              { email: "", label: "", is_primary: emails.length === 0 },
            ])
          }
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add email
        </button>
      </div>

      {/* Properties */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">Properties *</h3>
        {properties.map((prop, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={prop.address}
              onChange={(e) => {
                const next = [...properties];
                next[i] = { address: e.target.value };
                setProperties(next);
              }}
              placeholder="Property address"
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            {properties.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setProperties(properties.filter((_, j) => j !== i))
                }
                className="text-xs text-red-400 hover:text-red-600"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setProperties([...properties, { address: "" }])}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add property
        </button>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="rounded border border-neutral-400 bg-neutral-50 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create Lead"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LeadForm.tsx
git commit -m "feat: add LeadForm component with dynamic phone/email/property rows"
```

---

### Task 12: InvestorForm Component (New Investor)

**Files:**
- Create: `src/components/InvestorForm.tsx`

- [ ] **Step 1: Create InvestorForm component**

Create `src/components/InvestorForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvestor } from "@/actions/investors";

type PhoneRow = { phone_number: string; label: string; is_primary: boolean };
type EmailRow = { email: string; label: string; is_primary: boolean };

export function InvestorForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [locationsOfInterest, setLocationsOfInterest] = useState("");
  const [dealsNotes, setDealsNotes] = useState("");

  const [phones, setPhones] = useState<PhoneRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await createInvestor({
        name,
        locations_of_interest: locationsOfInterest,
        company: company || undefined,
        deals_notes: dealsNotes || undefined,
        phones: phones.filter((p) => p.phone_number.trim()),
        emails: emails.filter((e) => e.email.trim()),
      });
      if (result.success) {
        router.push(`/app/dispositions/investor-record/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Investor Information
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs text-neutral-500">Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Company</span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-neutral-500">
            Locations of Interest *
          </span>
          <input
            value={locationsOfInterest}
            onChange={(e) => setLocationsOfInterest(e.target.value)}
            placeholder="e.g. Phoenix, AZ; Tucson, AZ"
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
          />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">Deals / Notes</span>
          <textarea
            value={dealsNotes}
            onChange={(e) => setDealsNotes(e.target.value)}
            rows={3}
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable resize-none"
          />
        </label>
      </div>

      {/* Phones */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">Phone Numbers</h3>
        {phones.map((phone, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={phone.phone_number}
              onChange={(e) => {
                const next = [...phones];
                next[i] = { ...next[i], phone_number: e.target.value };
                setPhones(next);
              }}
              placeholder="Phone number"
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            <button
              type="button"
              onClick={() => setPhones(phones.filter((_, j) => j !== i))}
              className="text-xs text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPhones([
              ...phones,
              { phone_number: "", label: "", is_primary: phones.length === 0 },
            ])
          }
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add phone
        </button>
      </div>

      {/* Emails */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">Emails</h3>
        {emails.map((email, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={email.email}
              onChange={(e) => {
                const next = [...emails];
                next[i] = { ...next[i], email: e.target.value };
                setEmails(next);
              }}
              placeholder="Email address"
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            <button
              type="button"
              onClick={() => setEmails(emails.filter((_, j) => j !== i))}
              className="text-xs text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setEmails([
              ...emails,
              { email: "", label: "", is_primary: emails.length === 0 },
            ])
          }
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add email
        </button>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="rounded border border-neutral-400 bg-neutral-50 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create Investor"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/InvestorForm.tsx
git commit -m "feat: add InvestorForm component with dynamic phone/email rows"
```

---

### Task 13: UserManagement Component

**Files:**
- Create: `src/components/UserManagement.tsx`

- [ ] **Step 1: Create UserManagement component**

Create `src/components/UserManagement.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { changeUserRole, removeUser } from "@/actions/users";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { User, UserRole } from "@/lib/types";

type UserManagementProps = {
  initialUsers: User[];
};

export function UserManagement({ initialUsers }: UserManagementProps) {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState(initialUsers);
  const [isPending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  function handleRoleChange(userId: string, role: UserRole) {
    startTransition(async () => {
      const result = await changeUserRole(userId, { role });
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? result.data : u))
        );
      }
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      const result = await removeUser(userId);
      if (result.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      }
      setConfirmRemove(null);
    });
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-neutral-500">
        Only admins can manage users.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-dashed border-neutral-100"
              >
                <td className="px-3 py-2 font-editable">{u.name}</td>
                <td className="px-3 py-2 text-neutral-500">{u.email}</td>
                <td className="px-3 py-2">
                  {u.id === currentUser.id ? (
                    <span className="text-xs text-neutral-500">{u.role}</span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={(e) =>
                        handleRoleChange(u.id, e.target.value as UserRole)
                      }
                      disabled={isPending}
                      className="rounded border border-neutral-300 px-1 py-0.5 text-xs"
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  {u.id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(u.id)}
                      disabled={isPending}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove User"
        message="This will permanently delete this user and revoke their access. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => confirmRemove && handleRemove(confirmRemove)}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/UserManagement.tsx
git commit -m "feat: add UserManagement component with role change and user removal"
```

---

### Task 14: Wire Up App Home Page (Search)

**Files:**
- Modify: `src/app/app/page.tsx`

- [ ] **Step 1: Update App Home page**

Replace `src/app/app/page.tsx` with functional search and module links. The global Cmd+K search is already available via layout; the home page search input will focus the Cmd+K overlay:

```tsx
import Link from "next/link";

export default function AppHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App
          </h1>
          <p className="text-sm text-neutral-600">app.btinvestments.co</p>
        </div>
        <Link href="/" className="text-sm text-neutral-600 hover:underline">
          ← Back to public site
        </Link>
      </header>

      <section className="grid gap-8 md:grid-cols-[2fr,1.5fr]">
        <div className="space-y-6 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700">
            Universal Search
          </h2>
          <p className="text-sm text-neutral-500">
            Press{" "}
            <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-xs">
              ⌘K
            </kbd>{" "}
            to search leads, investors, and properties.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700">App Modules</h2>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <Link
              href="/app/acquisitions"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Acquisitions →
            </Link>
            <Link
              href="/app/dispositions"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Dispositions →
            </Link>
            <Link
              href="/app/settings"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Settings →
            </Link>
          </div>
          <p className="text-xs text-neutral-400 pt-2">
            SMS Marketing, Marketing Page Creator, Contract Creator, and Housing
            Market News modules are planned for future phases.
          </p>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/page.tsx
git commit -m "feat: wire up app home page with search prompt and active module links"
```

---

### Task 15: Wire Up Acquisitions Dashboard

**Files:**
- Modify: `src/app/app/acquisitions/page.tsx`

- [ ] **Step 1: Update Acquisitions page with DashboardNotes and lead search link**

Replace `src/app/app/acquisitions/page.tsx`:

```tsx
import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";
import { DashboardNotes } from "@/components/DashboardNotes";

export default function AcquisitionsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Acquisitions
          </h1>
          <p className="text-sm text-neutral-600">Lead management dashboard</p>
        </div>
        <AppBackLink href="/app" />
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm text-neutral-500">
            Press{" "}
            <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-xs">
              ⌘K
            </kbd>{" "}
            to search leads by name, phone, email, or property address.
          </p>
        </div>

        <DashboardNotes module="acquisitions" />

        <div className="flex flex-wrap gap-3 pt-2 text-sm">
          <Link
            href="/app/acquisitions/all-leads"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            All Leads →
          </Link>
          <Link
            href="/app/acquisitions/new-lead"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            Add New Lead →
          </Link>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/acquisitions/page.tsx
git commit -m "feat: wire up acquisitions dashboard with DashboardNotes and search"
```

---

### Task 16: Wire Up All Leads Page

**Files:**
- Modify: `src/app/app/acquisitions/all-leads/page.tsx`

- [ ] **Step 1: Update All Leads page with LeadsTable**

Replace `src/app/app/acquisitions/all-leads/page.tsx`:

```tsx
import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";
import { LeadsTable } from "@/components/LeadsTable";
import { getLeads } from "@/actions/leads";

export default async function AllLeadsPage() {
  const result = await getLeads({ page: 1, pageSize: 50 });

  if (!result.success) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
        <p className="text-sm text-red-600">Error loading leads: {result.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">All Leads</h1>
          <p className="text-sm text-neutral-600">{result.data.total} leads</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/app/acquisitions/new-lead"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            + New Lead
          </Link>
          <AppBackLink href="/app/acquisitions" />
        </div>
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <LeadsTable initialData={result.data} />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/acquisitions/all-leads/page.tsx
git commit -m "feat: wire up all leads page with LeadsTable and server-side data fetch"
```

---

### Task 17: Wire Up New Lead Page

**Files:**
- Modify: `src/app/app/acquisitions/new-lead/page.tsx`

- [ ] **Step 1: Update New Lead page with LeadForm**

Replace `src/app/app/acquisitions/new-lead/page.tsx`:

```tsx
import { AppBackLink } from "@/components/AppBackLink";
import { LeadForm } from "@/components/LeadForm";

export default function NewLeadPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Lead</h1>
          <p className="text-sm text-neutral-600">
            Create a new lead record
          </p>
        </div>
        <AppBackLink href="/app/acquisitions" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <LeadForm />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/acquisitions/new-lead/page.tsx
git commit -m "feat: wire up new lead page with LeadForm"
```

---

### Task 18: Dynamic Lead Record Page

**Files:**
- Delete: `src/app/app/acquisitions/lead-record/page.tsx`
- Create: `src/app/app/acquisitions/lead-record/[id]/page.tsx`

- [ ] **Step 1: Delete static lead-record page**

```bash
rm src/app/app/acquisitions/lead-record/page.tsx
```

- [ ] **Step 2: Create dynamic lead record page**

Create `src/app/app/acquisitions/lead-record/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { AppBackLink } from "@/components/AppBackLink";
import { getLead, archiveLead, reopenLead, changeLeadStage } from "@/actions/leads";
import { addLeadPhone, removeLeadPhone, addLeadEmail, removeLeadEmail } from "@/actions/leads";
import { getUpdates } from "@/actions/updates";
import { StageBadge } from "@/components/StageBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { PhoneEmailList } from "@/components/PhoneEmailList";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PropertyCard } from "@/components/PropertyCard";
import { LeadRecordActions } from "./actions";

export default async function LeadRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [leadResult, updatesResult] = await Promise.all([
    getLead(id),
    getUpdates("lead", id),
  ]);

  if (!leadResult.success) notFound();
  const lead = leadResult.data;
  const updates = updatesResult.success ? updatesResult.data.items : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-editable">
            {lead.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <StageBadge stage={lead.stage} />
            <StatusBadge status={lead.status} />
          </div>
        </div>
        <AppBackLink href="/app/acquisitions/all-leads" />
      </header>

      <section className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Lead details */}
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-medium text-neutral-700">Lead Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-neutral-500">Campaign</dt>
                <dd className="font-editable">{lead.source_campaign_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Date Converted</dt>
                <dd className="font-editable">{lead.date_converted || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Mailing Address</dt>
                <dd className="font-editable">{lead.mailing_address || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Occupancy</dt>
                <dd className="font-editable">{lead.occupancy_status || "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Asking Price</dt>
                <dd className="font-editable">
                  {lead.asking_price ? `$${lead.asking_price.toLocaleString()}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Selling Timeline</dt>
                <dd className="font-editable">{lead.selling_timeline || "—"}</dd>
              </div>
            </dl>
            {lead.handoff_notes && (
              <div>
                <dt className="text-xs text-neutral-500 mb-1">Handoff Notes</dt>
                <dd className="text-sm font-editable whitespace-pre-wrap rounded border border-dashed border-neutral-200 p-2 bg-neutral-50">
                  {lead.handoff_notes}
                </dd>
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-neutral-700 mb-3">Contact Info</h2>
            <PhoneEmailList
              phones={lead.phones}
              emails={lead.emails}
              onAddPhone={async (data) => {
                "use server";
                await addLeadPhone(id, data);
              }}
              onRemovePhone={async (phoneId) => {
                "use server";
                await removeLeadPhone(phoneId);
              }}
              onAddEmail={async (data) => {
                "use server";
                await addLeadEmail(id, data);
              }}
              onRemoveEmail={async (emailId) => {
                "use server";
                await removeLeadEmail(emailId);
              }}
            />
          </div>

          {/* Properties */}
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-medium text-neutral-700">Properties</h2>
            {lead.properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onPopulate={async (propertyId) => {
                  "use server";
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_APP_URL}/api/properties/scrape`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        propertyId,
                        address: property.address,
                      }),
                    }
                  );
                  if (!res.ok) throw new Error("Scrape failed");
                }}
              />
            ))}
            {lead.properties.length === 0 && (
              <p className="text-xs text-neutral-400">No properties</p>
            )}
          </div>

          {/* Activity feed */}
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
            <ActivityFeed
              entityType="lead"
              entityId={id}
              initialUpdates={updates}
            />
          </div>
        </div>

        {/* Right column — Actions */}
        <div className="space-y-4">
          <LeadRecordActions lead={lead} />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Create the lead record actions client component**

Create `src/app/app/acquisitions/lead-record/[id]/actions.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  archiveLead,
  reopenLead,
  changeLeadStage,
} from "@/actions/leads";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useState } from "react";
import type { LeadWithRelations, LeadStage } from "@/lib/types";

export function LeadRecordActions({ lead }: { lead: LeadWithRelations }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showArchive, setShowArchive] = useState(false);

  function handleStageChange(stage: LeadStage) {
    startTransition(async () => {
      await changeLeadStage(lead.id, { stage });
      router.refresh();
    });
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveLead(lead.id);
      setShowArchive(false);
      router.refresh();
    });
  }

  function handleReopen() {
    startTransition(async () => {
      await reopenLead(lead.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-medium text-neutral-700">Actions</h2>

      {isAdmin && (
        <>
          <div>
            <label className="text-xs text-neutral-500">Change Stage</label>
            <select
              value={lead.stage}
              onChange={(e) => handleStageChange(e.target.value as LeadStage)}
              disabled={isPending}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="follow_up">Follow Up</option>
              <option value="lead">Lead</option>
              <option value="marketing_on_hold">Marketing On Hold</option>
              <option value="marketing_active">Marketing Active</option>
              <option value="assigned_in_escrow">Assigned / In Escrow</option>
            </select>
          </div>

          {lead.status === "active" ? (
            <button
              type="button"
              onClick={() => setShowArchive(true)}
              disabled={isPending}
              className="w-full rounded border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
            >
              Archive Lead
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReopen}
              disabled={isPending}
              className="w-full rounded border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100"
            >
              Reopen Lead
            </button>
          )}
        </>
      )}

      {!isAdmin && (
        <p className="text-xs text-neutral-400">
          Stage changes and archiving require admin access.
        </p>
      )}

      <ConfirmDialog
        open={showArchive}
        title="Archive Lead"
        message="This will mark the lead as closed. You can reopen it later."
        confirmLabel="Archive"
        onConfirm={handleArchive}
        onCancel={() => setShowArchive(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A src/app/app/acquisitions/lead-record/
git commit -m "feat: create dynamic lead record page with full data wiring"
```

---

### Task 19: Wire Up Dispositions Dashboard

**Files:**
- Modify: `src/app/app/dispositions/page.tsx`

- [ ] **Step 1: Update Dispositions page with DashboardNotes**

Replace `src/app/app/dispositions/page.tsx`:

```tsx
import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";
import { DashboardNotes } from "@/components/DashboardNotes";

export default function DispositionsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Dispositions
          </h1>
          <p className="text-sm text-neutral-600">
            Investor management dashboard
          </p>
        </div>
        <AppBackLink href="/app" />
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm text-neutral-500">
            Press{" "}
            <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-xs">
              ⌘K
            </kbd>{" "}
            to search investors by name, phone, email, or location.
          </p>
        </div>

        <DashboardNotes module="dispositions" />

        <div className="flex flex-wrap gap-3 pt-2 text-sm">
          <Link
            href="/app/dispositions/investor-database"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            Investor Database →
          </Link>
          <Link
            href="/app/dispositions/new-investor"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            Add New Investor →
          </Link>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/dispositions/page.tsx
git commit -m "feat: wire up dispositions dashboard with DashboardNotes and search"
```

---

### Task 20: Investor Database, New Investor, and Investor Record Pages

**Files:**
- Create: `src/app/app/dispositions/investor-database/page.tsx`
- Create: `src/app/app/dispositions/new-investor/page.tsx`
- Create: `src/app/app/dispositions/investor-record/[id]/page.tsx`
- Create: `src/app/app/dispositions/investor-record/[id]/actions.tsx`

- [ ] **Step 1: Create investor database page**

Create `src/app/app/dispositions/investor-database/page.tsx`:

```tsx
import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";
import { InvestorsTable } from "@/components/InvestorsTable";
import { getInvestors } from "@/actions/investors";

export default async function InvestorDatabasePage() {
  const result = await getInvestors({ page: 1, pageSize: 50 });

  if (!result.success) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
        <p className="text-sm text-red-600">Error: {result.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Investor Database
          </h1>
          <p className="text-sm text-neutral-600">
            {result.data.total} investors
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/app/dispositions/new-investor"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            + New Investor
          </Link>
          <AppBackLink href="/app/dispositions" />
        </div>
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <InvestorsTable initialData={result.data} />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Create new investor page**

Create `src/app/app/dispositions/new-investor/page.tsx`:

```tsx
import { AppBackLink } from "@/components/AppBackLink";
import { InvestorForm } from "@/components/InvestorForm";

export default function NewInvestorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            New Investor
          </h1>
          <p className="text-sm text-neutral-600">
            Add a new investor to the database
          </p>
        </div>
        <AppBackLink href="/app/dispositions" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <InvestorForm />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Create investor record actions client component**

Create `src/app/app/dispositions/investor-record/[id]/actions.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { archiveInvestor, reopenInvestor } from "@/actions/investors";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { InvestorWithRelations } from "@/lib/types";

export function InvestorRecordActions({
  investor,
}: {
  investor: InvestorWithRelations;
}) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showArchive, setShowArchive] = useState(false);

  function handleArchive() {
    startTransition(async () => {
      await archiveInvestor(investor.id);
      setShowArchive(false);
      router.refresh();
    });
  }

  function handleReopen() {
    startTransition(async () => {
      await reopenInvestor(investor.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-medium text-neutral-700">Actions</h2>

      {isAdmin && (
        <>
          {investor.status === "active" ? (
            <button
              type="button"
              onClick={() => setShowArchive(true)}
              disabled={isPending}
              className="w-full rounded border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
            >
              Archive Investor
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReopen}
              disabled={isPending}
              className="w-full rounded border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100"
            >
              Reopen Investor
            </button>
          )}
        </>
      )}

      {!isAdmin && (
        <p className="text-xs text-neutral-400">
          Archiving and reopening require admin access.
        </p>
      )}

      <ConfirmDialog
        open={showArchive}
        title="Archive Investor"
        message="This will mark the investor as closed. You can reopen them later."
        confirmLabel="Archive"
        onConfirm={handleArchive}
        onCancel={() => setShowArchive(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create dynamic investor record page**

Create `src/app/app/dispositions/investor-record/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { AppBackLink } from "@/components/AppBackLink";
import { getInvestor } from "@/actions/investors";
import { addInvestorPhone, removeInvestorPhone, addInvestorEmail, removeInvestorEmail } from "@/actions/investors";
import { getUpdates } from "@/actions/updates";
import { StatusBadge } from "@/components/StatusBadge";
import { PhoneEmailList } from "@/components/PhoneEmailList";
import { ActivityFeed } from "@/components/ActivityFeed";
import { InvestorRecordActions } from "./actions";

export default async function InvestorRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [investorResult, updatesResult] = await Promise.all([
    getInvestor(id),
    getUpdates("investor", id),
  ]);

  if (!investorResult.success) notFound();
  const investor = investorResult.data;
  const updates = updatesResult.success ? updatesResult.data.items : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-editable">
            {investor.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={investor.status} />
            {investor.company && (
              <span className="text-sm text-neutral-500">{investor.company}</span>
            )}
          </div>
        </div>
        <AppBackLink href="/app/dispositions/investor-database" />
      </header>

      <section className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Investor details */}
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-medium text-neutral-700">Investor Details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-neutral-500">Locations of Interest</dt>
                <dd className="font-editable">{investor.locations_of_interest}</dd>
              </div>
              {investor.deals_notes && (
                <div>
                  <dt className="text-neutral-500">Deals / Notes</dt>
                  <dd className="font-editable whitespace-pre-wrap rounded border border-dashed border-neutral-200 p-2 bg-neutral-50">
                    {investor.deals_notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Contact info */}
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-neutral-700 mb-3">Contact Info</h2>
            <PhoneEmailList
              phones={investor.phones}
              emails={investor.emails}
              onAddPhone={async (data) => {
                "use server";
                await addInvestorPhone(id, data);
              }}
              onRemovePhone={async (phoneId) => {
                "use server";
                await removeInvestorPhone(phoneId);
              }}
              onAddEmail={async (data) => {
                "use server";
                await addInvestorEmail(id, data);
              }}
              onRemoveEmail={async (emailId) => {
                "use server";
                await removeInvestorEmail(emailId);
              }}
            />
          </div>

          {/* Activity feed */}
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
            <ActivityFeed
              entityType="investor"
              entityId={id}
              initialUpdates={updates}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <InvestorRecordActions investor={investor} />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/app/dispositions/investor-database/ src/app/app/dispositions/new-investor/ src/app/app/dispositions/investor-record/
git commit -m "feat: add investor database, new investor, and dynamic investor record pages"
```

---

### Task 21: Wire Up Settings Page (User Management)

**Files:**
- Modify: `src/app/app/settings/page.tsx`

- [ ] **Step 1: Update Settings page with UserManagement**

Replace `src/app/app/settings/page.tsx`:

```tsx
import { AppBackLink } from "@/components/AppBackLink";
import { UserManagement } from "@/components/UserManagement";
import { getUsers } from "@/actions/users";

export default async function AppSettingsPage() {
  const result = await getUsers();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-neutral-600">
            App preferences and user management
          </p>
        </div>
        <AppBackLink href="/app" />
      </header>

      <section className="space-y-6">
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700 mb-4">
            Team Members
          </h2>
          {result.success ? (
            <UserManagement initialUsers={result.data} />
          ) : (
            <p className="text-sm text-neutral-500">{result.error}</p>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-400 shadow-sm">
          API connections, templates, and app preferences coming in a future
          phase.
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/settings/page.tsx
git commit -m "feat: wire up settings page with user management"
```

---

### Task 22: Final Build Verification & Lint

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

```bash
npm run lint
```
Expected: No errors (warnings OK).

- [ ] **Step 2: Run tests**

```bash
npm run test
```
Expected: All existing tests pass.

- [ ] **Step 3: Run production build**

```bash
npm run build
```
Expected: Build succeeds with all pages compiled.

- [ ] **Step 4: Fix any lint/build errors found above**

Address any issues discovered in the previous steps.

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve lint and build issues from frontend integration"
```

---

### Task 23: Push to GitHub

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```
