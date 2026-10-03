import { describe, it, expect } from 'vitest'
import { fromOurSite, cleanInput, cleanPlaceId, cleanSession, INPUT_MIN, INPUT_MAX } from '@/lib/places-guard'

// The public address lookup (Oct 2026). These pin the half of the guard
// that is pure: which origins count as ours, and what input is worth a
// billed Google call. The auth and rate-limit halves need a request and a
// clock and are exercised live after deploy.

const h = (o: Record<string, string>) => new Headers(o)

describe('fromOurSite', () => {
  it('accepts the marketing and app hosts by Origin', () => {
    expect(fromOurSite(h({ origin: 'https://btinvestments.co' }))).toBe(true)
    expect(fromOurSite(h({ origin: 'https://www.btinvestments.co' }))).toBe(true)
    expect(fromOurSite(h({ origin: 'https://app.btinvestments.co' }))).toBe(true)
  })
  it('accepts a Referer alone - a plain page GET often carries only that', () => {
    expect(fromOurSite(h({ referer: 'https://btinvestments.co/hello?x=1' }))).toBe(true)
  })
  it('accepts local dev and our own preview deployments', () => {
    expect(fromOurSite(h({ origin: 'http://localhost:3000' }))).toBe(true)
    expect(fromOurSite(h({ origin: 'https://bt-investments-abc123-randy-bts-projects.vercel.app' }))).toBe(true)
  })
  it('refuses a foreign origin, a lookalike, and no origin at all', () => {
    expect(fromOurSite(h({ origin: 'https://evil.example' }))).toBe(false)
    expect(fromOurSite(h({ origin: 'https://btinvestments.co.evil.example' }))).toBe(false)
    expect(fromOurSite(h({ origin: 'https://notbtinvestments.co' }))).toBe(false)
    expect(fromOurSite(h({}))).toBe(false)
  })
  it('refuses a malformed Origin rather than throwing', () => {
    expect(fromOurSite(h({ origin: 'not a url' }))).toBe(false)
  })
})

describe('cleanInput - what is worth a billed call', () => {
  it('drops anything under the minimum', () => {
    expect(cleanInput('42')).toBeNull()
    expect(cleanInput('  4 ')).toBeNull()
    expect(cleanInput('')).toBeNull()
    expect(cleanInput(null)).toBeNull()
  })
  it('passes a real fragment, trimmed', () => {
    expect(cleanInput(' 4230 S 116th ')).toBe('4230 S 116th')
    expect(cleanInput('a'.repeat(INPUT_MIN))).toHaveLength(INPUT_MIN)
  })
  it('caps the length so one caller cannot send a novel', () => {
    expect(cleanInput('a'.repeat(INPUT_MAX))).toHaveLength(INPUT_MAX)
    expect(cleanInput('a'.repeat(INPUT_MAX + 1))).toBeNull()
  })
})

describe('cleanPlaceId', () => {
  it('accepts a real-looking Google id', () => {
    expect(cleanPlaceId('ChIJN1t_tDeuEmsRUsoyG83frY4')).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4')
  })
  it('refuses short, long, and non-URL-safe values', () => {
    expect(cleanPlaceId('ChIJ')).toBeNull()
    expect(cleanPlaceId('x'.repeat(301))).toBeNull()
    expect(cleanPlaceId('ChIJ N1t/tD?eu')).toBeNull()
    expect(cleanPlaceId(null)).toBeNull()
  })
})

describe('cleanSession', () => {
  it('passes a UUID and drops junk silently, never rejecting the lookup', () => {
    expect(cleanSession('6f1d2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a4b')).toBe('6f1d2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a4b')
    expect(cleanSession('')).toBeNull()
    expect(cleanSession('x'.repeat(65))).toBeNull()
    expect(cleanSession('has space')).toBeNull()
  })
})
