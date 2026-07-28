import logoHorizontalDark from "@/assets/logo-horizontal-dark.png.asset.json";
import logoHorizontalLight from "@/assets/logo-horizontal-light.png.asset.json";
import logoMark from "@/assets/logo-mark-v2.png.asset.json";
import { useTheme } from "./theme-provider";

interface BrandLogoProps {
  variant?: "horizontal" | "icon";
  className?: string;
}

export function BrandLogo({ variant = "horizontal", className }: BrandLogoProps) {
  const { theme } = useTheme();
  if (variant === "icon") {
    return <img src={logoMark.url} alt="MansourAlmailScores" className={className} />;
  }
  const src = theme === "light" ? logoHorizontalLight.url : logoHorizontalDark.url;
  return <img src={src} alt="MansourAlmailScores" className={className} />;
}