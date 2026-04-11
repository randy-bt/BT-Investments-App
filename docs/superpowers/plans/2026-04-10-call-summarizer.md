# Call Summarizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app "Summarize" button next to audio attachments that transcribes the audio (OpenAI GPT-4o Mini Transcribe) and posts an AI-generated bullet-point summary (Claude Sonnet 4.6) as a visually distinct note in the activity feed, with hashtags that auto-update lead fields.

**Architecture:** A single Next.js API route (`/api/summarize`) handles the full pipeline: download audio from Supabase storage → send to OpenAI for transcription → send transcript + prompt to Anthropic for summarization → create an update note via Supabase. The frontend adds a "Summarize" button to audio attachments in the `FileAttachments` component, calls the API, and renders AI summary notes with a distinct lighter-gray background and "— AI Summary —" header. One summary per audio is enforced by content-matching existing notes.

**Tech Stack:** Next.js 16 API route, OpenAI SDK (transcription), Anthropic SDK (summarization), Supabase (storage + DB), existing Server Actions for updates

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/api/summarize/route.ts` | API route: download audio, transcribe, summarize, save note |
| Create | `src/lib/prompts/call-summary.ts` | Summarization prompt constant |
| Modify | `src/components/ActivityFeed.tsx` | Add Summarize button to audio attachments, distinct AI summary styling |
| Modify | `.env.local` | Add `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` |
| Modify | `.env.example` | Add placeholder entries for new API keys |
| Modify | `package.json` | Add `openai` and `@anthropic-ai/sdk` dependencies |

---

### Task 1: Install Dependencies and Configure Environment

**Files:**
- Modify: `package.json`
- Modify: `.env.local`
- Modify: `.env.example`

- [ ] **Step 1: Install OpenAI and Anthropic SDKs**

```bash
cd "/Users/groovehouseent/Desktop/Bt Investments App Development/bt-investments"
npm install openai @anthropic-ai/sdk
```

- [ ] **Step 2: Add API keys to `.env.local`**

Add these two lines to the end of `.env.local`:

```
# AI Services (Call Summarizer)
OPENAI_API_KEY=<your-openai-api-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

- [ ] **Step 3: Add placeholder entries to `.env.example`**

Add these two lines to the end of `.env.example`:

```
# AI Services (Call Summarizer)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

- [ ] **Step 4: Verify the app still builds**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: add OpenAI and Anthropic SDK dependencies for call summarizer"
```

Note: Do NOT commit `.env.local` — it contains secrets.

---

### Task 2: Create the Summarization Prompt

**Files:**
- Create: `src/lib/prompts/call-summary.ts`

- [ ] **Step 1: Create the prompt file**

Create `src/lib/prompts/call-summary.ts`:

```typescript
/**
 * Prompt for summarizing cold-call transcripts.
 * Used by the /api/summarize route with Claude Sonnet 4.6.
 *
 * The AI receives this prompt + lead metadata (for context) + the transcript.
 * Output: bullet-point summary using • character, followed by hashtags.
 */
export const CALL_SUMMARY_PROMPT = `You are analyzing cold call transcripts for a real estate acquisitions company (BT Investments).

Your job is to extract only relevant deal information from the call.

---

## OBJECTIVE

Read the transcript and produce a concise summary using bullet points.

Only include information that was explicitly stated in the call. Never assume or infer missing details.

---

## WHAT TO IDENTIFY

Focus only on the following:

- Relationship to property (owner, tenant, family member, etc.)
- Whether the property address was confirmed
- Seller's willingness to sell
- Motivation signals (if any)
- Property condition (updates, issues, renovations)
- Occupancy status (owner-occupied, tenant, vacant)
- Asking price or price expectations
- Timeline (selling, moving, lease end, etc.)
- Any requests or next steps from seller
- Any complications or red flags (bank, liens, attitude, etc.)
- Email or contact info mentioned

---

## WHAT TO IGNORE

- Small talk or filler
- Repeated back-and-forth with no new info
- The agent's pitch (unless seller reacts meaningfully)
- Questions that were not answered

---

## OUTPUT FORMAT

Return ONLY bullet points followed by hashtags. Nothing else.

Rules:
- Use the \u2022 character for every bullet. No dashes, no asterisks, no markdown formatting.
- One idea per bullet
- No fluff or extra wording
- Do NOT include the lead's name, address, phone, or campaign in the output
- Do NOT include any headers, titles, or section labels

Order bullets (if applicable):

1. Relationship to property / address confirmation
2. Willingness to sell
3. Condition
4. Occupancy
5. Price
6. Timeline
7. Seller requests / next steps
8. Complications / flags

If something important is missing, explicitly state it (e.g. "Address not confirmed").

---

## HASHTAGS

After the bullets, add a blank line, then include hashtags ONLY for information explicitly confirmed in the call.

