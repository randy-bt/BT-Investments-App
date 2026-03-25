-- Track per-user first views of lead/investor records
CREATE TABLE entity_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('lead', 'investor')),
  entity_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

ALTER TABLE entity_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own views"
  ON entity_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own views"
  ON entity_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);
