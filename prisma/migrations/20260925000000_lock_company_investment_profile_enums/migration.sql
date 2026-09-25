-- Locks Company.targetAssetClasses / investmentStructures / investmentStrategies
-- down from free-text write-in arrays to fixed enums. Every real value
-- currently in these columns was verified and cleaned first (see
-- docs/data-cleanup-tracker.md) to match one of the enum labels below
-- exactly, so the translation CASE expressions are exhaustive — nothing
-- should fall through to NULL.
--
-- Uses an add-column/backfill/drop/rename approach rather than a direct
-- ALTER COLUMN ... TYPE ... USING, since Postgres doesn't allow a subquery
-- (needed here to translate each array element) inside a column USING
-- expression — it's fine inside a plain UPDATE, which is why the
-- translation happens there instead.
BEGIN;

CREATE TYPE "AssetClass" AS ENUM ('INDUSTRIAL', 'MULTIFAMILY', 'RETAIL', 'SELF_STORAGE', 'OFFICE', 'HOSPITALITY', 'LAND');
CREATE TYPE "InvestmentStructure" AS ENUM ('LP_EQUITY', 'CO_GP', 'STRUCTURED_EQUITY', 'DEBT_CAPITAL', 'OTHER_STRATEGIC');
CREATE TYPE "InvestmentStrategy" AS ENUM ('CORE', 'CORE_PLUS', 'VALUE_ADD', 'OPPORTUNISTIC', 'NNN');

ALTER TABLE "Company" ADD COLUMN "targetAssetClasses_new" "AssetClass"[] NOT NULL DEFAULT ARRAY[]::"AssetClass"[];
ALTER TABLE "Company" ADD COLUMN "investmentStructures_new" "InvestmentStructure"[] NOT NULL DEFAULT ARRAY[]::"InvestmentStructure"[];
ALTER TABLE "Company" ADD COLUMN "investmentStrategies_new" "InvestmentStrategy"[] NOT NULL DEFAULT ARRAY[]::"InvestmentStrategy"[];

UPDATE "Company" SET "targetAssetClasses_new" = (
  SELECT ARRAY_AGG(
    CASE elem
      WHEN 'Industrial' THEN 'INDUSTRIAL'
      WHEN 'Multifamily' THEN 'MULTIFAMILY'
      WHEN 'Retail' THEN 'RETAIL'
      WHEN 'Self-Storage' THEN 'SELF_STORAGE'
      WHEN 'Office' THEN 'OFFICE'
      WHEN 'Hospitality' THEN 'HOSPITALITY'
      WHEN 'Land' THEN 'LAND'
    END::"AssetClass"
  )
  FROM unnest("targetAssetClasses") AS elem
) WHERE cardinality("targetAssetClasses") > 0;

UPDATE "Company" SET "investmentStructures_new" = (
  SELECT ARRAY_AGG(
    CASE elem
      WHEN 'LP Equity' THEN 'LP_EQUITY'
      WHEN 'Co-GP' THEN 'CO_GP'
      WHEN 'Structured Equity' THEN 'STRUCTURED_EQUITY'
      WHEN 'Debt Capital' THEN 'DEBT_CAPITAL'
      WHEN 'Other Strategic' THEN 'OTHER_STRATEGIC'
    END::"InvestmentStructure"
  )
  FROM unnest("investmentStructures") AS elem
) WHERE cardinality("investmentStructures") > 0;

UPDATE "Company" SET "investmentStrategies_new" = (
  SELECT ARRAY_AGG(
    CASE elem
      WHEN 'Core' THEN 'CORE'
      WHEN 'Core+' THEN 'CORE_PLUS'
      WHEN 'Value-Add' THEN 'VALUE_ADD'
      WHEN 'Opportunistic' THEN 'OPPORTUNISTIC'
      WHEN 'NNN' THEN 'NNN'
    END::"InvestmentStrategy"
  )
  FROM unnest("investmentStrategies") AS elem
) WHERE cardinality("investmentStrategies") > 0;

ALTER TABLE "Company" DROP COLUMN "targetAssetClasses";
ALTER TABLE "Company" DROP COLUMN "investmentStructures";
ALTER TABLE "Company" DROP COLUMN "investmentStrategies";

ALTER TABLE "Company" RENAME COLUMN "targetAssetClasses_new" TO "targetAssetClasses";
ALTER TABLE "Company" RENAME COLUMN "investmentStructures_new" TO "investmentStructures";
ALTER TABLE "Company" RENAME COLUMN "investmentStrategies_new" TO "investmentStrategies";

COMMIT;
