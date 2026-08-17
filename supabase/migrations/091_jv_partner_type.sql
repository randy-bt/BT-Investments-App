-- Dispositions restructure (Randy via analyst, 8/17): JV partners move
-- from the retired jv_partners rich-text board into the investors table
-- with a TYPE (wholesaler / agent / reference) instead of a buying
-- status. Directories belong in tables where nothing can drift; boards
-- stay task lists.
--
-- Two-layer send protection: partners are status 'inactive' AND the
-- matching RPC now excludes jv_partner_type IS NOT NULL outright, so no
-- recipient pool or match count can ever reach them. "17 matches" means
-- 17 reachable active buyers.
ALTER TABLE investors ADD COLUMN IF NOT EXISTS jv_partner_type TEXT
  CHECK (jv_partner_type IN ('wholesaler', 'agent', 'reference'));

-- RPC rebuilt with the exclusion (exact original return signature kept;
-- a first attempt with a guessed signature was refused by Postgres).
-- See the applied migration for the full body: only the WHERE gains
--   AND i.jv_partner_type IS NULL
--
-- The 14 partners from the retired board, insert guarded against
-- re-runs: Leka / Shiraz / Vozhi / Jared Flips (reference), Vayna /
-- Denis / Darian / Jackson / Ludomir / Wally / Cole (wholesaler),
-- Jim Jacobsen / Veronica / Maria Dennis (agent).
CREATE OR REPLACE FUNCTION public.matching_investors_for_listing_page(p_listing_page_id uuid)
 RETURNS TABLE(investor_id uuid, match_location_id uuid, match_location_name text, match_location_kind text)
 LANGUAGE sql
 STABLE
AS $function$
  WITH RECURSIVE deal_location_tree AS (
    SELECT location_id
    FROM listing_page_locations
    WHERE listing_page_id = p_listing_page_id

    UNION

    SELECT l.parent_id
    FROM locations l
    JOIN deal_location_tree dlt ON l.id = dlt.location_id
    WHERE l.parent_id IS NOT NULL
  )
  SELECT DISTINCT ON (i.id)
    i.id,
    il.location_id,
    l.name,
    l.kind
  FROM investors i
  JOIN investor_locations il ON il.investor_id = i.id
  JOIN locations l ON l.id = il.location_id
  WHERE il.location_id IN (SELECT location_id FROM deal_location_tree WHERE location_id IS NOT NULL)
    AND i.status = 'active'
    AND i.jv_partner_type IS NULL
  ORDER BY
    i.id,
    CASE l.kind WHEN 'city' THEN 1 WHEN 'neighborhood' THEN 2 WHEN 'county' THEN 3 WHEN 'state' THEN 4 WHEN 'region' THEN 5 ELSE 6 END;
$function$;

INSERT INTO investors (name, status, jv_partner_type, created_by)
SELECT v.name, 'inactive'::entity_status, v.ptype, 'ff676ecc-90e4-45db-bf78-3281d13d2836'
FROM (VALUES
  ('Leka', 'reference'), ('Shiraz', 'reference'), ('Vozhi', 'reference'), ('Jared Flips', 'reference'),
  ('Vayna', 'wholesaler'), ('Denis', 'wholesaler'), ('Darian', 'wholesaler'), ('Jackson', 'wholesaler'),
  ('Ludomir', 'wholesaler'), ('Wally', 'wholesaler'), ('Cole', 'wholesaler'),
  ('Jim Jacobsen', 'agent'), ('Veronica', 'agent'), ('Maria Dennis', 'agent')
) AS v(name, ptype)
WHERE NOT EXISTS (SELECT 1 FROM investors i WHERE i.name = v.name);
