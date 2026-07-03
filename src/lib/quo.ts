// Quo (formerly OpenPhone) SMS sending.
//
// Env:
//   QUO_API_KEY      — API key from the Quo dashboard
//   QUO_FROM_NUMBER  — the Quo phone number to send from (E.164 or (xxx) xxx-xxxx)
//   QUO_API_BASE     — optional override; defaults to the OpenPhone v1 API
//
// Until the env vars are set, sendQuoSms returns a clear "not configured"
// error so the UI can surface it instead of failing mysteriously.

const DEFAULT_API_BASE = 'https://api.openphone.com/v1'

// Strip a trailing literal \n (known Vercel env quirk) + whitespace.
function env(name: string): string {
  return (process.env[name] ?? '').replace(/\\n$/, '').trim()
}

// "(206) 555-0100" / "206-555-0100" / "2065550100" → "+12065550100".
// Already-+prefixed numbers pass through with digits cleaned.
export function normalizeE164(raw: string): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  if (hasPlus) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

export type QuoMessage = {
  id: string
  direction: 'incoming' | 'outgoing'
  text: string
  createdAt: string
}

// Fetch the SMS thread between our Quo number and one participant,
// oldest → newest. Verified against the live API: returns the full
// history including messages that predate the API key.
export async function fetchQuoThread(opts: {
  to: string
}): Promise<{ ok: boolean; messages: QuoMessage[]; error?: string }> {
  const apiKey = env('QUO_API_KEY')
  const fromRaw = env('QUO_FROM_NUMBER')
  if (!apiKey || !fromRaw) {
    return { ok: false, messages: [], error: 'Quo is not configured.' }
  }
  const to = normalizeE164(opts.to)
  if (!to) return { ok: false, messages: [], error: `"${opts.to}" is not a valid phone number.` }

  try {
    // Resolve our phoneNumberId once per call (single number; cheap).
    const pnRes = await fetch(`${env('QUO_API_BASE') || DEFAULT_API_BASE}/phone-numbers`, {
      headers: { Authorization: apiKey },
    })
    if (!pnRes.ok) return { ok: false, messages: [], error: `Quo API error ${pnRes.status}` }
    const pnData = (await pnRes.json()) as { data?: { id: string; phoneNumber: string }[] }
    const from = normalizeE164(fromRaw)
    const pn = (pnData.data ?? []).find((p) => normalizeE164(p.phoneNumber) === from) ?? pnData.data?.[0]
    if (!pn) return { ok: false, messages: [], error: 'Quo phone number not found in workspace.' }

    const params = new URLSearchParams()
    params.set('phoneNumberId', pn.id)
    params.append('participants[]', to)
    params.set('maxResults', '100')
    const res = await fetch(`${env('QUO_API_BASE') || DEFAULT_API_BASE}/messages?${params}`, {
      headers: { Authorization: apiKey },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, messages: [], error: `Quo API error ${res.status}: ${text.slice(0, 200)}` }
    }
    const data = (await res.json()) as {
      data?: { id: string; direction: string; text?: string; createdAt: string }[]
    }
    const messages: QuoMessage[] = (data.data ?? [])
      .map((m) => ({
        id: m.id,
        direction: m.direction === 'outgoing' ? ('outgoing' as const) : ('incoming' as const),
        text: m.text ?? '',
        createdAt: m.createdAt,
      }))
      .reverse() // API returns newest-first; display oldest-first
    return { ok: true, messages }
  } catch (e) {
    return { ok: false, messages: [], error: `Quo request failed: ${(e as Error).message}` }
  }
}

export async function sendQuoSms(opts: {
  to: string
  message: string
}): Promise<{ ok: boolean; from?: string; error?: string }> {
  const apiKey = env('QUO_API_KEY')
  const fromRaw = env('QUO_FROM_NUMBER')
  if (!apiKey || !fromRaw) {
    return {
      ok: false,
      error:
        'Quo SMS is not configured yet — QUO_API_KEY and QUO_FROM_NUMBER need to be set in the environment.',
    }
  }
  const from = normalizeE164(fromRaw)
  const to = normalizeE164(opts.to)
  if (!to) return { ok: false, error: `"${opts.to}" is not a valid phone number.` }

  try {
    const res = await fetch(`${env('QUO_API_BASE') || DEFAULT_API_BASE}/messages`, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: opts.message, from, to: [to] }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `Quo API error ${res.status}: ${text.slice(0, 300)}` }
    }
    return { ok: true, from }
  } catch (e) {
    return { ok: false, error: `Quo request failed: ${(e as Error).message}` }
  }
}
