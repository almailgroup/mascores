import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export function VoiceBadge({ badge }: { badge?: string | null }) {
  const { lang } = useI18n();
  return badge === "golden" || badge === "verified" ? <span role="img" aria-label={badge === "golden" ? (lang === "ar" ? "توثيق ذهبي" : "Golden verified") : (lang === "ar" ? "موثق" : "Verified")} className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full shadow-sm ${badge === "golden" ? "bg-gradient-to-br from-warning via-warning to-warning/70 text-primary-foreground" : "bg-primary text-primary-foreground"}`}><Check className="h-3 w-3" strokeWidth={3} /></span> : null;
}
export function VoiceUserBadge({ userId }: { userId?: string }) {
  const result = useQuery({ queryKey: ["voice-badge", userId], enabled: !!userId, queryFn: async () => { if (!userId) return null; const { data } = await supabase.from("voice_user_badges").select("badge").eq("user_id", userId).maybeSingle(); return data?.badge; } });
  return <VoiceBadge badge={result.data} />;
}

export function VoicePeople({ admin = false }: { admin?: boolean }) {
  const { lang } = useI18n();
  const label = (en: string, ar: string) => lang === "ar" ? ar : en;
  const [active, setActive] = useState(false);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const qc = useQueryClient();
  const boxRef = useRef<HTMLElement>(null);
  // Close only on a tap outside; closing on blur unmounted the list before a profile tap could open it.
  useEffect(() => {
    if (!active || admin) return;
    const outside = (e: PointerEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setActive(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [active, admin]);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem("mas.voice.search") ?? "[]"); if (Array.isArray(saved)) setHistory(saved.filter((v) => typeof v === "string").slice(0, 8)); } catch { /* optional */ } }, []);
  useEffect(() => { const timer = setTimeout(() => setTerm(q.trim()), 250); return () => clearTimeout(timer); }, [q]);
  const people = useQuery({ queryKey: ["voice-people", term, admin], enabled: admin || active, queryFn: async () => { const { data, error } = await supabase.rpc("voice_people", { _q: term, _admin: admin }); if (error) throw error; return data ?? []; } });
  useEffect(() => {
    if (admin || !term || people.isLoading || !people.data?.length) return;
    const timer = setTimeout(() => {
      setHistory((old) => { const next = [term, ...old.filter((v) => v !== term)].slice(0, 8); try { localStorage.setItem("mas.voice.search", JSON.stringify(next)); } catch { /* optional */ } return next; });
    }, 500);
    return () => clearTimeout(timer);
  }, [admin, term, people.isLoading, people.data]);
  const remember = () => { if (!term) return; const next = [term, ...history.filter((v) => v !== term)].slice(0, 8); setHistory(next); try { localStorage.setItem("mas.voice.search", JSON.stringify(next)); } catch { /* optional */ } };
  const setBadge = async (id: string, badge: string) => {
    const result = badge ? await supabase.from("voice_user_badges").upsert({ user_id: id, badge }) : await supabase.from("voice_user_badges").delete().eq("user_id", id);
    if (result.error) { toast.error(label("Could not save verification", "تعذر حفظ التوثيق")); return; }
    await qc.invalidateQueries({ queryKey: ["voice-people"] });
  };
  const rank = (badge: string | null) => badge === "golden" ? 2 : badge === "verified" ? 1 : 0;
  const sorted = [...(people.data ?? [])].sort((a, b) => rank(b.badge) - rank(a.badge) || Number(b.followers) - Number(a.followers));
  const visible = !term && !admin ? sorted.slice(0, 5) : sorted;
  return <section ref={boxRef} onFocus={() => setActive(true)} onClick={() => setActive(true)} className="mb-6 space-y-3">
    <div className="flex items-center gap-2 border-b border-border pb-3"><Search className="h-5 w-5 text-muted-foreground" /><input aria-label={label("Search for people", "ابحث عن أشخاص")} placeholder={label("Search for people", "ابحث عن أشخاص")} value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent text-base outline-none" />{q && <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => setQ("")}><X /></Button>}</div>
    {(active || admin) && <>
    {!q && history.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{label("Recent searches", "عمليات البحث الأخيرة")}</span>{history.map((item) => <Button key={item} variant="ghost" size="sm" onClick={() => setQ(item)}>{item}</Button>)}<Button variant="ghost" size="icon" aria-label="Clear search history" onClick={() => { setHistory([]); localStorage.removeItem("mas.voice.search"); }}><X className="h-4 w-4" /></Button></div>}
    <h2 className="text-sm font-bold">{admin ? label("Voice users", "مستخدمو الغرف الصوتية") : term ? label("People", "الأشخاص") : label("Recommended", "مقترح لك")}</h2>
    {people.isError && <p className="text-sm text-destructive">{label("Could not load people", "تعذر تحميل الأشخاص")}</p>}
    <div className="grid gap-x-6 sm:grid-cols-2">{visible.map((person) => <div key={person.id} className="flex min-w-0 items-center gap-3 border-b border-border py-3">
      <Link to="/u/$username" params={{ username: person.username ?? "" }} onClick={remember} className="flex min-w-0 flex-1 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">{person.avatar_url ? <img src={person.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-full w-full object-cover" /> : (person.display_name ?? person.username ?? "?").slice(0, 1)}</div><div className="min-w-0"><div className="flex items-center gap-1"><span className="truncate text-sm font-semibold">{person.display_name ?? person.username}</span><VoiceBadge badge={person.badge} /></div><p className="truncate text-xs text-muted-foreground">@{person.username} · {Number(person.followers).toLocaleString()} {label("followers", "متابع")}</p></div></Link>
      {admin && <select aria-label={`Verification for ${person.username}`} value={person.badge ?? ""} onChange={(e) => void setBadge(person.id, e.target.value)} className="max-w-32 rounded-md border border-border bg-background p-2 text-base"><option value="">None</option><option value="verified">Verified</option><option value="golden">Golden verified</option></select>}
    </div>)}</div>
    {!people.isLoading && !people.isError && people.data?.length === 0 && <p className="text-sm text-muted-foreground">{label("No people found", "لا توجد نتائج")}</p>}
    </>}
  </section>;
}