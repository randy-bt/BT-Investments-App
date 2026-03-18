import { z } from 'zod'

export const createUpdateSchema = z.object({
  entity_type: z.enum(['lead', 'investor']),
  entity_id: z.string().uuid(),
  content: z.string().min(1, 'Content is required'),
})

export const editUpdateSchema = z.object({
  content: z.string().min(1, 'Content is required'),
})

export type CreateUpdateInput = z.infer<typeof createUpdateSchema>
export type EditUpdateInput = z.infer<typeof editUpdateSchema>
