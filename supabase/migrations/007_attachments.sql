CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX attachments_update_id_idx ON attachments(update_id);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage attachments"
  ON attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
