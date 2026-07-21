import logoHorizontal from "@/assets/logo-horizontal.asset.json";
import logoIconDark from "@/assets/logo-icon.asset.json";
import logoIconLight from "@/assets/logo-icon-light.asset.json";
import { useTheme } from "./theme-provider";

interface BrandLogoProps {
  variant?: "horizontal" | "icon";
  className?: string;
}

export function BrandLogo({ variant = "horizontal", className }: BrandLogoProps) {
  const { theme } = useTheme();
  if (variant === "icon") {
    const src = theme === "light" ? logoIconLight.url : logoIconDark.url;
    return (
      <img
        src={src}
        alt="MansourAlmailScores"
        className={className}
      />
    );
  }
  return (
    <img
      src={logoHorizontal.url}
      alt="MansourAlmailScores"
      className={className}
    />
  );
}