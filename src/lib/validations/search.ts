import { z } from 'zod'

export const searchSchema = z.object({
  query: z.string().min(1).max(200),
})

export type SearchInput = z.infer<typeof searchSchema>
