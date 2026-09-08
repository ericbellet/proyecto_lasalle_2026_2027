-- The championship is Sunday-to-Sunday. Align existing, unresolved picks with
-- the closing Sunday of their source cycle plus 1, 4, 13 or 26 weeks.
-- Resolved history is deliberately immutable.
UPDATE "predictions" AS p
SET
  "prediction_date" = (c."deadline_at" AT TIME ZONE 'UTC')::date,
  "resolution_date" = (c."deadline_at" AT TIME ZONE 'UTC')::date
    + CASE p."horizon"
        WHEN '1W' THEN 7
        WHEN '1M' THEN 28
        WHEN '3M' THEN 91
        WHEN '6M' THEN 182
      END
FROM "prediction_cycles" AS c
WHERE p."cycle_id" = c."id"
  AND p."status" = 'active'
  AND p."horizon" IN ('1W', '1M', '3M', '6M');
