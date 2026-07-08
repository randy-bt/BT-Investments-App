-- Private bucket holding the original HTML of each ingested JV email so
-- cards can open the real email without a Gmail login. Served only via the
-- auth-gated /api/jv/email/[id] route (service role); no public access.
-- Applied to prod 2026-07-08.
INSERT INTO storage.buckets (id, name, public)
VALUES ('jv-emails', 'jv-emails', false)
ON CONFLICT (id) DO NOTHING;
