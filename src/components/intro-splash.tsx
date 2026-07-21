import { useEffect, useState } from "react";
import logoIconDark from "@/assets/logo-icon.asset.json";

const SESSION_KEY = "mas-intro-shown";

export function IntroSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(true);
    const fadeTimer = setTimeout(() => setFading(true), 1600);
    const hideTimer = setTimeout(() => setVisible(false), 2200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#050b1a] transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_50%_40%,rgba(37,99,235,0.35),transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-6">
        <div className="animate-mas-logo-in">
          <img
            src={logoIconDark.url}
            alt="MansourAlmailScores"
            className="h-32 w-32 drop-shadow-[0_0_40px_rgba(37,99,235,0.6)]"
          />
        </div>
        <div className="animate-mas-text-in text-center">
          <div className="text-2xl font-bold tracking-tight text-white">
            MansourAlmail<span className="text-[#2563eb]">Scores</span>
          </div>
          <div className="mt-2 text-[0.65rem] font-medium uppercase tracking-[0.35em] text-slate-400">
            Live Scores. Real Passion.
          </div>
        </div>
      </div>
    </div>
  );
}