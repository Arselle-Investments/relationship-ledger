import { Company } from "@prisma/client";

/**
 * Whether a company belongs in the AREF I Prospects funnel. A company can
 * genuinely be both FUND and DEAL (an existing Deal-side LP relationship
 * that's also a separate fund prospect) — this only checks for the FUND
 * signal, same as the contact-side check.
 */
export function belongsInCompanyFundFunnel(company: Pick<Company, "recordContexts">): boolean {
  return company.recordContexts.includes("FUND");
}
