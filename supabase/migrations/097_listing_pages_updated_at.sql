-- Last-edited date on listing pages (Dispositions Deals tab Step 1, Randy's
-- go Oct 7 2026). INTERNAL ONLY: the Deals tab shows "Updated <date>" on a
-- queued deal whose page was edited after it was created. It is never
-- rendered on the public /deals/[slug] page or the public deals index.
-- Randy does not want investors to see that a page was recently updated,
-- so the public queries keep selecting their columns by name.
--
-- The column is nullable and starts null for every existing page except
-- the two Randy named. A null means "never edited since creation", which is
-- exactly what the Deals tab treats it as.

ALTER TABLE listing_pages
  ADD COLUMN updated_at TIMESTAMPTZ;

-- Bump on an UPDATE that changes the page's CONTENT: inputs (where the photo
-- paths live), price, address, or the rendered html. Toggling show_on_index
-- or is_active is not an edit and must NOT bump it, so those columns are
-- deliberately not compared here.
CREATE OR REPLACE FUNCTION listing_pages_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.inputs IS DISTINCT FROM OLD.inputs
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.address IS DISTINCT FROM OLD.address
     OR NEW.html_content IS DISTINCT FROM OLD.html_content
  THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_pages_touch_updated_at ON listing_pages;
CREATE TRIGGER listing_pages_touch_updated_at
  BEFORE UPDATE ON listing_pages
  FOR EACH ROW
  EXECUTE FUNCTION listing_pages_touch_updated_at();

-- Backfill: only the two pages Randy named. Everything else stays null.
UPDATE listing_pages
  SET updated_at = '2026-10-07'::timestamptz
  WHERE id = '51947369-b0e5-4deb-b77b-30fafca73b0c';           -- Mital

UPDATE listing_pages
  SET updated_at = '2026-10-06'::timestamptz
  WHERE address ILIKE '18027 Dayton Ave N%';                   -- Thole
