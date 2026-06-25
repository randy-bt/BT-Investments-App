import { describe, it, expect } from 'vitest'
import {
  CALL_SUMMARY_PROMPT,
  FOLLOW_UP_SUMMARY_PROMPT,
  INVESTOR_CALL_SUMMARY_PROMPT,
  REENGAGEMENT_CALL_SUMMARY_PROMPT,
  pickSummaryPrompt,
} from '@/lib/prompts/call-summary'

describe('summary prompt constants', () => {
  it('CALL_SUMMARY_PROMPT exists and is non-empty', () => {
    expect(typeof CALL_SUMMARY_PROMPT).toBe('string')
    expect(CALL_SUMMARY_PROMPT.length).toBeGreaterThan(50)
  })

  it('FOLLOW_UP_SUMMARY_PROMPT exists and is non-empty', () => {
    expect(typeof FOLLOW_UP_SUMMARY_PROMPT).toBe('string')
    expect(FOLLOW_UP_SUMMARY_PROMPT.length).toBeGreaterThan(50)
  })

  it('INVESTOR_CALL_SUMMARY_PROMPT exists, is non-empty, and frames calls as investor-side', () => {
    expect(typeof INVESTOR_CALL_SUMMARY_PROMPT).toBe('string')
    expect(INVESTOR_CALL_SUMMARY_PROMPT.length).toBeGreaterThan(50)
    expect(INVESTOR_CALL_SUMMARY_PROMPT.toLowerCase()).toContain('investor')
    expect(INVESTOR_CALL_SUMMARY_PROMPT.toLowerCase()).not.toContain('asking price')
    expect(INVESTOR_CALL_SUMMARY_PROMPT.toLowerCase()).not.toContain('seller')
  })
})

describe('pickSummaryPrompt', () => {
  it('returns INVESTOR_CALL_SUMMARY_PROMPT for entityType=investor regardless of filename', () => {
    const onboarding = '4.2 Ann Hughes 96 - 5315 SW Charlestown St - 2069356680 - SS1 XXL.mp3'
    const followUp = '4.5 Ann Hughes.webm'
    expect(pickSummaryPrompt({ entityType: 'investor', fileName: onboarding })).toBe(
      INVESTOR_CALL_SUMMARY_PROMPT,
    )
    expect(pickSummaryPrompt({ entityType: 'investor', fileName: followUp })).toBe(
      INVESTOR_CALL_SUMMARY_PROMPT,
    )
  })

  it('returns CALL_SUMMARY_PROMPT for entityType=lead with an onboarding-style filename (>=3 " - " separators)', () => {
    const fileName = '4.2 Ann Hughes 96 - 5315 SW Charlestown St - 2069356680 - SS1 XXL.mp3'
    expect(pickSummaryPrompt({ entityType: 'lead', fileName })).toBe(CALL_SUMMARY_PROMPT)
  })

  it('returns FOLLOW_UP_SUMMARY_PROMPT for entityType=lead with a non-onboarding filename', () => {
    expect(pickSummaryPrompt({ entityType: 'lead', fileName: '4.5 Ann Hughes.webm' })).toBe(
      FOLLOW_UP_SUMMARY_PROMPT,
    )
    expect(pickSummaryPrompt({ entityType: 'lead', fileName: 'recording.mp3' })).toBe(
      FOLLOW_UP_SUMMARY_PROMPT,
    )
    expect(pickSummaryPrompt({ entityType: 'lead', fileName: '4.5 - A - B.mp3' })).toBe(
      FOLLOW_UP_SUMMARY_PROMPT,
    )
  })

  it('returns REENGAGEMENT_CALL_SUMMARY_PROMPT for a lead in reengage mode, overriding the filename heuristic', () => {
    const onboarding = '4.2 Ann Hughes 96 - 5315 SW Charlestown St - 2069356680 - SS1 XXL.mp3'
    const followUp = '4.5 Ann Hughes.webm'
    expect(pickSummaryPrompt({ entityType: 'lead', fileName: onboarding, mode: 'reengage' })).toBe(
      REENGAGEMENT_CALL_SUMMARY_PROMPT,
    )
    expect(pickSummaryPrompt({ entityType: 'lead', fileName: followUp, mode: 'reengage' })).toBe(
      REENGAGEMENT_CALL_SUMMARY_PROMPT,
    )
  })

  it('ignores reengage mode for investors (always investor prompt)', () => {
    expect(
      pickSummaryPrompt({ entityType: 'investor', fileName: 'anything.mp3', mode: 'reengage' }),
    ).toBe(INVESTOR_CALL_SUMMARY_PROMPT)
  })
})
