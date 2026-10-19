export type ThreadComment = { id: string; parent_comment_id: string | null };

export function replyParent(comment: ThreadComment): string {
  return comment.parent_comment_id ?? comment.id;
}

export function commentThreads<T extends ThreadComment>(comments: T[]) {
  return comments.filter(c => !c.parent_comment_id).map(root => ({
    root, replies: comments.filter(c => c.parent_comment_id === root.id),
  }));
}