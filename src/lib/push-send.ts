import { supabase } from "@/integrations/supabase/client";

export type PushAudience = { type: "all" } | { type: "team"; teamId: string };

export type PushMessage = {
  kind: "custom" | "news";
  titleEn: string;
  bodyEn: string;
  titleAr: string;
  bodyAr: string;
  /** In-app page the notification opens, e.g. "/news/my-story". */
  path?: string | null;
  audience: PushAudience;
};

/** Owner-only: queues a phone notification; the backend checks ownership again. */
export async function sendPush(msg: PushMessage): Promise<string> {
  const { data, error } = await supabase.rpc("admin_send_push", {
    _kind: msg.kind,
    _title_en: msg.titleEn.trim(),
    _body_en: msg.bodyEn.trim(),
    _title_ar: msg.titleAr.trim(),
    _body_ar: msg.bodyAr.trim(),
    _path: msg.path ?? "",
    _audience_type: msg.audience.type,
    _team_id: (msg.audience.type === "team" ? msg.audience.teamId : null) as string,
  });
  if (error) throw error;
  return data as string;
}

/** Builds the news alert for a published article. */
export function newsPush(post: { title: string; title_ar?: string | null; excerpt?: string | null; excerpt_ar?: string | null; slug: string; team_id?: string | null }, toClubFans: boolean): PushMessage {
  return {
    kind: "news",
    titleEn: post.title,
    bodyEn: post.excerpt ?? "",
    titleAr: post.title_ar || post.title,
    bodyAr: post.excerpt_ar || post.excerpt || "",
    path: `/news/${post.slug}`,
    audience: toClubFans && post.team_id ? { type: "team", teamId: post.team_id } : { type: "all" },
  };
}
