import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { translateContent } from "./translate.functions";
import { useI18n } from "./i18n";

type Tx = <T extends string | null | undefined>(value: T) => T;

const Ctx = createContext<{ tx: Tx }>({ tx: ((v: unknown) => v) as Tx });

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
    setMap({});
  }, [lang]);

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
    if (!/[A-Za-z]/.test(value)) return value;
    request(value);
    return ((map[value.trim()] ?? value) as T);
  }, [lang, map, request]) as Tx;

  return <Ctx.Provider value={{ tx }}>{children}</Ctx.Provider>;
}

/** Translate any admin-authored string into the active language. */
export function useTx(): Tx {
  return useContext(Ctx).tx;
}

/** Backwards-compatible helper: translate a fixed list of strings. */
export function useAutoTranslate(texts: (string | null | undefined)[]): Tx {
  const tx = useTx();
  texts.forEach((item) => { if (item) tx(item); });
  return tx;
}
