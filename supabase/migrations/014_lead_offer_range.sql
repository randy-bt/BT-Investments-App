-- Add our_current_offer and range fields to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS our_current_offer numeric;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS range text;
