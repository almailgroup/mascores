import logoLight from "@/assets/logo-mark-v2.png.asset.json";
import logoDark from "@/assets/logo-mark-dark.png";

interface BrandLogoProps {
  variant?: "horizontal" | "icon";
  className?: string;
  showWordmark?: boolean;
}

/** Two artwork variants keep the blue mark blue: navy on light, white on dark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <>
      <img src={logoLight.url} alt="MansourAlmailScores" className={`${className ?? ""} dark:hidden`} />
      <img src={logoDark} alt="MansourAlmailScores" className={`hidden ${className ?? ""} dark:block`} />
    </>
  );
}

export function BrandLogo({ className, showWordmark = true, variant }: BrandLogoProps) {
  if (variant === "icon" || !showWordmark) {
    return <LogoMark className={className} />;
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className="h-full w-auto object-contain" />
      <span className="text-base font-black tracking-tight">MansourAlmailScores</span>
    </span>
  );
}