Each hashtag on its own line, with the value after it:

#asking_price [value]
#our_current_offer [value]
#range [value]
#condition [value]
#selling_timeline [value]
#email [value]
#occupancy_status [value]

Do NOT include a hashtag unless that information was clearly provided.

---

## RULES

- Never assume or fill in gaps
- If unclear or cut off, say so
- Do not combine multiple ideas in one bullet
- Do not add opinions or strategy
- Keep everything concise and direct
- If very little information is available, output very few bullets`
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompts/call-summary.ts
git commit -m "feat: add call summary prompt for AI transcription pipeline"
```

---

### Task 3: Create the Summarize API Route

**Files:**
- Create: `src/app/api/summarize/route.ts`

This route handles the full pipeline: authenticate user → download audio from Supabase → transcribe with OpenAI → summarize with Anthropic → create update note → return the note.

- [ ] **Step 1: Create the API route**

Create `src/app/api/summarize/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { CALL_SUMMARY_PROMPT } from '@/lib/prompts/call-summary'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const OPENAI_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe-2025-12-15'
const ANTHROPIC_SUMMARY_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_MAX_TOKENS = 2500

// Prefix that marks a note as an AI summary
export const AI_SUMMARY_PREFIX = '— AI Summary —\n\n'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const body = await request.json()
    const { attachmentId, entityType, entityId, leadName, leadAddress } = body as {
      attachmentId: string
      entityType: 'lead' | 'investor'
      entityId: string
      leadName?: string
      leadAddress?: string
    }

    if (!attachmentId || !entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 1. Get the attachment record to find storage path
    const supabase = await createServerClient()
    const { data: attachment } = await supabase
      .from('attachments')
      .select('storage_path, file_name, file_type, update_id')
      .eq('id', attachmentId)
      .single()

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      )
    }

    // Verify it's an audio file
    if (!attachment.file_type?.startsWith('audio/')) {
      return NextResponse.json(
        { success: false, error: 'Attachment is not an audio file' },
        { status: 400 }
      )
    }

    // 2. Check if a summary already exists for this audio's update
    const { data: existingSummaries } = await supabase
      .from('updates')
      .select('id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .like('content', `${AI_SUMMARY_PREFIX}%`)

    // Check if any existing summary references this attachment's update_id
    // We store a marker in the content to link summary -> source audio
    const marker = `[summary-of:${attachment.update_id}]`
    const alreadySummarized = existingSummaries?.some((u) => {
      // We need to check full content, but select only gave us id
      // Instead, do a direct check
      return false
    })

    // More reliable: check with a content match
    const { count: existingCount } = await supabase
      .from('updates')
      .select('*', { count: 'exact', head: true })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .like('content', `%${marker}%`)

    if ((existingCount ?? 0) > 0) {
      return NextResponse.json(
        { success: false, error: 'This audio has already been summarized' },
        { status: 409 }
      )
    }

    // 3. Download audio from Supabase storage
    const admin = createAdminClient()
    const { data: fileData, error: downloadError } = await admin.storage
      .from('attachments')
      .download(attachment.storage_path)

    if (downloadError || !fileData) {
      return NextResponse.json(
        { success: false, error: 'Could not download audio file' },
        { status: 500 }
      )
    }

    // 4. Transcribe with OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const audioBuffer = Buffer.from(await fileData.arrayBuffer())
    const audioFile = new File([audioBuffer], attachment.file_name, {
      type: attachment.file_type || 'audio/webm',
    })

    const transcription = await openai.audio.transcriptions.create({
      model: OPENAI_TRANSCRIPTION_MODEL,
      file: audioFile,
    })

    const transcript = transcription.text?.trim()
    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcription returned empty result' },
        { status: 500 }
      )
    }

    // 5. Build context for summarization
    let metadataContext = ''
    if (leadName || leadAddress) {
      metadataContext = '\n\n---\n\n## LEAD CONTEXT\n\n'
      if (leadName) metadataContext += `Name: ${leadName}\n`
      if (leadAddress) metadataContext += `Address: ${leadAddress}\n`
    }

    const fullPrompt = `${CALL_SUMMARY_PROMPT}${metadataContext}

---

## TRANSCRIPT

${transcript}`

    // 6. Summarize with Anthropic
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: ANTHROPIC_SUMMARY_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      messages: [{ role: 'user', content: fullPrompt }],
    })

    const summary = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text.trim())
      .join('\n')
      .trim()

    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Summary generation returned empty result' },
        { status: 500 }
      )
    }

    // 7. Create update note with AI summary prefix and source marker
    // The marker is hidden at the end so we can check for duplicate summaries
    const noteContent = `${AI_SUMMARY_PREFIX}${summary}\n\n${marker}`

    const { data: updateData, error: updateError } = await supabase
      .from('updates')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        author_id: user.id,
        content: noteContent,
      })
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    // Touch the parent entity's updated_by
    const table = entityType === 'lead' ? 'leads' : 'investors'
    await supabase
      .from(table)
      .update({ updated_by: user.id })
      .eq('id', entityId)

    return NextResponse.json({
      success: true,
      data: updateData,
    })
  } catch (e) {
    const message = (e as Error).message
    console.error('[SUMMARIZE] Error:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/summarize/route.ts
git commit -m "feat: add /api/summarize route for audio transcription and AI summary"
```

