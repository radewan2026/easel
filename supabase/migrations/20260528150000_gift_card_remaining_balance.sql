-- Add remaining_balance to gift_cards for partial redemption support
ALTER TABLE gift_cards ADD COLUMN remaining_balance numeric;

-- Backfill: already-redeemed cards get 0, unredeemed cards get full amount
UPDATE gift_cards SET remaining_balance = CASE WHEN is_redeemed THEN 0 ELSE amount END;

-- Make NOT NULL with a default for future inserts
ALTER TABLE gift_cards ALTER COLUMN remaining_balance SET NOT NULL;
ALTER TABLE gift_cards ALTER COLUMN remaining_balance SET DEFAULT 0;

-- Notify PostgREST schema cache
NOTIFY pgrst, 'reload schema';
