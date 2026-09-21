-- AlterEnum
-- Removes LP_INSTITUTIONAL, BROKER_ADVISOR, SPONSOR_COGP, CONSULTANT,
-- FAMILY_OFFICE, FAMILY_OFFICE_RIA from ContactType. All three columns using
-- this enum (Contact.type, Company.type, MailingList.filterType) were
-- confirmed to have zero rows on any of these values before this migration
-- was written (see scripts-oneoff-migrate-contact-types.js and
-- scripts-oneoff-migrate-family-office.js).
BEGIN;
CREATE TYPE "ContactType_new" AS ENUM (
  'PLACEMENT_AGENT',
  'OTHER',
  'PUBLIC_PENSION_PLAN',
  'PRIVATE_PENSION_PLAN',
  'INSTITUTIONAL_INVESTOR',
  'ENDOWMENT',
  'FOUNDATION',
  'INSURANCE_COMPANY',
  'SOVEREIGN_WEALTH_FUND',
  'SINGLE_FAMILY_OFFICE',
  'MULTI_FAMILY_OFFICE',
  'WEALTH_MANAGER',
  'HNW',
  'INDIVIDUAL',
  'FAMILY_MEMBER',
  'TRUSTS_TRUSTEE',
  'PRIVATE_EQUITY_FUND',
  'FUND_OF_FUNDS',
  'HEDGE_FUND',
  'ADVISOR',
  'LAWYER',
  'SERVICE_PROVIDER'
);
ALTER TABLE "Contact" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Contact" ALTER COLUMN "type" TYPE "ContactType_new" USING ("type"::text::"ContactType_new");
ALTER TABLE "Contact" ALTER COLUMN "type" SET DEFAULT 'OTHER';
ALTER TABLE "Company" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Company" ALTER COLUMN "type" TYPE "ContactType_new" USING ("type"::text::"ContactType_new");
ALTER TABLE "Company" ALTER COLUMN "type" SET DEFAULT 'OTHER';
ALTER TABLE "MailingList" ALTER COLUMN "filterType" TYPE "ContactType_new" USING ("filterType"::text::"ContactType_new");
ALTER TYPE "ContactType" RENAME TO "ContactType_old";
ALTER TYPE "ContactType_new" RENAME TO "ContactType";
DROP TYPE "ContactType_old";
COMMIT;
