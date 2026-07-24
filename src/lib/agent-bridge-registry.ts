// AI Agent bridge registry (spec 7/24, deliverable C.3/C.4).
//
// The bridge dispatches to the app's real server actions by name. This
// registry maps "module.function" -> the action, built by spreading each
// action module wholesale. "Full width, not a curated subset": every
// exported action is reachable, and a new action added to any listed
// module is automatically callable through the bridge with NO follow-up
// integration work (future-proof by construction, C.4).
//
// Outbound operations (Quo SMS, email, deal sends) ARE exposed here per the
// spec; the bridge enforces a `confirmed: true` tripwire on them (C.3.4).

import * as agreements from '@/actions/agreements'
import * as appSettings from '@/actions/app-settings'
import * as attachments from '@/actions/attachments'
import * as dashboardNotes from '@/actions/dashboard-notes'
import * as dealSends from '@/actions/deal-sends'
import * as entityLookup from '@/actions/entity-lookup'
import * as entityViews from '@/actions/entity-views'
import * as followUp from '@/actions/follow-up'
import * as investors from '@/actions/investors'
import * as jvDeals from '@/actions/jv-deals'
import * as leadLookup from '@/actions/lead-lookup'
import * as leads from '@/actions/leads'
import * as listingPages from '@/actions/listing-pages'
import * as locations from '@/actions/locations'
import * as marketStats from '@/actions/market-stats'
import * as messaging from '@/actions/messaging'
import * as properties from '@/actions/properties'
import * as savedArticles from '@/actions/saved-articles'
import * as scripts from '@/actions/scripts'
import * as search from '@/actions/search'
import * as upNext from '@/actions/up-next'
import * as updates from '@/actions/updates'
import * as users from '@/actions/users'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionFn = (...args: any[]) => Promise<unknown>

const MODULES: Record<string, Record<string, unknown>> = {
  agreements, appSettings, attachments, dashboardNotes, dealSends,
  entityLookup, entityViews, followUp, investors, jvDeals, leadLookup,
  leads, listingPages, locations, marketStats, messaging, properties,
  savedArticles, scripts, search, upNext, updates, users,
}

// Operations that place outbound communication or send to third parties.
// The bridge requires an explicit confirmed:true tripwire before running
// these (spec C.3.4; policy enforcement lives on the analyst side).
export const OUTBOUND_OPERATIONS = new Set<string>([
  'messaging.sendEntityEmail',
  'messaging.sendEntitySms',
  'dealSends.markSent',
])

export function resolveAction(operation: string): ActionFn | null {
  const [moduleName, fnName] = operation.split('.')
  if (!moduleName || !fnName) return null
  const mod = MODULES[moduleName]
  if (!mod) return null
  const fn = mod[fnName]
  return typeof fn === 'function' ? (fn as ActionFn) : null
}

export function listOperations(): string[] {
  const ops: string[] = []
  for (const [moduleName, mod] of Object.entries(MODULES)) {
    for (const [fnName, val] of Object.entries(mod)) {
      if (typeof val === 'function') ops.push(`${moduleName}.${fnName}`)
    }
  }
  return ops.sort()
}
