-- JV deals through dispositions (Randy's spec, Oct 7 2026, v10.2.0).
--
-- 1. A marketing page can belong to a JV deal instead of a lead. One page
--    per JV deal, and a page with jv_deal_id renders on the Deals tab ONLY
--    as that JV deal, never as a second ACQ row.
ALTER TABLE listing_pages
  ADD COLUMN jv_deal_id UUID UNIQUE REFERENCES jv_deals(id) ON DELETE SET NULL;

-- 2. A JV queue row may now carry the linked page in listing_page_id, so
--    the standing rule (no marketing page, no send) unlocks for JV deals
--    the same way it does for ours. The original CHECK made deal_kind =
--    'listing' EQUIVALENT to listing_page_id being set, which forbade
--    exactly that. It becomes an implication: a listing row must still
--    have a page; a JV row may.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'dispo_queue'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%deal_kind%listing%listing_page_id IS NOT NULL%'
  LOOP
    EXECUTE format('ALTER TABLE dispo_queue DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE dispo_queue
  ADD CONSTRAINT dispo_queue_listing_needs_page
  CHECK (deal_kind <> 'listing' OR listing_page_id IS NOT NULL);

-- 3. Messages are composed fresh when the Send pop-up opens, from the
--    page as it is then. A row the analyst hand-edited keeps its text:
--    updateQueueMessages stamps this, and the refresh leaves stamped rows
--    alone.
ALTER TABLE dispo_queue
  ADD COLUMN edited_at TIMESTAMPTZ;
