// Team identity constants — safe to import from BOTH server and client
// code (auth.ts is server-only, so these can't live there).
//
// OWNER_EMAIL gates Randy-only features: CC Summarize, Send+, sending
// email from any BT address, the daily digest, and the format toggle.

export const OWNER_EMAIL = 'randy@btinvestments.co'

// The AI Agent operating identity (spec 7/24): the analyst session's
// account. Admin clearance; its updates render like anyone else's except
// the author name shows in AI_AGENT_COLOR (purple). Not a builder — the
// bridge only exposes the app's server-action layer.
export const AI_AGENT_EMAIL = 'ai-agent@btinvestments.co'
export const AI_AGENT_COLOR = '#a855f7'

// The official Signal funnel identity (handoff 008): /signal submission
// notifications deliver TO this Gmail inbox and send AS this address.
// Deliberately separate from OWNER_EMAIL, which gates Randy-only app
// features and must never carry the Signal funnel again.
export const SIGNAL_INBOX = 'signal@btinvestments.co'

// Partners get admin-level permissions without the admin role (V1).
export const PARTNER_EMAILS = ['aldo@btinvestments.co']
