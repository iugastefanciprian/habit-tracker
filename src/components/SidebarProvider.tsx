"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const NAV_KEY = "habitTracker.navCollapsed";

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function applyCollapsed(next: boolean) {
  document.documentElement.dataset.navCollapsed = next ? "true" : "false";
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(NAV_KEY) === "1";
    } catch {
      stored = false;
    }
    setCollapsedState(stored);
    applyCollapsed(stored);
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    applyCollapsed(next);
    try {
      localStorage.setItem(NAV_KEY, next ? "1" : "0");
    } catch {
      // Storage can be unavailable; the preference still applies this session.
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used inside a SidebarProvider");
  }
  return context;
}
