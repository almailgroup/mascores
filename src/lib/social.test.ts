import { describe, expect, it } from 'vitest';
import { socialAlertEnabled, recordingShareUrl } from './social';
describe('social alerts', () => {
  it('disables all social phone alerts with the master preference', () => {
    for (const kind of ['follow','request','like','comment','repost'] as const) expect(socialAlertEnabled({social:false},kind)).toBe(false);
  });
  it('disables likes without muting follows', () => {
    expect(socialAlertEnabled({social_like:false},'like')).toBe(false);
    expect(socialAlertEnabled({social_like:false},'follow')).toBe(true);
  });
  it('shares the specific recording on its host profile', () => {
    expect(recordingShareUrl('Mascores','abc')).toBe('https://mascores.live/u/Mascores?recording=abc');
  });
});