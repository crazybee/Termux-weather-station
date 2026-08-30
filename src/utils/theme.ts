export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "termux_wx_theme";

/**
 * Returns the stored theme preference or 'system' by default.
 */
export function getStoredTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch (e) {
    console.warn("Failed to read theme from localStorage", e);
  }
  return "system";
}

/**
 * Determines whether the dark class should be active based on theme setting and OS preference.
 */
export function resolveIsDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

/**
 * Applies the selected theme to the document and updates CSS variables & localStorage.
 */
export function applyTheme(theme: ThemeMode): boolean {
  const isDark = resolveIsDark(theme);
  const root = document.documentElement;

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Update root CSS custom properties explicitly if desired
  root.style.setProperty("--current-theme", isDark ? "dark" : "light");

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    // Also notify server config endpoint if available
    fetch("/api/station/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    }).catch(() => {});
  } catch (e) {
    console.warn("Failed to save theme to localStorage", e);
  }

  return isDark;
}
