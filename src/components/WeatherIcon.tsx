import React from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudDrizzle,
  CloudSnow,
  CloudFog,
  Snowflake,
  Wind,
  Moon,
  CloudMoon,
} from "lucide-react";

interface WeatherIconProps {
  icon: string;
  isDay?: boolean;
  className?: string;
  size?: number;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({
  icon,
  isDay = true,
  className = "w-6 h-6",
  size,
}) => {
  const iconProps = { className, size };

  switch (icon) {
    case "sun":
      return isDay ? (
        <Sun {...iconProps} className={`${className} text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-spin-slow`} />
      ) : (
        <Moon {...iconProps} className={`${className} text-indigo-300 drop-shadow-[0_0_8px_rgba(165,180,252,0.4)]`} />
      );
    case "cloud-sun":
      return isDay ? (
        <CloudSun {...iconProps} className={`${className} text-amber-300`} />
      ) : (
        <CloudMoon {...iconProps} className={`${className} text-indigo-200`} />
      );
    case "cloud":
      return <Cloud {...iconProps} className={`${className} text-slate-300`} />;
    case "cloud-rain":
      return <CloudRain {...iconProps} className={`${className} text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.4)]`} />;
    case "cloud-drizzle":
      return <CloudDrizzle {...iconProps} className={`${className} text-cyan-300`} />;
    case "cloud-lightning":
      return <CloudLightning {...iconProps} className={`${className} text-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.6)] animate-pulse`} />;
    case "cloud-snow":
    case "snowflake":
      return <Snowflake {...iconProps} className={`${className} text-blue-200 drop-shadow-[0_0_6px_rgba(191,219,254,0.5)]`} />;
    case "cloud-fog":
      return <CloudFog {...iconProps} className={`${className} text-slate-400`} />;
    case "wind":
      return <Wind {...iconProps} className={`${className} text-teal-300`} />;
    default:
      return <Sun {...iconProps} className={`${className} text-amber-400`} />;
  }
};
