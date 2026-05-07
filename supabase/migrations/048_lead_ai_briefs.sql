CREATE TABLE lead_ai_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  brief_text TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Marker for cache invalidation: regenerate when there's been new
  -- activity (an updates row newer than this) since the brief was made.
  based_on_update_id UUID REFERENCES updates(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id)
);

CREATE INDEX lead_ai_briefs_lead_idx
  ON lead_ai_briefs(lead_id, generated_at DESC);

ALTER TABLE lead_ai_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view briefs"
  ON lead_ai_briefs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert briefs"
  ON lead_ai_briefs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
