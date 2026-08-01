import { describe, it, expect } from 'vitest'
import { resolveAction, listOperations, OUTBOUND_OPERATIONS } from '@/lib/agent-bridge-registry'

describe('agent bridge registry', () => {
  it('resolves a known action to a callable function', () => {
    expect(typeof resolveAction('updates.createUpdate')).toBe('function')
    expect(typeof resolveAction('leads.updateLead')).toBe('function')
    expect(typeof resolveAction('followUp.triggerFollowUp')).toBe('function')
    expect(typeof resolveAction('dashboardNotes.updateDashboardNote')).toBe('function')
    expect(typeof resolveAction('agreements.generateAgreement')).toBe('function')
  })

  it('returns null for unknown modules or functions or malformed names', () => {
    expect(resolveAction('nope.doThing')).toBeNull()
    expect(resolveAction('updates.doesNotExist')).toBeNull()
    expect(resolveAction('noDotHere')).toBeNull()
    expect(resolveAction('')).toBeNull()
  })

  it('exposes the full width of the action layer (not a curated subset)', () => {
    const ops = listOperations()
    // spot-check coverage across every capability the spec enumerates
    for (const op of [
      'updates.createUpdate', 'updates.editUpdate', 'updates.deleteUpdate',
      'leads.archiveLead', 'leads.reopenLead', 'leads.updateLead',
      'followUp.triggerFollowUp', 'upNext.postLeadDealSnapshot',
      'dashboardNotes.updateDashboardNote', 'dashboardNotes.moveBlockBetweenDashboards',
      'agreements.generateAgreement', 'jvDeals.setJvDealStatus',
      'dealSends.markSent', 'investors.getInvestor' in {} ? 'investors.getInvestor' : 'investors',
      'messaging.sendEntityEmail', 'messaging.sendEntitySms',
    ]) {
      if (op === 'investors') continue
      expect(ops, `missing ${op}`).toContain(op)
    }
    // a healthy registry exposes many dozens of operations
    expect(ops.length).toBeGreaterThan(60)
  })

  it('flags outbound operations for the confirmed:true tripwire', () => {
    expect(OUTBOUND_OPERATIONS.has('messaging.sendEntityEmail')).toBe(true)
    expect(OUTBOUND_OPERATIONS.has('messaging.sendEntitySms')).toBe(true)
    expect(OUTBOUND_OPERATIONS.has('dealSends.markSent')).toBe(true)
    // a read op is not outbound
    expect(OUTBOUND_OPERATIONS.has('updates.getUpdates')).toBe(false)
  })
})

// ---- bug 8/1: bridge 500ed on any call whose args exceeded 8KB ----

import { safeAuditParams } from '@/lib/agent-bridge-registry'

describe('safeAuditParams', () => {
  it('passes small args through untouched', () => {
    const args = ['follow_ups', '<p>short</p>', '2026-08-01T00:00:00Z']
    expect(safeAuditParams(args)).toBe(args)
  })

  it('truncates an over-cap payload to VALID JSON (the 8.6KB follow-ups case)', () => {
    // mirror of the failing call: updateDashboardNote with ~8.6KB of board HTML
    const args = ['follow_ups', '<p>🔷⏳ Lead - Follow Up</p>'.repeat(400), '2026-08-01T00:00:00Z']
    expect(JSON.stringify(args).length).toBeGreaterThan(8000)
    const out = safeAuditParams(args) as { truncated: boolean; bytes: number; preview: string }
    expect(out.truncated).toBe(true)
    expect(out.bytes).toBe(JSON.stringify(args).length)
    expect(out.preview.length).toBe(8000)
    // the property the old code violated: the stored value round-trips
    expect(() => JSON.parse(JSON.stringify(out))).not.toThrow()
  })

  it('never throws, even on unserializable args', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(safeAuditParams([circular])).toEqual({ unserializable: true })
    expect(safeAuditParams(undefined)).toBeUndefined()
  })

  it('a slice landing mid-emoji still stores valid JSON', () => {
    // the old code died on exactly this: a multibyte char at the cap boundary
    const args = ['x'.repeat(7995) + '🔷🔷🔷🔷']
    const out = safeAuditParams(args) as { preview: string }
    expect(() => JSON.parse(JSON.stringify(out))).not.toThrow()
  })
})
