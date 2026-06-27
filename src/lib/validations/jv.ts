import { z } from 'zod'

export const manualJvDealSchema = z.object({
  address: z.string().trim().min(1, 'Address is required'),
  source_name: z.string().trim().min(1, 'Source is required'),
  asking_price: z.string().trim().optional(),
  note: z.string().trim().optional(),
})

export type ManualJvDealInput = z.infer<typeof manualJvDealSchema>
