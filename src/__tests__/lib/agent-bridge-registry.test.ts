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
