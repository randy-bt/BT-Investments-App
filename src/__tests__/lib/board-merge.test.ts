import { describe, it, expect } from 'vitest'
import { splitBlocks, blockText, lineLabel, diffBlocks, mergeBoards } from '@/lib/board-merge'

const A = '<p>🔷 Dan Smith - call back Tue</p>'
const B = '<p>🟢 Mary Jones - offer sent</p>'
const C = '<p>⏳ Bob Lee - waiting on docs</p>'
const D = '<p>📈 Ann Park - new</p>'

describe('splitBlocks', () => {
  it('splits top-level blocks and keeps nested lists whole', () => {
    const html = `${A}<ul><li>one<ul><li>deep</li></ul></li><li>two</li></ul>${B}`
    const blocks = splitBlocks(html)
    expect(blocks).toHaveLength(3)
    expect(blocks[1]).toBe('<ul><li>one<ul><li>deep</li></ul></li><li>two</li></ul>')
  })

  it('handles void tags and an empty board', () => {
    expect(splitBlocks('')).toEqual([])
    expect(splitBlocks('<p>a<br>b</p><hr><p>c</p>')).toEqual(['<p>a<br>b</p>', '<hr>', '<p>c</p>'])
  })
})

describe('blockText and lineLabel', () => {
  it('strips tags and decodes entities', () => {
    expect(blockText('<p><strong>Dan</strong> &amp; Co&nbsp;- hi</p>')).toBe('Dan & Co - hi')
  })
  it('labels a line by the name before the separator, emoji stripped', () => {
    expect(lineLabel('🔷 Dan Smith - call back Tue✅')).toBe('Dan Smith')
    expect(lineLabel('💰🟢 Mary Jones: offer')).toBe('Mary Jones')
    expect(lineLabel('one two three four five six seven')).toBe('one two three four five')
    expect(lineLabel('✅')).toBe('this')
  })
})

describe('diffBlocks', () => {
  it('reports a changed line as one hunk over its base index', () => {
    const base = [A, B, C]
    const other = [A, B.replace('offer sent', 'offer sent✅'), C]
    expect(diffBlocks(base, other)).toEqual([{ start: 1, end: 2, replacement: [other[1]] }])
  })
  it('reports an insertion as an empty base range', () => {
    expect(diffBlocks([A, B], [A, D, B])).toEqual([{ start: 1, end: 1, replacement: [D] }])
  })
  it('reports a deletion as an empty replacement', () => {
    expect(diffBlocks([A, B, C], [A, C])).toEqual([{ start: 1, end: 2, replacement: [] }])
  })
})

describe('mergeBoards', () => {
  const base = A + B + C

  it('applies my changed line onto their changed line when they differ', () => {
    const mine = A + B.replace('offer sent', 'offer sent✅') + C
    const theirs = A + B + C.replace('waiting on docs', 'docs in')
    const r = mergeBoards(base, mine, theirs)
    expect(r.clashes).toEqual([])
    expect(r.content).toBe(A + B.replace('offer sent', 'offer sent✅') + C.replace('waiting on docs', 'docs in'))
  })

  it('keeps both sides insertions, theirs above mine at the same spot', () => {
    const mine = A + '<p>mine new</p>' + B + C
    const theirs = A + '<p>theirs new</p>' + B + C
    const r = mergeBoards(base, mine, theirs)
    expect(r.clashes).toEqual([])
    expect(r.content).toBe(A + '<p>theirs new</p><p>mine new</p>' + B + C)
  })

  it('same-line clash: theirs wins and my text comes back', () => {
    const mine = A + B.replace('offer sent', 'offer sent⚠️') + C
    const theirs = A + B.replace('offer sent', 'offer accepted✅') + C
    const r = mergeBoards(base, mine, theirs)
    expect(r.content).toBe(theirs)
    expect(r.clashes).toEqual([
      { label: 'Mary Jones', mine: '🟢 Mary Jones - offer sent⚠️', theirs: '🟢 Mary Jones - offer accepted✅' },
    ])
  })

  it('my deletion of a line they changed is a clash; their line stays', () => {
    const mine = A + C
    const theirs = A + B.replace('offer sent', 'offer accepted') + C
    const r = mergeBoards(base, mine, theirs)
    expect(r.content).toBe(theirs)
    expect(r.clashes[0]).toMatchObject({ label: 'Mary Jones', mine: '' })
  })

  it('their deletion plus my untouched copy leaves the line gone, no clash', () => {
    const mine = A + B + C.replace('waiting on docs', 'docs in')
    const theirs = A + C
    const r = mergeBoards(base, mine, theirs)
    expect(r.clashes).toEqual([])
    expect(r.content).toBe(A + C.replace('waiting on docs', 'docs in'))
  })

  it('the identical change on both sides is not a clash and is not doubled', () => {
    const changed = B.replace('offer sent', 'offer sent✅')
    const r = mergeBoards(base, A + changed + C, A + changed + C)
    expect(r.clashes).toEqual([])
    expect(r.content).toBe(A + changed + C)
  })

  it('a flag-bounce strip on one line survives my edit on another line', () => {
    const flagged = B.replace('offer sent', 'offer sent✅')
    const baseF = A + flagged + C
    const mine = A.replace('call back Tue', 'call back Wed') + flagged + C
    const theirs = A + B + C // the bounce stripped ✅
    const r = mergeBoards(baseF, mine, theirs)
    expect(r.clashes).toEqual([])
    expect(r.content).toBe(A.replace('call back Tue', 'call back Wed') + B + C)
  })

  it('no change on my side returns theirs untouched', () => {
    const theirs = A + D + B
    expect(mergeBoards(base, base, theirs)).toEqual({ content: theirs, clashes: [] })
  })
})
