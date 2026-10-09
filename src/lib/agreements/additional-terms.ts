// Optional "Additional Terms" line on the PSA templates (Randy, Oct 9
// 2026): a free-text variable `additional_terms` that prints as its own
// line under section 8 when filled and as nothing at all when blank, so a
// contract with no extra terms looks exactly as before.

import type { AgreementVariable } from '@/lib/types'

export const ADDITIONAL_TERMS_KEY = 'additional_terms'

export function additionalTermsLine(value: string | undefined | null): string {
  const t = (value ?? '').trim()
  return t ? `8a. ADDITIONAL TERMS: ${t}` : ''
}

/** Give every text variable the template defines a value ('' when the
 *  caller left it out) so an optional line never trips the orphan
 *  placeholder guard, and wrap the Additional Terms line. Mutates and
 *  returns `values`. */
export function fillOptionalTextDefaults(
  variables: AgreementVariable[],
  values: Record<string, string>,
): Record<string, string> {
  for (const v of variables) {
    if (v.type !== 'text') continue
    if (!(v.key in values)) values[v.key] = ''
  }
  if (ADDITIONAL_TERMS_KEY in values) values[ADDITIONAL_TERMS_KEY] = additionalTermsLine(values[ADDITIONAL_TERMS_KEY])
  return values
}
