import { z } from 'zod'

export const locationKindSchema = z.enum(['city', 'county', 'region', 'state', 'neighborhood'])

export const createLocationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  kind: locationKindSchema,
  parent_id: z.guid().nullable().optional(),
  state_code: z.string().length(2).nullable().optional(),
})

export type CreateLocationInput = z.infer<typeof createLocationSchema>
