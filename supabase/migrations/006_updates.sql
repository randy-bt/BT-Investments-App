CREATE TABLE updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER updates_updated_at
  BEFORE UPDATE ON updates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX updates_entity_idx ON updates(entity_type, entity_id);

ALTER TABLE updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all updates"
  ON updates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert updates"
  ON updates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own updates"
  ON updates FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own updates"
  ON updates FOR DELETE TO authenticated
  USING (auth.uid() = author_id);
