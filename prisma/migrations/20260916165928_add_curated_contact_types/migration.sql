-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactType" ADD VALUE 'PUBLIC_PENSION_PLAN';
ALTER TYPE "ContactType" ADD VALUE 'PRIVATE_PENSION_PLAN';
ALTER TYPE "ContactType" ADD VALUE 'INSTITUTIONAL_INVESTOR';
ALTER TYPE "ContactType" ADD VALUE 'ENDOWMENT';
ALTER TYPE "ContactType" ADD VALUE 'FOUNDATION';
ALTER TYPE "ContactType" ADD VALUE 'INSURANCE_COMPANY';
ALTER TYPE "ContactType" ADD VALUE 'SOVEREIGN_WEALTH_FUND';
ALTER TYPE "ContactType" ADD VALUE 'SINGLE_FAMILY_OFFICE';
ALTER TYPE "ContactType" ADD VALUE 'MULTI_FAMILY_OFFICE';
ALTER TYPE "ContactType" ADD VALUE 'FAMILY_OFFICE_RIA';
ALTER TYPE "ContactType" ADD VALUE 'WEALTH_MANAGER';
ALTER TYPE "ContactType" ADD VALUE 'HNW';
ALTER TYPE "ContactType" ADD VALUE 'INDIVIDUAL';
ALTER TYPE "ContactType" ADD VALUE 'FAMILY_MEMBER';
ALTER TYPE "ContactType" ADD VALUE 'TRUSTS_TRUSTEE';
ALTER TYPE "ContactType" ADD VALUE 'PRIVATE_EQUITY_FUND';
ALTER TYPE "ContactType" ADD VALUE 'FUND_OF_FUNDS';
ALTER TYPE "ContactType" ADD VALUE 'HEDGE_FUND';
ALTER TYPE "ContactType" ADD VALUE 'ADVISOR';
ALTER TYPE "ContactType" ADD VALUE 'LAWYER';
ALTER TYPE "ContactType" ADD VALUE 'SERVICE_PROVIDER';
