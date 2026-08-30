/**
 * Fornece ao painel do assistente de IA dados contextuais sobre o que o usuário
 * está vendo. Páginas chamam `useSetAIContext` para publicar seus dados; o
 * painel lê via `useAIContext`.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

export interface AIContextApp {
  app: AppInfo;
  reviews: ReviewEntry[];
}

export interface AIContextValue {
  scope: "home" | "search" | "app" | "compare";
  title: string; // human label for the current view
  apps: AIContextApp[]; // 0..N apps in scope
  extra?: Record<string, unknown>;
}

const DEFAULT: AIContextValue = { scope: "home", title: "Início", apps: [] };

const Ctx = createContext<{
  value: AIContextValue;
  setValue: (v: AIContextValue) => void;
  panelOpen: boolean;
  setPanelOpen: (o: boolean) => void;
}>({ value: DEFAULT, setValue: () => {}, panelOpen: false, setPanelOpen: () => {} });

export function AIContextProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<AIContextValue>(DEFAULT);
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("aso:ai-panel") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("aso:ai-panel", panelOpen ? "1" : "0"); } catch { /* ignore */ }
  }, [panelOpen]);
  return (
    <Ctx.Provider value={{ value, setValue, panelOpen, setPanelOpen }}>{children}</Ctx.Provider>
  );
}

export function useAIContext() {
  return useContext(Ctx);
}

/** Register the current page context and clear it on unmount. */
export function useSetAIContext(value: AIContextValue, deps: unknown[]) {
  const { setValue } = useContext(Ctx);
  useEffect(() => {
    setValue(value);
    return () => setValue(DEFAULT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
