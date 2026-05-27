-- Convert leads.our_current_offer from numeric to text so the Lead
-- Record input can accept free-form values ("$320k", "350,000 firm",
-- "Around 400", etc.) the same way asking_price and range already do.
-- Existing numeric values cast cleanly to their string equivalents
-- ("350000"); they'll display as-is until the user re-enters them
-- with whatever formatting they prefer.

ALTER TABLE leads ALTER COLUMN our_current_offer TYPE text USING our_current_offer::text;
