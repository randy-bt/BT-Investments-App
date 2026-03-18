import { z } from 'zod'

const ALLOWED_FORM_NAMES = [
  'BT Investments - Sell Your Property',
  'BT Investments - Join Buyers List',
  'Signal - Contact Form',
  'Infinite RE - Contact Form',
  'Infinite Media - Contact Form',
] as const

export const formSubmissionSchema = z.object({
  form_name: z.enum(ALLOWED_FORM_NAMES),
  data: z.record(z.string(), z.string().max(5000)).refine(
    (data) => JSON.stringify(data).length <= 10240,
    { message: 'Form data too large (max 10KB)' }
  ),
})

export type FormSubmissionInput = z.infer<typeof formSubmissionSchema>
