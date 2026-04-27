-- Update PSA template's effective_date variable to auto-prefill tomorrow,
-- and purchase_price to autofill from the lead's our_current_offer.
UPDATE agreement_templates
SET variables = (
  SELECT jsonb_agg(
    CASE
      WHEN var->>'key' = 'effective_date' THEN
        (var - 'defaultValue')
        || jsonb_build_object(
          'type', 'computed',
          'computed', jsonb_build_object('fn', 'today_plus_days', 'days', 1),
          'format', 'date_long'
        )
      WHEN var->>'key' = 'purchase_price' THEN
        var || jsonb_build_object('autofillFrom', 'lead_our_current_offer')
      ELSE var
    END
  )
  FROM jsonb_array_elements(variables) AS var
),
updated_at = now()
WHERE agreement_type = 'PSA';
