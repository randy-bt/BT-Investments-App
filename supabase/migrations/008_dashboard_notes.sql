CREATE TABLE dashboard_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT UNIQUE NOT NULL CHECK (module IN ('acquisitions', 'dispositions')),
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

CREATE TRIGGER dashboard_notes_updated_at
  BEFORE UPDATE ON dashboard_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE dashboard_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dashboard notes"
  ON dashboard_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE dashboard_note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_note_id UUID NOT NULL REFERENCES dashboard_notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dashboard_note_versions_note_id_idx ON dashboard_note_versions(dashboard_note_id);

ALTER TABLE dashboard_note_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dashboard note versions"
  ON dashboard_note_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
