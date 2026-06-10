import { describe, it, expect } from 'vitest'
import { findOrphanPlaceholders } from '@/lib/google-docs'

describe('findOrphanPlaceholders', () => {
  it('returns empty array when no placeholders remain', () => {
    expect(findOrphanPlaceholders('clean text')).toEqual([])
    expect(findOrphanPlaceholders('')).toEqual([])
  })

  it('finds a single orphan placeholder', () => {
    expect(findOrphanPlaceholders('hello {{name}} world')).toEqual(['{{name}}'])
  })

  it('finds multiple orphan placeholders, deduped and sorted', () => {
    const text = '{{closing_date}} foo {{emd_date}} bar {{closing_date}} baz {{inspection_date}}'
    expect(findOrphanPlaceholders(text)).toEqual([
      '{{closing_date}}',
      '{{emd_date}}',
      '{{inspection_date}}',
    ])
  })

  it('ignores placeholder-like strings that do not match the {{...}} shape', () => {
    expect(findOrphanPlaceholders('{ not_a_placeholder }')).toEqual([])
    expect(findOrphanPlaceholders('{{}}')).toEqual([])
    expect(findOrphanPlaceholders('{{ has spaces }}')).toEqual([])
  })
})
