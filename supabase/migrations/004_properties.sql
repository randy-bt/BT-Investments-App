CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  apn TEXT,
  legal_description TEXT,
  year_built INTEGER,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  sqft INTEGER,
  lot_size TEXT,
  property_type TEXT,
  owner_name TEXT,
  owner_mailing_address TEXT,
  redfin_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX properties_lead_id_idx ON properties(lead_id);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage properties"
  ON properties FOR ALL TO authenticated USING (true) WITH CHECK (true);
