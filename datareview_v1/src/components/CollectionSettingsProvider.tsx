import { createContext, useContext, useState, type ReactNode } from "react";

export type ReviewSort = "recent" | "helpful" | "rating" | "mixed";

export interface CollectionSettings {
  searchLimit: number;
  reviewLimit: number;
  /** Ordering preference for collected reviews. */
  reviewSort: ReviewSort;
}

const DEFAULTS: CollectionSettings = { searchLimit: 10, reviewLimit: 500, reviewSort: "mixed" };

const SEARCH_OPTIONS = [5, 10, 15, 20, 30];
const REVIEW_OPTIONS = [50, 100, 250, 500, 1000, 3000, 5000];

export const REVIEW_SORT_OPTIONS: { value: ReviewSort; label: string; hint: string }[] = [
  { value: "mixed", label: "Misto", hint: "Coleta de todas as ordenações (máx. variedade/quantidade)" },
  { value: "recent", label: "Recentes", hint: "Mais novas primeiro (Google: NEWEST; Apple: amp-api)" },
  { value: "helpful", label: "Úteis", hint: "Mais curtidas úteis primeiro (Google: HELPFUL; Apple: SSR)" },
  { value: "rating", label: "Por nota", hint: "Por nota (Google: RATING)" },
];

interface SettingsContextType {
  settings: CollectionSettings;
  setSettings: (s: CollectionSettings) => void;
  searchOptions: number[];
  reviewOptions: number[];
  reviewSortOptions: typeof REVIEW_SORT_OPTIONS;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULTS,
  setSettings: () => {},
  searchOptions: SEARCH_OPTIONS,
  reviewOptions: REVIEW_OPTIONS,
  reviewSortOptions: REVIEW_SORT_OPTIONS,
});

export const useCollectionSettings = () => useContext(SettingsContext);

export function CollectionSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<CollectionSettings>(() => {
    try {
      const stored = localStorage.getItem("collection-settings");
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  const setSettings = (s: CollectionSettings) => {
    setSettingsState(s);
    localStorage.setItem("collection-settings", JSON.stringify(s));
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings, searchOptions: SEARCH_OPTIONS, reviewOptions: REVIEW_OPTIONS, reviewSortOptions: REVIEW_SORT_OPTIONS }}>
      {children}
    </SettingsContext.Provider>
  );
}
