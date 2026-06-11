-- Visual "declined" marker on deal sends — red fill on the investor's Deals Sent row.
ALTER TABLE deal_sends ADD COLUMN declined BOOLEAN NOT NULL DEFAULT false;
