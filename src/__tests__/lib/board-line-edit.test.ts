import { describe, it, expect } from 'vitest'
import { setBlockFlag, setLineFlag, boardHasLine, findLineIndex } from '@/lib/board-line-edit'

const BOARD =
  '<p>🔷 Dan Smith - call back Tue</p>' +
  '<p>🟢 Mary Jones - offer sent✅ --Requesting Mail</p>' +
  '<p>💰🟢 Bob Lee - Follow Note</p>' +
  '<p><strong>Ann Park</strong> - new (PRIORITY)⚠️</p>'

describe('findLineIndex / boardHasLine', () => {
  it('matches by emoji-stripped, case-insensitive name', () => {
    expect(boardHasLine(BOARD, 'mary jones')).toBe(true)
    expect(boardHasLine(BOARD, '🔷 Dan Smith')).toBe(true)
    expect(boardHasLine(BOARD, 'Nobody Here')).toBe(false)
    expect(findLineIndex(['<p>x</p>'], 'a')).toBe(-1)
  })
})

describe('setBlockFlag', () => {
  it('appends a flag at the end with no space', () => {
    expect(setBlockFlag('<p>🔷 Dan Smith - call back Tue</p>', '✅')).toBe('<p>🔷 Dan Smith - call back Tue✅</p>')
  })
  it('replaces an existing flag, even mid-line, and leaves other markers alone', () => {
    expect(setBlockFlag('<p>🟢 Mary Jones - offer sent✅ --Requesting Mail📬</p>', '⚠️')).toBe(
      '<p>🟢 Mary Jones - offer sent --Requesting Mail📬⚠️</p>',
    )
    expect(setBlockFlag('<p>🟨 Ann - do thing (PRIORITY)⚠️</p>', '❌')).toBe('<p>🟨 Ann - do thing (PRIORITY)❌</p>')
  })
  it('keeps closing tags after the flag', () => {
    expect(setBlockFlag('<p><strong>Ann Park</strong> - new⚠️</p>', '📆')).toBe('<p><strong>Ann Park</strong> - new📆</p>')
  })
  it('never touches the leading status run', () => {
    expect(setBlockFlag('<p>✅🔷 Dan - x</p>', '❌')).toBe('<p>✅🔷 Dan - x❌</p>')
  })
  it('removes the flag with null', () => {
    expect(setBlockFlag('<p>🔷 Dan - x✅</p>', null)).toBe('<p>🔷 Dan - x</p>')
  })
  it('drops trailing nbsp before the flag', () => {
    expect(setBlockFlag('<p>🔷 Dan - x&nbsp;</p>', '🫥')).toBe('<p>🔷 Dan - x🫥</p>')
  })
})

describe('setLineFlag', () => {
  it('edits only the named line and leaves the rest byte-identical', () => {
    const r = setLineFlag(BOARD, 'Bob Lee', '🫥')
    expect(r.found).toBe(true)
    if (!r.found) return
    expect(r.changed).toBe(true)
    expect(r.lineText).toBe('💰🟢 Bob Lee - Follow Note🫥')
    expect(r.content).toBe(BOARD.replace('<p>💰🟢 Bob Lee - Follow Note</p>', '<p>💰🟢 Bob Lee - Follow Note🫥</p>'))
  })
  it('reports changed=false when the flag is already there', () => {
    const r = setLineFlag(BOARD, 'Ann Park', '⚠️')
    expect(r.found && r.changed).toBe(false)
  })
  it('reports not found', () => {
    expect(setLineFlag(BOARD, 'Nobody', '✅')).toEqual({ found: false })
  })
})
