import { sendPushToEmails } from "@/lib/push-server";

function previewText(text: string, max = 60): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export async function notifyAuthorOfCommunityLike(input: {
  authorEmail: string;
  likerName: string;
  likerEmail: string;
  postId: string;
}): Promise<void> {
  const author = input.authorEmail.trim().toLowerCase();
  const liker = input.likerEmail.trim().toLowerCase();
  if (!author || author === liker) return;

  await sendPushToEmails([author], {
    title: "社群讚好",
    body: `${input.likerName || "有人"} 讚好咗你嘅貼文`,
    url: "/community",
    tag: `community-like-${input.postId}-${liker}`,
  });
}

export async function notifyAuthorOfCommunityComment(input: {
  authorEmail: string;
  commenterName: string;
  commenterEmail: string;
  postId: string;
  commentText: string;
}): Promise<void> {
  const author = input.authorEmail.trim().toLowerCase();
  const commenter = input.commenterEmail.trim().toLowerCase();
  if (!author || author === commenter) return;

  const snippet = previewText(input.commentText);

  await sendPushToEmails([author], {
    title: "社群留言",
    body: `${input.commenterName || "有人"}：${snippet}`,
    url: "/community",
    tag: `community-comment-${input.postId}-${commenter}`,
  });
}
