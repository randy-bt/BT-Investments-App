-- deal_sends becomes a first-class citizen of BOTH deal kinds (analyst
-- audit, Randy-directed, 8/17). JV sends previously had nowhere to go:
-- listing_page_id was NOT NULL, so half the pipeline was invisible on
-- investor records. Now exactly one of listing_page_id / jv_deal_id is
-- set, and each kind stays deduped by its own partial unique index.
--
-- NOTE for all future code touching this table: ON CONFLICT upserts
-- CANNOT target partial unique indexes (the v9.0.2 lesson, relearned
-- here on purpose before it bit) - writers must check-then-write.
-- sendQueueRow was converted in the same push.
ALTER TABLE deal_sends ALTER COLUMN listing_page_id DROP NOT NULL;
ALTER TABLE deal_sends ADD COLUMN IF NOT EXISTS jv_deal_id UUID REFERENCES jv_deals(id) ON DELETE CASCADE;
ALTER TABLE deal_sends ADD CONSTRAINT deal_sends_exactly_one_deal
  CHECK ((listing_page_id IS NULL) <> (jv_deal_id IS NULL));
ALTER TABLE deal_sends DROP CONSTRAINT deal_sends_listing_page_id_investor_id_key;
CREATE UNIQUE INDEX deal_sends_listing_inv
  ON deal_sends (listing_page_id, investor_id) WHERE listing_page_id IS NOT NULL;
CREATE UNIQUE INDEX deal_sends_jv_inv
  ON deal_sends (jv_deal_id, investor_id) WHERE jv_deal_id IS NOT NULL;
CREATE INDEX deal_sends_jv_deal_id_idx ON deal_sends (jv_deal_id);
