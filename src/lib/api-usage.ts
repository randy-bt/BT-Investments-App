import { createClient } from '@supabase/supabase-js'

// Cost per million tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini-transcribe-2025-12-15': { input: 1.25, output: 0 },
}

export type ApiUsageEntry = {
  provider: 'anthropic' | 'openai'
  model: string
  feature: string
  input_tokens: number
  output_tokens: number
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] || { input: 5, output: 15 }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

export async function logApiUsage(entry: ApiUsageEntry): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const cost = estimateCost(entry.model, entry.input_tokens, entry.output_tokens)

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