---

### Task 4: Add Summarize Button to Audio Attachments in ActivityFeed

**Files:**
- Modify: `src/components/ActivityFeed.tsx`

This task adds a "Summarize" button next to audio file attachments in the `FileAttachments` component. The button calls `/api/summarize`, then inserts the returned note into the feed and triggers hashtag field updates.

- [ ] **Step 1: Import the AI_SUMMARY_PREFIX constant at the top of ActivityFeed.tsx**

Add this import after the existing imports (after line 13):

```typescript
import { AI_SUMMARY_PREFIX } from "@/app/api/summarize/route";
```

- [ ] **Step 2: Add props to FileAttachments for summarization**

Update the `FileAttachments` component signature and its call site. First, update the component definition (around line 1028):

Change:

```typescript
function FileAttachments({
  updateId,
  attachments,
  onLoad,
  onDownload,
}: {
  updateId: string;
  attachments?: Attachment[];
  onLoad: () => void;
  onDownload: (id: string) => void;
}) {
```

To:

```typescript
function FileAttachments({
  updateId,
  attachments,
  onLoad,
  onDownload,
  onSummarize,
  summarizedUpdateIds,
}: {
  updateId: string;
  attachments?: Attachment[];
  onLoad: () => void;
  onDownload: (id: string) => void;
  onSummarize?: (attachmentId: string, updateId: string) => void;
  summarizedUpdateIds?: Set<string>;
}) {
```

- [ ] **Step 3: Add a "Summarize" button next to audio files in the non-image file rendering**

Inside the `FileAttachments` component, in the non-image files loop, after the file size `<span>`, add a Summarize button for audio files. Find the section that renders non-image files (the `{nonImages.map((att) => (` block). Update it to include the Summarize button:

After the file size span and before `</div>` that closes the flex row, add:

```tsx
            {isAudio(att.file_type) && onSummarize && (
              <button
                type="button"
                onClick={() => onSummarize(att.id, updateId)}
                disabled={summarizedUpdateIds?.has(updateId)}
                className={`ml-auto shrink-0 rounded border px-2 py-0.5 text-[0.6rem] font-medium transition-colors ${
                  summarizedUpdateIds?.has(updateId)
                    ? "border-neutral-200 text-neutral-300 cursor-default"
                    : "border-neutral-300 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                }`}
              >
                {summarizedUpdateIds?.has(updateId) ? "Summarized" : "Summarize"}
              </button>
            )}
```

- [ ] **Step 4: Add summarization state and handler to the main ActivityFeed component**

Inside the main `ActivityFeed` function, after the existing state declarations (around line 78, after the `attachmentsByUpdate` state), add:

```typescript
  // AI summary state: tracks which update IDs have been summarized
  const [summarizedUpdateIds, setSummarizedUpdateIds] = useState<Set<string>>(() => {
    // Initialize from existing updates that are AI summaries
    const ids = new Set<string>();
    for (const update of initialUpdates) {
      const markerMatch = update.content.match(/\[summary-of:([^\]]+)\]/);
      if (markerMatch) ids.add(markerMatch[1]);
    }
    return ids;
  });
  const [summarizing, setSummarizing] = useState<string | null>(null);
```

Then add the handler function after the existing `handleFiles` function (around line 356):

```typescript
  async function handleSummarize(attachmentId: string, sourceUpdateId: string) {
    if (summarizedUpdateIds.has(sourceUpdateId) || summarizing) return;
    setSummarizing(sourceUpdateId);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId,
          entityType,
          entityId,
          leadName: entityName,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const newUpdate = {
          ...json.data,
          author_name: user.name,
          author_role: user.role,
          author_email: user.email,
        };
        setUpdates((prev) => [...prev, newUpdate]);
        setSummarizedUpdateIds((prev) => new Set(prev).add(sourceUpdateId));
        scrollToBottom();

        // Process hashtags in the summary to update lead fields
        const fieldUpdates = parseHashtagValues(json.data.content);
        if (Object.keys(fieldUpdates).length > 0 && onHashtagUpdate) {
          await onHashtagUpdate(fieldUpdates);
        }
      } else {
        alert("Could not summarize: " + json.error);
      }
    } catch (err) {
      alert("Summarize failed: " + (err as Error).message);
    } finally {
      setSummarizing(null);
    }
  }
