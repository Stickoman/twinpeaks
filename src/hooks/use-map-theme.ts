"use client";

import { useTheme } from "next-themes";
import { ColorScheme } from "@vis.gl/react-google-maps";
import { MAP_STYLES_DARK, MAP_STYLES_LIGHT } from "@/lib/utils/map-styles";

const MAP_ID = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "").trim() || undefined;

export function useMapTheme() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return {
    mapId: MAP_ID,
    // Inline styles only work on raster maps (no mapId). Vector maps use colorScheme instead.
    styles: MAP_ID ? undefined : isDark ? MAP_STYLES_DARK : MAP_STYLES_LIGHT,
    colorScheme: isDark ? ColorScheme.DARK : ColorScheme.LIGHT,
    isDark,
  };
}
