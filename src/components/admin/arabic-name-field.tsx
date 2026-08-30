import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { Field, inputCls, btnGhost } from "./ui";
import { Check, Loader2 } from "lucide-react";

/**
 * Editable Arabic override for an entity's English name (team, player, competition,
 * coach, venue…). Saved straight into the shared `translations` cache that
 * AutoTranslateProvider already reads from, so no schema change is needed and the
 * override takes effect across the whole site immediately after a language switch.
 */
export function ArabicNameField({ englishName, label = "Arabic name" }: { englishName: string | null | undefined; label?: string }) {
  const qc = useQueryClient();
  const source = (englishName ?? "").trim();
  const q = useQuery({
    queryKey: ["admin", "translation", source],
    enabled: !!source,
    queryFn: async () => {
      const { data } = await supabase
        .from("translations")
        .select("translated_text")
        .eq("locale", "ar")
        .eq("source_text", source)
        .maybeSingle();
      return data?.translated_text ?? "";
    },
  });
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setValue(q.data ?? ""); }, [q.data]);

  if (!source) return null;

  const save = async () => {
    const translated = value.trim();
    setSaving(true);
    setSaved(false);
    try {
      if (translated) {
        await supabase.from("translations").upsert(
          { locale: "ar", source_text: source, translated_text: translated } as never,
          { onConflict: "locale,source_text" },
        );
      } else {
        await supabase.from("translations").delete().eq("locale", "ar").eq("source_text", source);
      }
      await qc.invalidateQueries({ queryKey: ["admin", "translation", source] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          dir="rtl"
          className={inputCls}
          placeholder="الاسم بالعربية"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="button" className={btnGhost} onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : "Save"}
        </button>
      </div>
    </Field>
  );
}
