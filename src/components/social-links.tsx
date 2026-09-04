import { Globe, Instagram, Facebook, Youtube, Twitter, Music2, Send } from "lucide-react";
import { useTx } from "@/lib/auto-translate";

export type SocialMap = Record<string, string>;

export const SOCIAL_NETWORKS = [
  { key: "instagram", label: "Instagram", icon: Instagram, prefix: "https://instagram.com/" },
  { key: "x", label: "X (Twitter)", icon: Twitter, prefix: "https://x.com/" },
  { key: "facebook", label: "Facebook", icon: Facebook, prefix: "https://facebook.com/" },
  { key: "youtube", label: "YouTube", icon: Youtube, prefix: "https://youtube.com/@" },
  { key: "tiktok", label: "TikTok", icon: Music2, prefix: "https://tiktok.com/@" },
  { key: "telegram", label: "Telegram", icon: Send, prefix: "https://t.me/" },
  { key: "website", label: "Website", icon: Globe, prefix: "https://" },
] as const;

/** Accept a handle or a full URL and always produce something a browser can open. */
export function socialHref(key: string, value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const network = SOCIAL_NETWORKS.find((item) => item.key === key);
  return `${network?.prefix ?? "https://"}${trimmed.replace(/^@/, "")}`;
}

/** Read the JSON column safely: only string values for known networks are kept. */
export function normalizeSocial(value: unknown): SocialMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: SocialMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" && raw.trim()) out[key] = raw.trim();
  }
  return out;
}

/** Social media card shown on club, player and coach pages. */
export function SocialLinksSection({ value, title }: { value: unknown; title?: string }) {
  const tx = useTx();
  const links = normalizeSocial(value);
  const entries = SOCIAL_NETWORKS.filter((network) => links[network.key]);
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
        {tx(title ?? "Social media pages")}
      </div>
      {entries.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">{tx("No social media pages added yet.")}</p>
      )}
      <div className="flex flex-wrap gap-2 p-3">
        {entries.map((network) => (
          <a
            key={network.key}
            href={socialHref(network.key, links[network.key]!)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold transition hover:border-primary hover:text-primary"
          >
            <network.icon className="h-3.5 w-3.5" />
            {network.label}
          </a>
        ))}
      </div>
    </section>
  );
}
