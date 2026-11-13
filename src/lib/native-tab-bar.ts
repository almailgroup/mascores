import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type Item = { title: string; icon: string };
interface NativeTabBarPlugin {
  show(opts: { items: Item[]; selected: number; dark: boolean; rtl: boolean }): Promise<void>;
  hide(): Promise<void>;
  addListener(event: "select", cb: (e: { index: number; reselect: boolean }) => void): Promise<PluginListenerHandle>;
}

const NativeTabBar = registerPlugin<NativeTabBarPlugin>("NativeTabBar");

/** True only inside an iPhone build that ships the real system tab bar. */
export function hasNativeTabBar(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("NativeTabBar");
  } catch {
    return false;
  }
}

/** Drives Apple's own tab bar: shown on primary pages, hidden elsewhere. */
export function useNativeTabBar(opts: { enabled: boolean; visible: boolean; items: Item[]; selected: number; rtl: boolean; onSelect: (index: number, reselect: boolean) => void }) {
  const [available, setAvailable] = useState(false);
  const onSelect = useRef(opts.onSelect);
  onSelect.current = opts.onSelect;
  useEffect(() => { setAvailable(opts.enabled && hasNativeTabBar()); }, [opts.enabled]);

  useEffect(() => {
    if (!available) return;
    let handle: PluginListenerHandle | undefined;
    void NativeTabBar.addListener("select", (e) => onSelect.current(e.index, e.reselect)).then((h) => { handle = h; });
    return () => { void handle?.remove(); void NativeTabBar.hide().catch(() => {}); };
  }, [available]);

  const key = JSON.stringify(opts.items);
  useEffect(() => {
    if (!available) return;
    if (opts.visible) {
      const dark = document.documentElement.classList.contains("dark");
      void NativeTabBar.show({ items: opts.items, selected: opts.selected, dark, rtl: opts.rtl }).catch(() => {});
    } else void NativeTabBar.hide().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, opts.visible, opts.selected, opts.rtl, key]);

  return available;
}
