import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({ from: mockFrom })),
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(async () => ({ id: 'u1', role: 'admin' })),
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
}))

beforeEach(() => {
  mockEq.mockReset()
  mockUpdate.mockReset()
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ error: null })
})

describe('setListingPageIndexVisibility', () => {
  it('updates the row with the requested visibility and returns success', async () => {
    const { setListingPageIndexVisibility } = await import('@/actions/listing-pages')
    const result = await setListingPageIndexVisibility('p1', false)

    expect(mockUpdate).toHaveBeenCalledWith({ show_on_index: false })
    expect(mockEq).toHaveBeenCalledWith('id', 'p1')
    expect(result).toEqual({ success: true, data: null })
  })

  it('returns the supabase error message on failure', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'boom' } })
    const { setListingPageIndexVisibility } = await import('@/actions/listing-pages')
    const result = await setListingPageIndexVisibility('p1', true)
    expect(result).toEqual({ success: false, error: 'boom' })
  })
})
