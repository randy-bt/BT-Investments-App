-- Agreements module: templates + generated archive
-- Templates live as Google Docs shared with the service account;
-- we store pointers + variable schema here so the UI can render dynamic forms.

CREATE TABLE agreement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  agreement_type text NOT NULL,
  google_doc_id text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);

CREATE INDEX idx_agreement_templates_active ON agreement_templates(active);
CREATE INDEX idx_agreement_templates_type ON agreement_templates(agreement_type);

CREATE TABLE generated_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES agreement_templates(id) ON DELETE SET NULL,
  template_name text NOT NULL,
  agreement_type text NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  variables_used jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

CREATE INDEX idx_generated_agreements_lead ON generated_agreements(lead_id);
CREATE INDEX idx_generated_agreements_created ON generated_agreements(created_at DESC);

ALTER TABLE agreement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read templates"
  ON agreement_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can write templates"
  ON agreement_templates FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can read generated"
  ON generated_agreements FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can write generated"
  ON generated_agreements FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
