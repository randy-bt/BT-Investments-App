import { describe, it, expect, afterEach } from 'vitest'
import { cleanEnvValue, getEnv } from '@/lib/env'

const KEY = '__ENV_TEST__'
afterEach(() => { delete process.env[KEY] })

describe('cleanEnvValue', () => {
  it('strips the literal trailing \\n that Vercel can store', () => {
    expect(cleanEnvValue('secret\\n')).toBe('secret')
  })
  it('trims surrounding whitespace', () => {
    expect(cleanEnvValue('  secret  ')).toBe('secret')
  })
  it('leaves a clean value alone', () => {
    expect(cleanEnvValue('secret')).toBe('secret')
  })
  it('treats undefined as empty rather than throwing', () => {
    expect(cleanEnvValue(undefined)).toBe('')
  })
  it('does not strip an interior \\n', () => {
    expect(cleanEnvValue('a\\nb')).toBe('a\\nb')
  })
})

describe('getEnv', () => {
  it('returns the cleaned value', () => {
    process.env[KEY] = ' value\\n'
    expect(getEnv(KEY)).toBe('value')
  })
  it('returns empty string when unset and not required', () => {
    expect(getEnv(KEY)).toBe('')
  })
  it('throws when required and missing, naming the variable', () => {
    expect(() => getEnv(KEY, { required: true })).toThrow(KEY)
  })
  it('does not throw when required and present', () => {
    process.env[KEY] = 'x'
    expect(getEnv(KEY, { required: true })).toBe('x')
  })
})
