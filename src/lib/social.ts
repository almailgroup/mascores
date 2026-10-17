export type SocialKind = 'follow' | 'request' | 'like' | 'comment' | 'repost';
export function socialMessage(kind: SocialKind, arabic = false) {
  const en = { follow: 'followed you', request: 'requested to follow you', like: 'liked your recording', comment: 'commented on your recording', repost: 'reposted your recording' };
  const ar = { follow: 'بدأ متابعتك', request: 'طلب متابعتك', like: 'أعجب بتسجيلك', comment: 'علّق على تسجيلك', repost: 'أعاد نشر تسجيلك' };
  return (arabic ? ar : en)[kind];
}
export function recordingShareUrl(username: string, recordingId: string) {
  return `https://mascores.live/u/${encodeURIComponent(username)}?recording=${encodeURIComponent(recordingId)}`;
}
export function socialAlertEnabled(prefs: Record<string, unknown>, kind: SocialKind) {
  return prefs.social !== false && prefs[`social_${kind}`] !== false;
}