import { describe, it, expect } from 'vitest'
import { formSubmissionSchema } from '@/lib/validations/forms'

describe('formSubmissionSchema', () => {
  it('accepts valid submission', () => {
    const result = formSubmissionSchema.safeParse({
      form_name: 'BT Investments - Sell Your Property',
      data: { name: 'John', email: 'john@example.com', message: 'Hello' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown form name', () => {
    const result = formSubmissionSchema.safeParse({
      form_name: 'Fake Form',
      data: { name: 'John' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects field values over 5000 chars', () => {
    const result = formSubmissionSchema.safeParse({
      form_name: 'Signal - Contact Form',
      data: { message: 'x'.repeat(5001) },
    })
    expect(result.success).toBe(false)
  })
})
