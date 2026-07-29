import logoMark from "@/assets/logo-mark-v2.png.asset.json";

interface BrandLogoProps {
  variant?: "horizontal" | "icon";
  className?: string;
  showWordmark?: boolean;
}

export function BrandLogo({ className, showWordmark = true, variant }: BrandLogoProps) {
  if (variant === "icon" || !showWordmark) {
    return <img src={logoMark.url} alt="MansourAlmailScores" className={className} />;
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <img src={logoMark.url} alt="" className="h-full w-auto object-contain" />
      <span className="text-base font-black tracking-tight">MansourAlmailScores</span>
    </span>
  );
}