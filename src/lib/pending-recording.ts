// An unsaved call recording survives a page reload (Randy, Oct 2 2026).
//
// Why: a deploy changes every server action's id, so a tab opened before the
// deploy gets "Server Action ... was not found on the server" on its next
// call. Aldo hit that on Save and lost a recording that lived only in that
// tab's memory. Now the blob is parked in IndexedDB the moment recording
// stops and cleared only once the server confirms the save - so after that
// error (or any reload) the recorder offers it back.
//
// IndexedDB, not localStorage: a few minutes of audio is megabytes, past
// what localStorage can hold, and IndexedDB stores Blobs natively.

const DB = 'bt-call-recorder'
const STORE = 'pending'
const VERSION = 1

export type PendingRecording = {
  category: 'agent' | 'investor' | ''
  blob: Blob
  name: string
  stoppedAt: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'))
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

/** One slot per recorder, keyed by category, so the agent and investor
 *  recorders never offer each other's recording. */
const keyFor = (category: string) => `pending:${category || 'shared'}`

/** Best-effort. A storage failure must never break recording itself. */
export async function savePending(p: PendingRecording): Promise<void> {
  try { await tx('readwrite', (s) => s.put(p, keyFor(p.category))) } catch { /* ignore */ }
}

export async function loadPending(category: string): Promise<PendingRecording | null> {
  try {
    const v = await tx<PendingRecording | undefined>('readonly', (s) => s.get(keyFor(category)))
    return v && v.blob instanceof Blob && v.blob.size > 0 ? v : null
  } catch {
    return null
  }
}

export async function clearPending(category: string): Promise<void> {
  try { await tx('readwrite', (s) => s.delete(keyFor(category))) } catch { /* ignore */ }
}

/**
 * The message a person should see when a save fails. The framework's own
 * wording for a stale tab is "Server Action <hash> was not found on the
 * server", which reads as a crash and tells nobody what to do.
 */
export function saveErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  if (/was not found on the server|failed to find server action|server action .* not found/i.test(raw)) {
    return (
      'The app was just updated, so this page is out of date. ' +
      'Reload the page - your recording has been kept and will be offered again.'
    )
  }
  return `Could not save recording: ${raw || 'unknown error'}`
}
