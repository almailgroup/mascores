/** Count goals across both teams, with separate counters for other event types. */
export function matchEventOrder(events: readonly { id: string; type: string }[]) {
  const order = new Map<string, number>();
  const counts: Record<string, number> = {};
  for (const event of events) {
    const kind = ["goal", "penalty_goal", "penalty", "own_goal"].includes(event.type) ? "goal" : event.type;
    counts[kind] = (counts[kind] ?? 0) + 1;
    order.set(event.id, counts[kind]);
  }
  return order;
}

/** Result exports receive the same event order as the public timeline. */
export function resultScorers<T extends { name: string; minute: string; type: string; order: number }>(items: readonly T[], ordered: boolean, arabic: boolean) {
  return items.map(item => {
    if (!ordered) return { name: item.name, minute: item.minute };
    const n = item.order;
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
    const goal = ["goal", "penalty_goal", "penalty", "own_goal"].includes(item.type);
    const label = arabic
      ? `${goal ? "الهدف" : "البطاقة الحمراء"} ${n.toLocaleString("ar")}`
      : `${n}${suffix} ${goal ? "goal" : "red card"}`;
    const marker = item.type === "own_goal" ? (arabic ? " (عكسي)" : " (OG)") : ["penalty", "penalty_goal"].includes(item.type) ? (arabic ? " (جزاء)" : " (P)") : "";
    return { name: item.name, minute: `${label}${marker}` };
  });
}