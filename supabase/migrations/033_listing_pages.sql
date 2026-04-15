CREATE TABLE listing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  price TEXT NOT NULL,
  html_content TEXT NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX listing_pages_created_at_idx ON listing_pages(created_at DESC);

ALTER TABLE listing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage listing pages"
  ON listing_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);
