import { expect, it } from 'vitest';
import { assignableVerificationBadge, canReplyToVerification } from './verification';
it('never allows granting owner verification', () => {
  expect(assignableVerificationBadge('owner')).toBe(false);
  expect(assignableVerificationBadge('golden')).toBe(true);
  expect(assignableVerificationBadge('verified')).toBe(true);
});
it('allows replies only after approval or rejection', () => {
  expect(canReplyToVerification('pending')).toBe(false);
  expect(canReplyToVerification('approved')).toBe(true);
  expect(canReplyToVerification('rejected')).toBe(true);
});