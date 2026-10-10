import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, ArrowRight, ArrowLeft, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFavorites } from "@/hooks/use-favorites";
import { useI18n, type Lang } from "@/lib/i18n";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useTx } from "@/lib/auto-translate";

const COMPLETED = "mas.setup.completed";

/** Device-local welcome; completing it never depends on creating an account. */
export function FirstRunSetup({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<"checking" | "teams" | "language" | "done">("checking");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { lang, setLang } = useI18n();
  const tx = useTx();
  const { addTeams } = useFavorites();
  useEffect(() => {
    try {
      // Existing installations with a saved language should not receive a new welcome.
      if (localStorage.getItem(COMPLETED) || localStorage.getItem("mas.lang")) {
        localStorage.setItem(COMPLETED, "1");
        setStage("done");
      } else setStage("teams");
    } catch { setStage("teams"); }
  }, []);
  const teams = useQuery({
    queryKey: ["welcome-teams"], enabled: stage === "teams",
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id,name,logo_url,country").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const finish = async (language: Lang) => {
    setSaving(true);
    await addTeams(selected);
    setLang(language);
    try { localStorage.setItem(COMPLETED, "1"); } catch { /* storage may be unavailable */ }
    setStage("done");
    setSaving(false);
  };
  // Do not render welcome branding or step numbers before device storage is checked.
  if (stage === "done" || stage === "checking") return children;
  const ar = lang === "ar";
  const visible = (teams.data ?? []).filter((team) => `${team.name} ${tx(team.name)} ${team.country ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div hidden inert>{children}</div>
    <div data-no-gesture className="fixed inset-0 z-[110] overflow-y-auto bg-background text-foreground" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between"><BrandLogo showWordmark={false} className="h-12 w-12 object-contain" /><span className="text-xs font-semibold text-muted-foreground" dir="ltr">{stage === "language" ? "2 / 2" : "1 / 2"}</span></div>
        {stage === "teams" ? <>
          <h1 id="welcome-title" className="mt-8 text-3xl font-bold">{ar ? "اختر فرقك" : "Choose your teams"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">اختر فرقك المفضلة · Choose your favourites</p>
          <label className="mt-6 flex h-12 items-center gap-3 rounded-lg border border-border bg-card px-4"><Search className="h-5 w-5 text-muted-foreground" /><input aria-label="Search teams" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teams / ابحث عن فريق" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <div className="mt-4 grid flex-1 content-start grid-cols-2 gap-2 pb-6">
            {teams.isPending ? <Loader2 className="col-span-2 mx-auto my-8 h-6 w-6 animate-spin text-primary" /> : teams.isError ? <div className="col-span-2 py-6 text-center"><Button variant="outline" onClick={() => void teams.refetch()}>Try again / حاول مجدداً</Button></div> : visible.length === 0 ? <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">No teams / لا توجد فرق</p> : visible.map((team) => {
              const active = selected.includes(team.id);
              return <Button key={team.id} variant="outline" aria-pressed={active} onClick={() => setSelected((prev) => active ? prev.filter((id) => id !== team.id) : [...prev, team.id])} className={`h-auto min-h-24 flex-col gap-2 whitespace-normal px-3 py-4 text-center ${active ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}>
                <span className="relative">{team.logo_url ? <img src={team.logo_url} alt="" className="h-10 w-10 object-contain" /> : <Shield className="h-10 w-10 text-muted-foreground" />}{active && <span className="absolute -end-3 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}</span>
                <span className="text-xs leading-4">{tx(team.name)}</span>
              </Button>;
            })}
          </div>
          <div className="sticky bottom-0 -mx-5 flex gap-3 border-t border-border bg-background px-5 py-4">
            <Button variant="ghost" onClick={() => { setSelected([]); setStage("language"); }}>Skip / تخطي</Button>
            <Button className="h-11 flex-1" onClick={() => setStage("language")}>Continue / متابعة{selected.length > 0 && <span>({selected.length})</span>}<ArrowRight className="h-4 w-4" /></Button>
          </div>
        </> : <>
          <div className="my-auto py-12 text-center">
            <h1 id="welcome-title" className="text-3xl font-bold" dir="rtl">اختر لغتك</h1>
            <p className="mt-3 text-xl font-semibold">Choose your language</p>
            <div className="mt-10 grid grid-cols-2 gap-3" dir="ltr">
              <Button variant="outline" disabled={saving} className="h-28 border-primary/30 bg-card text-xl font-bold" onClick={() => void finish("ar")}>العربية</Button>
              <Button variant="outline" disabled={saving} className="h-28 border-primary/30 bg-card text-xl font-bold" onClick={() => void finish("en")}>English</Button>
            </div>
          </div>
          <Button variant="ghost" className="self-start" disabled={saving} onClick={() => setStage("teams")}><ArrowLeft className="h-4 w-4" />Back / رجوع</Button>
        </>}
      </div>
    </div>
  </>;
}