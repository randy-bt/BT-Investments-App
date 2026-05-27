import { z } from 'zod'

export const investorPhoneSchema = z.object({
  phone_number: z.string().min(1, 'Phone number is required'),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const investorEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  label: z.string().optional(),
  is_primary: z.boolean().default(false),
})

export const createInvestorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  // Optional in the DB after migration 052; the UI's New Investor form
  // still enforces it via its own client-side check, but bulk-import
  // scripts can omit it and backfill later.
  locations_of_interest: z.string().optional().nullable(),
  company: z.string().optional(),
  deals_notes: z.string().optional(),
  handoff_notes: z.string().optional(),
  phones: z.array(investorPhoneSchema).optional().default([]),
  emails: z.array(investorEmailSchema).optional().default([]),
})

export const updateInvestorSchema = z.object({
  name: z.string().min(1).optional(),
  locations_of_interest: z.string().min(1).optional(),
  company: z.string().nullable().optional(),
  deals_notes: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive', 'onboarding', 'archived']).optional(),
}).partial()

export type CreateInvestorInput = z.infer<typeof createInvestorSchema>
export type UpdateInvestorInput = z.infer<typeof updateInvestorSchema>
