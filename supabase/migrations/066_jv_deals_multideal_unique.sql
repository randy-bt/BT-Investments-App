-- 066_jv_deals_multideal_unique.sql
-- Allow multiple deals from a single source email (one blast can list several
-- properties). The 065 single-column unique on source_ref blocked deals 2..N
-- of the same email (they share a Message-ID). Make uniqueness composite on
-- (source_ref, address_normalized): distinct addresses from one email each
-- insert, while a re-run of the same (email, address) is still deduped.
-- Nulls are distinct in Postgres, so multiple unparsed-address deals from one
-- email still insert (they're flagged needs_review); the jv_last_uid watermark
-- prevents re-fetching old messages in normal operation.

DROP INDEX IF EXISTS jv_deals_source_ref_key;

CREATE UNIQUE INDEX jv_deals_source_ref_addr_key
  ON jv_deals(source_ref, address_normalized)
  WHERE source_ref IS NOT NULL;
