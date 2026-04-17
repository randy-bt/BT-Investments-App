-- Add closed milestone to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS closed boolean NOT NULL DEFAULT false;
