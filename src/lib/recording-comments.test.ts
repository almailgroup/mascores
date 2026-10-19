import { describe, expect, it } from 'vitest';
import { commentThreads, replyParent } from './recording-comments';
describe('recording comment replies', () => {
  const root = { id: 'comment', parent_comment_id: null };
  const reply = { id: 'reply', parent_comment_id: 'comment' };
  it('attaches a reply to the selected comment', () => { expect(replyParent(root)).toBe('comment'); });
  it('keeps a reply to a reply in its original thread', () => { expect(replyParent(reply)).toBe('comment'); });
  it('shows replies below their own comment, not another comment', () => {
    expect(commentThreads([root, { id: 'other', parent_comment_id: null }, reply])).toEqual([
      { root, replies: [reply] }, { root: { id: 'other', parent_comment_id: null }, replies: [] },
    ]);
  });
});