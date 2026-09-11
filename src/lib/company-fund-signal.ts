import { Company } from "@prisma/client";

/**
 * Whether a company belongs in the AREF I Prospects funnel — much simpler
 * than the contact-side check, since Company.recordContext is already
 * single-valued (see its schema comment): a company is unambiguously FUND,
 * DEAL, or unclassified, never both.
 */
export function belongsInCompanyFundFunnel(company: Pick<Company, "recordContext">): boolean {
  return company.recordContext === "FUND";
}
