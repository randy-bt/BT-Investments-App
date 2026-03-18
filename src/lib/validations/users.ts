import { z } from 'zod'

export const changeUserRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
})

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>
