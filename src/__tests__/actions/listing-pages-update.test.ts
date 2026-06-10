import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn(() => ({ select: mockSelect }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
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
  mockSingle.mockReset()
  mockSelect.mockClear()
  mockEq.mockClear()
  mockUpdate.mockClear()
})

describe('updateListingPage', () => {
  it('rejects when inputs fail the Zod schema (no Supabase call)', async () => {
    const { updateListingPage } = await import('@/actions/listing-pages')
    const result = await updateListingPage('p1', {
      address: '',
      inputs: {} as Record<string, unknown>,
    })
    expect(result.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('passes valid inputs through to Supabase and returns the updated row', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'p1', address: 'new addr', inputs: { foo: 'bar' } },
      error: null,
    })

    const validInputs = {
      address: 'new addr',
      price: '$700,000',
      lotSize: '5,000 sqft',
      zoning: 'RS-1',
      arvRange: '$800K-$850K',
      countyPageLink: 'https://county.example.com/parcel/123',
      googleDriveLink: 'https://drive.google.com/folder/x',
      frontPhotoPath: 'front.jpg',
      satellitePhotoPath: 'sat.jpg',
      cityEyebrow: 'Seattle, WA',
      neighborhood: { mode: 'hidden' as const },
    }

    const { updateListingPage } = await import('@/actions/listing-pages')
    const result = await updateListingPage('p1', {
      address: 'new addr',
      inputs: validInputs,
    })

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'p1')
  })
})