```

- [ ] **Step 5: Pass the new props to FileAttachments at its call site**

Find where `<FileAttachments` is rendered (around line 715). Change:

```tsx
              <FileAttachments
                updateId={update.id}
                attachments={attachmentsByUpdate[update.id]}
                onLoad={() => loadAttachments(update.id)}
                onDownload={handleDownload}
              />
```

To:

```tsx
              <FileAttachments
                updateId={update.id}
                attachments={attachmentsByUpdate[update.id]}
                onLoad={() => loadAttachments(update.id)}
                onDownload={handleDownload}
                onSummarize={handleSummarize}
                summarizedUpdateIds={summarizedUpdateIds}
              />
```

- [ ] **Step 6: Update the Summarize button to show loading state**

In the `FileAttachments` component, update the props to also accept `summarizingUpdateId`:

Add to the props type:

```typescript
  summarizingUpdateId?: string | null;
```

Update the button text:

```tsx
                {summarizedUpdateIds?.has(updateId)
                  ? "Summarized"
                  : summarizingUpdateId === updateId
                    ? "Summarizing..."
                    : "Summarize"}
```

And disable during summarization:

```tsx
                disabled={summarizedUpdateIds?.has(updateId) || summarizingUpdateId === updateId}
```

Pass it from the call site:

```tsx
                summarizingUpdateId={summarizing}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/ActivityFeed.tsx
git commit -m "feat: add Summarize button to audio attachments in activity feed"
```

---

### Task 5: Style AI Summary Notes with Distinct Appearance

**Files:**
- Modify: `src/components/ActivityFeed.tsx`

AI summary notes need a lighter gray background and the `— AI Summary —` header should render visually at the top. The marker `[summary-of:xxx]` at the end should be hidden.

- [ ] **Step 1: Add AI summary detection helper**

After the `isFileNote` function (around line 571), add:

```typescript
  const isAiSummary = (content: string) =>
    content.startsWith("— AI Summary —");
```

- [ ] **Step 2: Add distinct background styling for AI summary notes**

In the `<li>` that renders each update (around line 622), update the `style` prop. Find:

```tsx
            style={
              update.author_email === "randy@btinvestments.co"
                ? { backgroundColor: "rgba(138, 108, 0, 0.08)" }
                : undefined
            }
```

Change to:

```tsx
            style={
              isAiSummary(update.content)
                ? { backgroundColor: "rgba(0, 0, 0, 0.02)" }
                : update.author_email === "randy@btinvestments.co"
                  ? { backgroundColor: "rgba(138, 108, 0, 0.08)" }
                  : undefined
            }
```

The value `rgba(0, 0, 0, 0.02)` produces a barely-there gray that is noticeably lighter than the container background but not white. Adjust the alpha if needed after visual testing.

- [ ] **Step 3: Render AI summary content with header and hidden marker**

In the content rendering section, after the `isFileNote` check (around line 714), add a branch for AI summaries. Find the block:

```tsx
            ) : isFileNote(update.content) ? (
```

Before that line, add an AI summary branch:

```tsx
            ) : isAiSummary(update.content) ? (
              <div className="text-sm text-neutral-700 whitespace-pre-wrap font-editable">
                <span className="text-[0.6rem] font-medium tracking-wider text-neutral-400 uppercase">— AI Summary —</span>
                {"\n\n"}
                {renderContent(
                  update.content
                    .replace(/^— AI Summary —\n\n/, "")
                    .replace(/\n\n\[summary-of:[^\]]+\]$/, "")
                )}
              </div>
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/ActivityFeed.tsx
git commit -m "feat: style AI summary notes with distinct background and header"
```

---

### Task 6: End-to-End Manual Testing

No files to modify — this is a verification task.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the full flow**

1. Go to any lead record that has an audio file attached (or upload one)
2. Verify the "Summarize" button appears next to the audio file
3. Click "Summarize" — verify:
   - Button shows "Summarizing..." while processing
   - A new note appears with the `— AI Summary —` header
   - The note has a slightly lighter gray background compared to other notes
   - Bullet points use the `•` character
   - Hashtags at the bottom auto-update the lead's fields
   - The `[summary-of:xxx]` marker is NOT visible in the note
4. Verify the "Summarize" button now shows "Summarized" and is disabled
5. Refresh the page — verify the button still shows "Summarized" (state persists from DB)

- [ ] **Step 3: Test error handling**

1. Try summarizing a non-audio file — should not show the button
2. Try clicking "Summarized" on an already-summarized audio — should be disabled

- [ ] **Step 4: Final build check**

```bash
npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 5: Commit any fixes**

If any issues were found and fixed during testing, commit them:

```bash
git add -A
git commit -m "fix: address issues found during call summarizer testing"
```
