import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type HeightUnit = "cm" | "ft";

type Ctx = { heightUnit: HeightUnit; setHeightUnit: (u: HeightUnit) => void };

const HeightUnitContext = createContext<Ctx | null>(null);
const KEY = "mas.heightUnit";

/** Viewer's height unit, mirrored to localStorage so every page agrees instantly. */
export function HeightUnitProvider({ children }: { children: ReactNode }) {
  const [heightUnit, setUnit] = useState<HeightUnit>("cm");

  // Read after mount so SSR and the first client render match.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "cm" || stored === "ft") setUnit(stored);
    } catch { /* ignore */ }
  }, []);

  const setHeightUnit = (u: HeightUnit) => {
    setUnit(u);
    try { localStorage.setItem(KEY, u); } catch { /* ignore */ }
  };

  const value = useMemo(() => ({ heightUnit, setHeightUnit }), [heightUnit]);
  return <HeightUnitContext.Provider value={value}>{children}</HeightUnitContext.Provider>;
}

export function useHeightUnit(): Ctx {
  return useContext(HeightUnitContext) ?? { heightUnit: "cm", setHeightUnit: () => {} };
}
