import { google } from 'googleapis'
import type { docs_v1 } from 'googleapis'

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

// Generate a filled PDF from a template Google Doc.
// Flow: copy template → replace placeholders → export PDF → delete copy.
//
// Service accounts have 0 Drive storage quota, so the copy must live in a
// Shared Drive (set GOOGLE_DRIVE_SHARED_FOLDER_ID to any folder inside one).
export async function generateAgreementPdf(
  templateDocId: string,
  values: Record<string, string>
): Promise<Buffer> {
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

    // 3. Export as PDF
    const pdfRes = await drive.files.export(
      { fileId: tempDocId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    )
    return Buffer.from(pdfRes.data as ArrayBuffer)
  } finally {
    // 4. Clean up the temp doc
    await drive.files
      .delete({ fileId: tempDocId, supportsAllDrives: true })
      .catch(() => {
        /* best-effort cleanup */
      })
  }
}
