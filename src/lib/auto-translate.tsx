import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { translateContent } from "./translate.functions";
import { useI18n } from "./i18n";

type Tx = <T extends string | null | undefined>(value: T) => T;

const Ctx = createContext<{ tx: Tx; num: (v: number | string | null | undefined) => string }>({
  tx: ((v: unknown) => v) as Tx,
  num: (v) => (v == null ? "" : String(v)),
});

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Arabic mode shows Arabic-Indic numerals everywhere, including inside translated text. */
export function toArabicDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]!);
}

/**
 * Site-wide machine translation for admin-authored content (club names, competitions,
 * players, venues, news…). Every component that renders dynamic text asks for it through
 * `useTx()`; requests are batched, translated once, then cached server-side.
 */
export function AutoTranslateProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const translate = useServerFn(translateContent);
  const [map, setMap] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  const queue = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    asked.current = new Set();
    queue.current = new Set();
    if (lang === "ar") {
      try { setMap(JSON.parse(localStorage.getItem("mas.translations.ar") ?? "{}") as Record<string, string>); }
      catch { setMap({}); }
    } else setMap({});
  }, [lang]);

  useEffect(() => {
    if (lang !== "ar" || Object.keys(map).length === 0) return;
    try { localStorage.setItem("mas.translations.ar", JSON.stringify(map)); } catch { /* cache is optional */ }
  }, [lang, map]);

  const flush = useCallback(async () => {
    timer.current = null;
    const batch = [...queue.current].slice(0, 40);
    if (batch.length === 0) return;
    batch.forEach((item) => queue.current.delete(item));
    try {
      const result = await translate({ data: { texts: batch, locale: "ar" } });
      if (result && Object.keys(result).length > 0) setMap((prev) => ({ ...prev, ...result }));
    } catch {
      batch.forEach((item) => asked.current.delete(item));
    }
    if (queue.current.size > 0 && !timer.current) timer.current = setTimeout(() => { void flush(); }, 80);
  }, [translate]);

  const request = useCallback((value: string) => {
    if (lang !== "ar") return;
    const key = value.trim();
    if (!key || key.length > 6000 || asked.current.has(key)) return;
    asked.current.add(key);
    queue.current.add(key);
    if (!timer.current) timer.current = setTimeout(() => { void flush(); }, 120);
  }, [flush, lang]);

  const tx = useCallback(<T extends string | null | undefined>(value: T): T => {
    if (lang === "en" || !value || typeof value !== "string") return value;
    if (!/[A-Za-z]/.test(value)) return toArabicDigits(value) as T;
    request(value);
    return toArabicDigits(map[value.trim()] ?? value) as T;
  }, [lang, map, request]) as Tx;

  const num = useCallback(
    (value: number | string | null | undefined) => {
      if (value == null) return "";
      const raw = String(value);
      return lang === "ar" ? toArabicDigits(raw) : raw;
    },
    [lang],
  );

  return <Ctx.Provider value={{ tx, num }}>{children}</Ctx.Provider>;
}

/** Translate any admin-authored string into the active language. */
export function useTx(): Tx {
  return useContext(Ctx).tx;
}

/** Localize any number (scores, minutes, percentages) for the active language. */
export function useNum() {
  return useContext(Ctx).num;
}

/** Backwards-compatible helper: translate a fixed list of strings. */
export function useAutoTranslate(texts: (string | null | undefined)[]): Tx {
  const tx = useTx();
  texts.forEach((item) => { if (item) tx(item); });
  return tx;
}
