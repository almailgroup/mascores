import { BrandLogo } from "@/components/brand-logo";

export function BrandLoading() {
  return <div data-no-gesture className="fixed inset-0 z-[120] grid place-items-center bg-background text-foreground" role="status" aria-label="Loading / جارٍ التحميل">
    <div className="flex flex-col items-center gap-6">
      <div className="brand-loading-mark"><BrandLogo showWordmark={false} className="h-20 w-20 object-contain" /></div>
      <div className="brand-loading-track"><span /></div>
    </div>
  </div>;
}