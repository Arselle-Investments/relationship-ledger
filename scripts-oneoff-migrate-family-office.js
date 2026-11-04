// One-off data migration: retire generic FAMILY_OFFICE and FAMILY_OFFICE_RIA
// in favor of always requiring SINGLE_FAMILY_OFFICE / MULTI_FAMILY_OFFICE (or
// WEALTH_MANAGER for the RIA-flavored ones). We have no source signal to tell
// single- vs. multi-family apart automatically, so every former FAMILY_OFFICE
// record defaults to SINGLE_FAMILY_OFFICE as a starting guess and gets
// flagged for manual confirmation in the company-type-review spreadsheet.
//
// Uses raw SQL rather than the typed Prisma Client: the client has already
// been regenerated against the new schema (which no longer declares
// FAMILY_OFFICE/FAMILY_OFFICE_RIA as valid ContactType values), so it refuses
// to even build a query that filters or writes those literal strings. Raw SQL
// talks directly to Postgres, which still has them as valid (if soon-to-be-
// unused) enum values at this point, so it works fine.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const contactFO = await p.$executeRawUnsafe(
    `UPDATE "Contact" SET type = 'SINGLE_FAMILY_OFFICE' WHERE type = 'FAMILY_OFFICE'`
  );
  console.log("Contacts: FAMILY_OFFICE -> SINGLE_FAMILY_OFFICE (needs manual SFO/MFO confirmation):", contactFO);

  const contactRIA = await p.$executeRawUnsafe(
    `UPDATE "Contact" SET type = 'WEALTH_MANAGER' WHERE type = 'FAMILY_OFFICE_RIA'`
  );
  console.log("Contacts: FAMILY_OFFICE_RIA -> WEALTH_MANAGER:", contactRIA);

  const companyFO = await p.$executeRawUnsafe(
    `UPDATE "Company" SET type = 'SINGLE_FAMILY_OFFICE' WHERE type = 'FAMILY_OFFICE'`
  );
  console.log("Companies: FAMILY_OFFICE -> SINGLE_FAMILY_OFFICE (needs manual SFO/MFO confirmation):", companyFO);

  const companyRIA = await p.$executeRawUnsafe(
    `UPDATE "Company" SET type = 'WEALTH_MANAGER' WHERE type = 'FAMILY_OFFICE_RIA'`
  );
  console.log("Companies: FAMILY_OFFICE_RIA -> WEALTH_MANAGER:", companyRIA);

  console.log("");
  console.log("--- Verification: any rows still on a retired value? ---");
  const contactLeft = await p.$queryRawUnsafe(
    `SELECT type, COUNT(*) FROM "Contact" WHERE type IN ('FAMILY_OFFICE','FAMILY_OFFICE_RIA','LP_INSTITUTIONAL','BROKER_ADVISOR','SPONSOR_COGP','CONSULTANT') GROUP BY type`
  );
  const companyLeft = await p.$queryRawUnsafe(
    `SELECT type, COUNT(*) FROM "Company" WHERE type IN ('FAMILY_OFFICE','FAMILY_OFFICE_RIA','LP_INSTITUTIONAL','BROKER_ADVISOR','SPONSOR_COGP','CONSULTANT') GROUP BY type`
  );
  console.log("Contacts still on a retired type:", contactLeft);
  console.log("Companies still on a retired type:", companyLeft);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
