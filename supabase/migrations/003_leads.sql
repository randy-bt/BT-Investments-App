CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mailing_address TEXT,
  occupancy_status TEXT,
  asking_price NUMERIC,
  selling_timeline TEXT,
  source_campaign_name TEXT,
  handoff_notes TEXT,
  date_converted DATE,
  stage lead_stage NOT NULL DEFAULT 'follow_up',
  status entity_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX leads_status_idx ON leads(status);
CREATE INDEX leads_stage_idx ON leads(stage);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all leads"
  ON leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert leads"
  ON leads FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can update leads"
  ON leads FOR UPDATE TO authenticated USING (true);

-- Lead phones
CREATE TABLE lead_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lead_phones_lead_id_idx ON lead_phones(lead_id);
CREATE UNIQUE INDEX lead_phones_primary_idx ON lead_phones(lead_id) WHERE is_primary = true;

ALTER TABLE lead_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead phones"
  ON lead_phones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lead emails
CREATE TABLE lead_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lead_emails_lead_id_idx ON lead_emails(lead_id);
CREATE UNIQUE INDEX lead_emails_primary_idx ON lead_emails(lead_id) WHERE is_primary = true;

ALTER TABLE lead_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead emails"
  ON lead_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
