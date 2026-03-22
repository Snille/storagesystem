"use client";

import { useEffect } from "react";
import type { AppearanceSettings } from "@/lib/types";

type ThemeControllerProps = {
  appearance: AppearanceSettings;
};

export function ThemeController({ appearance }: ThemeControllerProps) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const resolvedTheme = appearance.theme === "auto" ? (media.matches ? "dark" : "light") : appearance.theme;
      root.dataset.themeMode = appearance.theme;
      root.dataset.themeResolved = resolvedTheme;
      root.dataset.fontFamily = appearance.fontFamily;
      root.dataset.reduceMotion = appearance.reduceMotion ? "true" : "false";
      root.style.setProperty("--font-base-size", `${appearance.fontSizePt}pt`);
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance.theme, appearance.fontFamily, appearance.fontSizePt, appearance.reduceMotion]);

  return null;
}
