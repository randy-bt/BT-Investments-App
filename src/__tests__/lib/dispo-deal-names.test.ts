import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { acqName, jvPartnerCompany, partnerKeyMap } from '@/lib/dispo/deal-names'

describe('acqName', () => {
  it('prefixes the seller emojis and splits a trailing agent parenthetical', () => {
    expect(acqName('George Brunner (Travis Fox)')).toEqual({ name: '🔷🟢 George Brunner', agent: 'Agent: Travis Fox' })
    expect(acqName('Alexander Thole')).toEqual({ name: '🔷🟢 Alexander Thole', agent: null })
  })

  it('strips an emoji already in the stored name', () => {
    expect(acqName('🔷 Jane Doe').name).toBe('🔷🟢 Jane Doe')
  })

  it('falls back to Deal for an empty name', () => {
    expect(acqName(null).name).toBe('🔷🟢 Deal')
    expect(acqName('   ').name).toBe('🔷🟢 Deal')
  })
})

describe('jvPartnerCompany', () => {
  const byKey = partnerKeyMap([
    { name: 'Gayle Canares', company: 'VM Home Team' },
    { name: 'Acme Capital', company: null },
  ])

  it('matches a partner record on the sender email domain, company first', () => {
    expect(jvPartnerCompany('"Gayle Canares" <deals@vmhometeam.com>', byKey)).toBe('VM Home Team')
    expect(jvPartnerCompany('someone@acmecapital.com', byKey)).toBe('Acme Capital')
  })

  it('never falls back to the person: unknown domain is null', () => {
    expect(jvPartnerCompany('"Jane Person" <jane@gmail.com>', byKey)).toBeNull()
    expect(jvPartnerCompany(null, byKey)).toBeNull()
  })

  it('the known-partners list covers a partner with no record yet', () => {
    expect(jvPartnerCompany('deals@vmhometeam.com', new Map())).toBe('VM Home Team')
  })
})

describe('Deals sent panel hover owner', () => {
  const root = join(__dirname, '..', '..', '..')
  const panel = readFileSync(join(root, 'src/components/DealsSentPanel.tsx'), 'utf8')
  const sends = readFileSync(join(root, 'src/actions/deal-sends.ts'), 'utf8')

  it('reveals on row hover without shifting the layout, with a title fallback', () => {
    expect(panel).toContain('group-hover:opacity-100')
    expect(panel).toContain('title={row.owner ?? undefined}')
    expect(panel).toMatch(/rowClasses = `group /)
  })

  it('the action names a listing by its lead and a JV by its partner company', () => {
    expect(sends).toContain('leads(name, stage, status, deal_closed_at)')
    expect(sends).toContain("owner: lead?.name ? acqName(lead.name).name : null")
    expect(sends).toContain('owner: jvPartnerCompany(')
  })
})
