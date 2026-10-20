/** Display-only restriction; notification delivery permissions are unchanged. */
export function canPreviewNotificationSounds(email: string | null | undefined, isOwner: boolean) {
  return isOwner && email?.trim().toLowerCase() === "mansouralmailscores@gmail.com";
}