// Content markers — the literal prefixes that tag special activity-feed
// entries. ActivityFeed (and the Up Next / lead-record clients) dispatch
// rendering on these strings, and thousands of HISTORICAL feed rows
// already contain them.
//
// ⚠️ These are a de-facto schema. NEVER change an existing value — that
// would break rendering of every old entry. Add new markers here only.

/** Call summary posted by /api/summarize (both fresh + reconnect prompts). */
export const AI_SUMMARY_PREFIX = '— AI Summary —\n\n'

/** Deal Snapshot quick action (actions/up-next.ts). */
export const DEAL_SNAPSHOT_PREFIX = '— Deal Snapshot —'

/** Retired AI Review action (v4.8–v4.15) — writer deleted, historical rows remain. */
export const AI_REVIEW_PREFIX = '— AI Review —'

/** Retired Marketing One-Liner action — writer deleted, historical rows remain. */
export const MARKETING_ONE_LINER_PREFIX = '— Marketing One-Liner —'

/** Email sent via the Send Email dialog (actions/messaging.ts). */
export const SENT_EMAIL_PREFIX = '✉️ Email sent via BT App'

/** SMS sent via the Quo dialog (actions/messaging.ts). */
export const QUO_SMS_PREFIX = '💬 SMS sent via Quo'
