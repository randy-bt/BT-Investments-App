import { createClient } from '@supabase/supabase-js'

// Cost per million tokens (USD). Verified against provider pricing 2026-07.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  // Haiku 4.5 is $1/$5 (the old $0.8/$4 was Haiku 3.5 pricing)
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'gpt-4o': { input: 2.5, output: 10 },
  // Transcription is billed on AUDIO input tokens (~$3/M ≈ $0.003/min) plus
  // text output at $5/M. Call sites log the real usage object from OpenAI.
  'gpt-4o-mini-transcribe-2025-12-15': { input: 3, output: 5 },
  // ElevenLabs is a flat monthly subscription (Creator) — the marginal cost
  // per call inside the quota is $0. The subscription itself belongs in the
  // fixed-monthly-costs table, not per-call estimates.
  eleven_turbo_v2_5: { input: 0, output: 0 },
}

export type ApiUsageEntry = {
  provider: string // 'anthropic' | 'openai' | 'elevenlabs' | 'quo' | 'resend' | ...
  model: string
  feature: string
  input_tokens: number
  output_tokens: number
  // Flat cost override for non-token services (e.g. $0.01 per SMS).
  cost?: number
}

function estimateCost(entry: ApiUsageEntry): number {
  if (entry.cost != null) return entry.cost
  const pricing = PRICING[entry.model] || { input: 5, output: 15 }
  return (entry.input_tokens * pricing.input + entry.output_tokens * pricing.output) / 1_000_000
}

export async function logApiUsage(entry: ApiUsageEntry): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const cost = estimateCost(entry)

    await supabase.from('api_usage_logs').insert({
      provider: entry.provider,
      model: entry.model,
      feature: entry.feature,
      input_tokens: entry.input_tokens,
      output_tokens: entry.output_tokens,
      estimated_cost: cost,
    })
  } catch (e) {
    // Usage logging should never break the main flow
    console.error('[api-usage] Failed to log:', e)
  }
}
