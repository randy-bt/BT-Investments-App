-- New PUBLIC bucket for listing-page photos.
-- The marketing flyer HTML embeds <img src="..."> URLs that need to load
-- for anyone visiting btinvestments.co/deals/[slug], so the bucket must be
-- public. The existing `attachments` bucket stays private because it holds
-- lead documents, recordings, and other sensitive files.

INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-page-photos', 'listing-page-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE POLICY "authenticated can upload listing-page-photos"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'listing-page-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "anyone can read listing-page-photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'listing-page-photos');

CREATE POLICY "authenticated can delete listing-page-photos"
  ON storage.objects FOR DELETE TO public
  USING (
    bucket_id = 'listing-page-photos'
    AND auth.role() = 'authenticated'
  );
