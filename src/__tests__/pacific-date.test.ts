import { describe, it, expect } from 'vitest'
import { todayPacificISO, nowPacific } from '@/lib/pacific-date'

describe('todayPacificISO', () => {
  it('returns YYYY-MM-DD', () => {
    expect(todayPacificISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches the Intl-computed Pacific date', () => {
    const expected = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    expect(todayPacificISO()).toBe(expected)
  })
})

describe('nowPacific', () => {
  it('local getters agree with todayPacificISO (the whole point of the helper)', () => {
    const p = nowPacific()
    const iso = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`
    expect(iso).toBe(todayPacificISO())
  })

  it('local hour getter matches the Intl-computed Pacific hour', () => {
    const p = nowPacific()
    const pacificHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(new Date())
    )
    // Allow the hour to have just rolled over between the two calls.
    expect([pacificHour, (pacificHour + 1) % 24]).toContain(p.getHours())
  })
})
