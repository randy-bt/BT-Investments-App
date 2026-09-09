import { google } from 'googleapis'
import type { docs_v1, drive_v3 } from 'googleapis'

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
]

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !rawKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  }
  const privateKey = rawKey.replace(/\\n/g, '\n')
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
  })
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() })
}

function getDocs() {
  return google.docs({ version: 'v1', auth: getAuth() })
}

export async function getServiceAccountEmail(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  if (!email) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL')
  return email
}

// Verify template is accessible and return title
export async function getDocTitle(docId: string): Promise<string> {
  const docs = getDocs()
  const res = await docs.documents.get({ documentId: docId })
  return res.data.title || 'Untitled'
}

// Walk a Google Doc body's structuralElements and concatenate every
// text-run's content. Sufficient for detecting leftover {{placeholders}};
// not intended as a faithful Doc renderer.
function extractDocText(doc: docs_v1.Schema$Document): string {
  const parts: string[] = []
  const elements = doc.body?.content ?? []
  for (const el of elements) {
    const paraElements = el.paragraph?.elements ?? []
    for (const pe of paraElements) {
      const content = pe.textRun?.content
      if (content) parts.push(content)
    }
    // Tables can contain placeholders too — walk their cells.
    for (const row of el.table?.tableRows ?? []) {
      for (const cell of row.tableCells ?? []) {
        for (const cellEl of cell.content ?? []) {
          for (const pe of cellEl.paragraph?.elements ?? []) {
            const content = pe.textRun?.content
            if (content) parts.push(content)
          }
        }
      }
    }
  }
  return parts.join('')
}

// Generate a filled PDF from a template Google Doc.
// Flow: copy template → replace placeholders → export PDF → delete copy.
//
// Service accounts have 0 Drive storage quota, so the copy must live in a
// Shared Drive (set GOOGLE_DRIVE_SHARED_FOLDER_ID to any folder inside one).
export async function generateAgreementPdf(
  templateDocId: string,
  values: Record<string, string>
): Promise<{ pdf: Buffer; filledText: string }> {
  const drive = getDrive()
  const docs = getDocs()

  const sharedFolderId = process.env.GOOGLE_DRIVE_SHARED_FOLDER_ID
  if (!sharedFolderId) {
    throw new Error(
      'Missing GOOGLE_DRIVE_SHARED_FOLDER_ID — service account cannot store the template copy without a Shared Drive folder.'
    )
  }

  // 1. Copy the template into the Shared Drive folder
  const copyRes = await drive.files.copy({
    fileId: templateDocId,
    supportsAllDrives: true,
    requestBody: {
      name: `[TEMP] agreement ${Date.now()}`,
      parents: [sharedFolderId],
    },
    fields: 'id',
  })
  const tempDocId = copyRes.data.id
  if (!tempDocId) throw new Error('Failed to copy template document')

  try {
    // 2. Build replace requests — each {{key}} → value
    const requests: docs_v1.Schema$Request[] = Object.entries(values).map(([key, value]) => ({
      replaceAllText: {
        containsText: {
          text: `{{${key}}}`,
          matchCase: true,
        },
        replaceText: value ?? '',
      },
    }))

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: tempDocId,
        requestBody: { requests },
      })
    }

    // 3. Fetch the post-substitution doc and refuse to export if any
    // {{placeholder}} patterns survived — that means either the values
    // map was missing a key, or the Google Doc has a placeholder no
    // template variable defines.
    const filledDoc = await docs.documents.get({ documentId: tempDocId })
    const filledText = extractDocText(filledDoc.data)
    const orphans = findOrphanPlaceholders(filledText)
    if (orphans.length > 0) {
      throw new Error(
        `Template has unfilled placeholders after substitution: ${orphans.join(', ')}. ` +
        `Either the template-variable list is missing these keys, or the Google Doc has placeholders that no variable defines.`,
      )
    }

    // 4. Export as PDF. The filled text rides along for the automated
    // pre-send contract review.
    const pdfRes = await drive.files.export(
      { fileId: tempDocId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    )
    return { pdf: Buffer.from(pdfRes.data as ArrayBuffer), filledText }
  } finally {
    // 5. Clean up the temp doc
    await cleanupTempDoc(drive, tempDocId)
  }
}

/**
 * Remove a temp template copy from the Shared Drive.
 *
 * Why this is not just files.delete: files.delete needs `canDelete`, which on
 * a Shared Drive requires Content manager or Manager. Our service account is a
 * Contributor, so canDelete is FALSE on every file it creates and every delete
 * 403s. The old code swallowed that with an empty .catch, so the failure was
 * invisible and 46 copies accumulated between April and August 2026 while the
 * cleanup looked correct in review.
 *
 * Contributors DO get `canTrash`, so trashing is the operation that actually
 * works at our permission level, and Shared Drive trash auto-purges. We still
 * try delete first so that granting the account Content manager later upgrades
 * this to a hard delete with no code change.
 *
 * Failures are logged rather than swallowed. A cleanup that silently stops
 * working is exactly how this happened.
 */
export async function cleanupTempDoc(drive: drive_v3.Drive, fileId: string): Promise<void> {
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true })
    return
  } catch (deleteErr) {
    try {
      await drive.files.update({
        fileId,
        supportsAllDrives: true,
        requestBody: { trashed: true },
      })
      return
    } catch (trashErr) {
      // Never rethrow: the caller already has its PDF, and a cleanup failure
      // must not fail an agreement the user is waiting on. But it must be
      // visible, which is the whole point of this block.
      console.error(
        `[google-docs] temp doc ${fileId} left behind in the Shared Drive. ` +
          `delete: ${(deleteErr as Error).message} | trash: ${(trashErr as Error).message}`,
      )
    }
  }
}

/**
 * Find `{{key}}`-shaped placeholders that survived template substitution.
 * Returns deduped sorted array. Only matches strict {{key}} format
 * (alphanumeric / underscore inside, no spaces, non-empty).
 */
export function findOrphanPlaceholders(text: string): string[] {
  const matches = text.match(/\{\{[A-Za-z0-9_]+\}\}/g) ?? []
  return Array.from(new Set(matches)).sort()
}
