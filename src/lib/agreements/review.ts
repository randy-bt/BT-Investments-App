import type { AgreementVariable } from '@/lib/types'
import { parseDateSmart } from './compute'
import { nowPacific } from '@/lib/pacific-date'
import { parseCurrency } from './number-to-words'
import { findOrphanPlaceholders } from '@/lib/google-docs'

// One finding from the pre-send contract review.
// error   = will produce a wrong/incomplete contract — must look at it
// warning = probably wrong — check before sending
// note    = worth knowing, may be intentional
export type AgreementReviewIssue = {
  severity: 'error' | 'warning' | 'note'
  message: string
}

export type AgreementReview = {
  issues: AgreementReviewIssue[]
  ai_ok: boolean
  reviewed_at: string
}

// Mechanical, zero-false-negative checks on the resolved values that were
// substituted into the contract + the final document text. These are the
// "100% catch" layer: blanks, unchecked sections, broken math, leftover
// placeholders. The AI review (ai-review.ts) layers judgment on top.
export function runDeterministicChecks(
  variables: AgreementVariable[],
  resolved: Record<string, string>,
  filledText: string,
): AgreementReviewIssue[] {
  const issues: AgreementReviewIssue[] = []

  for (const v of variables) {
    if (v.type === 'radio') {
      // Exactly one option should carry the X.
      const opts = v.radioOptions ?? []
      const checked = opts.filter((o) => (resolved[o.placeholderKey] ?? '').trim() === 'X')
      if (v.required && checked.length === 0) {
        issues.push({
          severity: 'error',
          message: `No option is checked for "${v.label}" — that section will print with all boxes empty.`,
        })
      }
      continue
    }
    if (v.type === 'checkbox') continue

    const val = (resolved[v.key] ?? '').trim()
    if (v.required && val === '') {
      issues.push({
        severity: 'error',
        message: `"${v.label}" printed blank on the contract.`,
      })
      continue
    }

    // Date fields: flag values that will print as raw text, and past dates.
    if (val && (v.format === 'date_long' || v.format === 'date_short')) {
      const d = parseDateSmart(val)
      if (!d) {
        issues.push({
          severity: 'warning',
          message: `"${v.label}" is not a recognizable date — the contract prints it exactly as typed: "${val}".`,
        })
      } else {
        // Pacific "today" — UTC midnight flagged same-day evening dates as past.
        const today = nowPacific()
        today.setHours(0, 0, 0, 0)
        if (d < today) {
          issues.push({
            severity: 'warning',
            message: `"${v.label}" (${val}) is in the past.`,
          })
        }
      }
    }
  }

  // EMD/inspection date must not land after the closing date.
  const emd = parseDateSmart(resolved['emd_date'] ?? '')
  const closing = parseDateSmart(resolved['closing_date'] ?? '')
  if (emd && closing && emd.getTime() > closing.getTime()) {
    issues.push({
      severity: 'error',
      message: `The EMD/Inspection date (${resolved['emd_date']}) is after the Closing Date (${resolved['closing_date']}).`,
    })
  }

  // Purchase price must equal EMD + remaining balance.
  const price = parseCurrency(resolved['purchase_price'] ?? '')
  const emdAmt = parseCurrency(resolved['emd_amount'] ?? '')
  const balance = parseCurrency(resolved['remaining_balance'] ?? '')
  if (!isNaN(price) && !isNaN(emdAmt) && !isNaN(balance)) {
    if (Math.abs(emdAmt + balance - price) > 0.01) {
      issues.push({
        severity: 'error',
        message: `The numbers don't add up: EMD (${resolved['emd_amount']}) + balance (${resolved['remaining_balance']}) ≠ purchase price (${resolved['purchase_price']}).`,
      })
    }
  }

  // Belt and braces: any {{placeholder}} that survived substitution.
  for (const orphan of findOrphanPlaceholders(filledText)) {
    issues.push({
      severity: 'error',
      message: `Unfilled placeholder left in the document: ${orphan}`,
    })
  }

  // PSA-specific sanity: VACANT checked while a §13 occupancy option is
  // also checked. Often intentional (belt-and-braces vacate terms) — note only.
  const vacantChecked = (resolved['cb_vacant'] ?? '').trim() === 'X'
  const occupancyChecked = ['cb_vacate_coe', 'cb_vacate_days', 'cb_tenant_stays'].some(
    (k) => (resolved[k] ?? '').trim() === 'X',
  )
  if (vacantChecked && occupancyChecked) {
    issues.push({
      severity: 'note',
      message:
        'Property is marked VACANT but an occupancy option (Section 13) is also checked — double-check that reads how you want.',
    })
  }

  return issues
}
