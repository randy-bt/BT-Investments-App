CREATE TABLE public_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  notified BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public_form_submissions ENABLE ROW LEVEL SECURITY;

-- Public can insert (no auth needed)
CREATE POLICY "Anyone can submit forms"
  ON public_form_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users can read
CREATE POLICY "Authenticated users can view submissions"
  ON public_form_submissions FOR SELECT
  TO authenticated
  USING (true);
