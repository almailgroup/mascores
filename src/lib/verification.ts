export function assignableVerificationBadge(badge: string | null) {
  return badge === null || badge === 'verified' || badge === 'golden';
}
export function canReplyToVerification(status: string) {
  return status === 'approved' || status === 'rejected';
}