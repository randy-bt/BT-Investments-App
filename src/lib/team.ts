// Team identity constants — safe to import from BOTH server and client
// code (auth.ts is server-only, so these can't live there).
//
// OWNER_EMAIL gates Randy-only features: CC Summarize, Send+, sending
// email from any BT address, the daily digest, and the format toggle.

export const OWNER_EMAIL = 'randy@btinvestments.co'

// Partners get admin-level permissions without the admin role (V1).
export const PARTNER_EMAILS = ['aldo@btinvestments.co']
