/**
 * Non-AI fallback for travel outreach drafts — pure string interpolation, no
 * API call, no cost. Used as the default so a team member mass-emailing a
 * long list of contacts in a city doesn't burn AI credits on every one; AI
 * personalization is an opt-in for when there are just a few people worth the
 * extra polish.
 */
export function buildGenericTravelEmail(params: {
  contactName: string;
  travelerName: string;
  city: string;
  startDate: string;
  endDate: string;
}): string {
  const firstName = params.contactName.trim().split(/\s+/)[0] || params.contactName;
  return `Hi ${firstName},

${params.travelerName} will be in ${params.city} from ${params.startDate} to ${params.endDate} and would love to connect if you're around — happy to grab coffee or hop on a quick call, whatever's easiest.

Let me know if you're free!

Best,
${params.travelerName}`;
}
