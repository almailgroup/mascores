/** Input must come from Auth.getUser(), never a profile or stored email. */
export function canViewKuwaitAirways(
  verifiedUser: { email?: string; email_confirmed_at?: string } | null,
  isMainAdmin: boolean,
): boolean {
  return isMainAdmin && !!verifiedUser?.email_confirmed_at &&
    verifiedUser.email?.trim().toLowerCase() === "mansouralmailscores@gmail.com";
}