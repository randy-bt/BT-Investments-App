import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'
import type { AgreementReviewIssue } from './review'

const MODEL = 'claude-sonnet-4-6'

const PROMPT = (
  templateName: string,
  filledText: string,
  values: Record<string, string>,
) => `You are the final pre-send reviewer for a filled real-estate contract ("${templateName}") for BT Investments (the Buyer). It will be sent to the Seller for signature — errors are costly.

Below is (1) the FINAL contract text after substitution, and (2) the INTENDED field values the preparer entered.

Flag ONLY concrete problems:
- Values that printed blank, wrong, or in the wrong place
- Leftover template artifacts ("{{", "}}", stray brackets)
- Internal contradictions (dates out of order, amounts that don't add up, sections that conflict, buyer/seller roles reversed)
- Dates that are clearly wrong (past dates, wrong year)
- Checkbox sections where the checked option contradicts another section

Do NOT flag: style, legal advice, formatting/whitespace quirks from text extraction, intentionally blank optional fields (e.g. financing terms for an unselected financing method), or things that merely could be improved.

Return ONLY a JSON array (no prose): [{"severity":"error"|"warning"|"note","message":"..."}]
Return [] if the contract is clean.

--- INTENDED VALUES ---
${JSON.stringify(values, null, 2)}

--- FINAL CONTRACT TEXT ---
${filledText.slice(0, 24000)}`

// Best-effort AI review of the filled contract. Never throws — if the API
// call fails, returns ok:false so the UI can say "AI review unavailable"
// (the deterministic checks still ran; generation is not blocked).
export async function aiReviewAgreement(opts: {
  templateName: string
  filledText: string
  values: Record<string, string>
}): Promise<{ ok: boolean; issues: AgreementReviewIssue[] }> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [
        { role: 'user', content: PROMPT(opts.templateName, opts.filledText, opts.values) },
      ],
    })
    try {
      await logApiUsage({
        provider: 'anthropic',
        model: MODEL,
        feature: 'agreement_review',
        input_tokens: res.usage.input_tokens,
        output_tokens: res.usage.output_tokens,
      })
    } catch {
      /* usage logging is best-effort */
    }
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return { ok: true, issues: [] }
    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr)) return { ok: true, issues: [] }
    const issues: AgreementReviewIssue[] = arr
      .filter((i) => i && typeof i.message === 'string')
      .map((i) => ({
        severity: i.severity === 'error' || i.severity === 'warning' ? i.severity : 'note',
        message: i.message,
      }))
    return { ok: true, issues }
  } catch {
    return { ok: false, issues: [] }
  }
}
