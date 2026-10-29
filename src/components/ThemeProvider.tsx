"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const THEME_KEY = "theme";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveIsDark(mode: ThemeMode) {
  return mode === "system" ? systemPrefersDark() : mode === "dark";
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The inline script in layout.tsx already applied the stored theme before
  // paint; this state only needs to catch up so the UI reflects it.
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [isDark, setIsDark] = useState(false);

  const applyMode = useCallback((next: ThemeMode) => {
    const dark = resolveIsDark(next);
    document.documentElement.classList.toggle("dark", dark);
    setIsDark(dark);
  }, []);

  useEffect(() => {
    const stored = readStoredMode();
    setModeState(stored);
    applyMode(stored);
  }, [applyMode]);

  // Follow the OS preference live while "system" is selected.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "system") applyMode("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode, applyMode]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      applyMode(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Storage can be unavailable (private mode, blocked cookies); the
        // theme still applies for this session.
      }
    },
    [applyMode]
  );

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return context;
}
