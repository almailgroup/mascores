import { SOCIAL_NETWORKS, normalizeSocial, type SocialMap } from "@/components/social-links";
import { inputCls } from "./ui";

/** Admin editor for the social_links JSON column: a handle or full link per network. */
export function SocialLinksField({ value, onChange }: { value: unknown; onChange: (next: SocialMap) => void }) {
  const links = normalizeSocial(value);
  const set = (key: string, next: string) => {
    const merged: SocialMap = { ...links };
    if (next.trim()) merged[key] = next.trim();
    else delete merged[key];
    onChange(merged);
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {SOCIAL_NETWORKS.map((network) => (
        <label key={network.key} className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
            <network.icon className="h-4 w-4" />
          </span>
          <input
            className={inputCls}
            placeholder={`${network.label} — @handle or link`}
            value={links[network.key] ?? ""}
            onChange={(e) => set(network.key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
