import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { translateContent } from "./translate.functions";
import { useI18n } from "./i18n";

/**
 * Machine-translates admin-authored content (news, competitions, clubs) into the
 * active language. English is passed through untouched; Arabic results are cached
 * server-side so repeat visits are instant.
 */
export function useAutoTranslate(texts: (string | null | undefined)[]) {
  const { lang } = useI18n();
  const translate = useServerFn(translateContent);
  const list = texts.filter((t): t is string => !!t && t.trim().length > 0);
  const key = list.join("\u0001");

  const q = useQuery({
    queryKey: ["auto-translate", lang, key],
    enabled: lang === "ar" && list.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => translate({ data: { texts: list, locale: "ar" } }),
  });

  const map = q.data ?? {};
  return function tx<T extends string | null | undefined>(value: T): T {
    if (lang === "en" || !value) return value;
    return ((map as Record<string, string>)[value.trim()] ?? value) as T;
  };
}
