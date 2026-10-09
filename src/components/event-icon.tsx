import goal from "@/assets/events/goal.png.asset.json";
import penaltyGoal from "@/assets/events/penalty-goal.png.asset.json";
import penaltyMiss from "@/assets/events/penalty-miss.png.asset.json";
import yellowCard from "@/assets/events/yellow-card.png.asset.json";
import redCard from "@/assets/events/red-card.png.asset.json";
import substitution from "@/assets/events/substitution.png.asset.json";
import injurySub from "@/assets/events/injury-substitution.png.asset.json";
import ownGoal from "@/assets/events/own-goal.png.asset.json";
import varArt from "@/assets/events/var.png.asset.json";
import noteArt from "@/assets/events/note.png.asset.json";
import { eventLabel } from "@/lib/db";

const ART: Record<string, string> = {
  goal: goal.url, penalty_goal: penaltyGoal.url, penalty: penaltyGoal.url,
  penalty_miss: penaltyMiss.url, missed_penalty: penaltyMiss.url, own_goal: ownGoal.url,
  yellow: yellowCard.url, red: redCard.url, substitution: substitution.url, sub: substitution.url,
  injury_sub: injurySub.url, injury_substitution: injurySub.url,
  var: varArt.url, VAR: varArt.url, note: noteArt.url, notes: noteArt.url,
};
export function hasEventArt(type: string) { return type === "second_yellow" || type in ART; }

/** Original artwork, with only its ink contrast adapted to the surrounding theme. */
export function EventIcon({ type, className = "h-5 w-5" }: { type: string; className?: string }) {
  const label = eventLabel(type);
  if (type === "second_yellow") return <span role="img" aria-label={label} title={label} className={`inline-flex shrink-0 items-center justify-center ${className}`}><img src={yellowCard.url} alt="" className="h-full w-1/2 object-contain" /><img src={redCard.url} alt="" className="h-full w-1/2 object-contain" /></span>;
  const src = ART[type];
  if (!src) return <span className={`inline-flex shrink-0 items-center justify-center text-xs text-muted-foreground ${className}`} title={label}>•</span>;
  const contrast = ["yellow", "red", "substitution", "sub"].includes(type) ? "" : "event-art-ink";
  return <span role="img" aria-label={label} title={label} className={`inline-flex shrink-0 items-center justify-center ${className}`}><img src={src} alt="" className={`h-full w-full object-contain ${contrast}`} /></span>;
}