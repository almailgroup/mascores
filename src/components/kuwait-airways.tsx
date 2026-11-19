import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { canViewKuwaitAirways } from "@/lib/kuwait-airways-visibility";
import mark from "@/assets/kuwait-airways-mark.jpeg.asset.json";
import flight from "@/assets/kuwait-airways-flight.jpeg.asset.json";

export function KuwaitAirways() {
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  const access = useQuery({
    queryKey: ["kuwait-airways-access", user?.id],
    enabled: !loading && !!user,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || data.user.id !== user?.id) return false;
      const role = await supabase.rpc("is_main_admin", { _uid: data.user.id });
      return !role.error && canViewKuwaitAirways(data.user, role.data === true);
    },
  });
  if (loading || !user || access.data !== true) return null;

  return (
    <aside className="kuwait-airways" aria-label={lang === "ar" ? "إعلان الخطوط الجوية الكويتية" : "Kuwait Airways advertisement"}>
      <div className="kuwait-airways-window">
        <img src={flight.url} alt={lang === "ar" ? "طائرة الخطوط الجوية الكويتية فوق السحاب" : "Kuwait Airways aircraft above the clouds"} className="kuwait-airways-flight" />
      </div>
      <div className="kuwait-airways-identity">
        <img src={mark.url} alt={lang === "ar" ? "الخطوط الجوية الكويتية" : "Kuwait Airways"} className="kuwait-airways-mark" />
        <span className="kuwait-airways-label">{lang === "ar" ? "الراعي الرسمي" : "Official sponsor"}</span>
      </div>
      <div className="kuwait-airways-intro" aria-hidden="true">
        <img src={mark.url} alt="" />
        <span className="kuwait-airways-label">{lang === "ar" ? "الراعي الرسمي" : "Official sponsor"}</span>
      </div>
      <div className="kuwait-airways-progress" aria-hidden="true" />
    </aside>
  );
}