// Shared cron auth + failure alerting.
//
// Auth: the two cron routes previously checked CRON_SECRET two different
// ways (one stripped the known Vercel trailing-"\n" quirk, one didn't).
// Vercel builds the cron Authorization header from the same env value, so
// whichever comparison disagreed with the stored form failed silently.
// This helper accepts either form so a re-saved env var can never break
// cron auth again.
//
// Alerting: cron failures previously vanished into 24h-retention Vercel
// logs. reportCronFailure emails Randy AND sets app_settings key
// 'last_cron_error' (rendered as a red banner in Settings); clearCronError
// removes the banner on the next success of the same route.

import { createAdminClient } from '@/lib/supabase/admin'

export const LAST_CRON_ERROR_KEY = 'last_cron_error'
const ALERT_EMAIL = 'randy@btinvestments.co'

export function isCronAuthorized(authHeader: string | null): boolean {
  const raw = process.env.CRON_SECRET || ''
  const stripped = raw.replace(/\\n$/, '').trim()
  if (!stripped) return false
  return authHeader === `Bearer ${raw}` || authHeader === `Bearer ${stripped}`
}

export type CronErrorRecord = { route: string; message: string; at: string }

// Best-effort on both channels — alerting must never crash the route.
export async function reportCronFailure(route: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const record: CronErrorRecord = { route, message, at: new Date().toISOString() }
  console.error(`[cron:${route}] failed:`, message)

  try {
    const supabase = createAdminClient()
    await supabase
      .from('app_settings')
      .upsert({ key: LAST_CRON_ERROR_KEY, value: JSON.stringify(record) }, { onConflict: 'key' })
  } catch (e) {
    console.error('[cron-health] failed to record error:', e)
  }

  try {
    const { sendDirectEmail } = await import('@/lib/email')
    await sendDirectEmail({
      from: 'notifications@btinvestments.co',
      to: ALERT_EMAIL,
      subject: `[BT App] Cron failed: ${route}`,
      text: `The ${route} cron failed at ${record.at}:\n\n${message}\n\nIt will retry on its next schedule. If this keeps arriving daily, something needs fixing.`,
    })
  } catch (e) {
    console.error('[cron-health] failed to send alert email:', e)
  }
}

// Clear the banner, but only if the recorded error belongs to this route —
// one cron succeeding shouldn't hide another cron's failure.
export async function clearCronError(route: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', LAST_CRON_ERROR_KEY)
      .maybeSingle()
    if (!data?.value) return
    const record = JSON.parse(data.value) as CronErrorRecord
    if (record.route !== route) return
    await supabase.from('app_settings').delete().eq('key', LAST_CRON_ERROR_KEY)
  } catch (e) {
    console.error('[cron-health] failed to clear error:', e)
  }
}
