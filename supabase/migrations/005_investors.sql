CREATE TABLE investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  locations_of_interest TEXT NOT NULL,
  deals_notes TEXT,
  status entity_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER investors_updated_at
  BEFORE UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX investors_status_idx ON investors(status);

ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all investors"
  ON investors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert investors"
  ON investors FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can update investors"
  ON investors FOR UPDATE TO authenticated USING (true);

-- Investor phones
CREATE TABLE investor_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX investor_phones_investor_id_idx ON investor_phones(investor_id);
CREATE UNIQUE INDEX investor_phones_primary_idx ON investor_phones(investor_id) WHERE is_primary = true;

ALTER TABLE investor_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage investor phones"
  ON investor_phones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Investor emails
CREATE TABLE investor_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX investor_emails_investor_id_idx ON investor_emails(investor_id);
CREATE UNIQUE INDEX investor_emails_primary_idx ON investor_emails(investor_id) WHERE is_primary = true;

ALTER TABLE investor_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage investor emails"
  ON investor_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
