/**
 * Global compare/selection state. Any surface (header search, top charts, results grid)
 * can add an app to the compare tray; the tray lives in AppShell so it's available on
 * every route. Reviews are fetched lazily in the background when an app is added.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import { fetchReviews, lookupApp } from "@/lib/appStoreApi";
import { fetchGooglePlayAppDetails, fetchGooglePlayReviews } from "@/lib/googlePlayApi";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { getUserRegion } from "@/lib/region";
import { getDatasetEntry, upsertDataset } from "@/lib/datasetStore";

export interface CompareEntry {
  app: AppInfo;
  reviews: ReviewEntry[];
  loading: boolean;
}

interface CompareCtx {
  entries: CompareEntry[];
  open: boolean;
  setOpen: (o: boolean) => void;
  /** Opens the global app-selection picker (lets the user choose which collected
   *  apps to compare without re-collecting). Works on every page. */
  pickerOpen: boolean;
  setPickerOpen: (o: boolean) => void;
  toggle: (app: AppInfo) => void;
  remove: (appId: string, store: string) => void;
  clear: () => void;
  isSelected: (app: AppInfo) => boolean;
}

const Ctx = createContext<CompareCtx>({
  entries: [], open: false, setOpen: () => {}, pickerOpen: false, setPickerOpen: () => {}, toggle: () => {}, remove: () => {}, clear: () => {}, isSelected: () => false,
});

export function CompareProvider({ children }: { children: ReactNode }) {
  const { settings } = useCollectionSettings();
  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const region = getUserRegion();

  const isSelected = useCallback((app: AppInfo) =>
    entries.some(e => e.app.id === app.id && e.app.store === app.store), [entries]);

  const remove = useCallback((appId: string, store: string) => {
    setEntries(prev => {
      const next = prev.filter(e => !(e.app.id === appId && e.app.store === store));
      if (next.length === 0) setOpen(false);
      return next;
    });
  }, []);

  const toggle = useCallback(async (app: AppInfo) => {
    const already = entries.find(e => e.app.id === app.id && e.app.store === app.store);
    if (already) { remove(app.id, app.store); return; }

    setEntries(prev => [...prev, { app, reviews: [], loading: true }]);

    try {
      let updated = app;
      let revs: ReviewEntry[] = [];
      // Reutiliza o dataset persistido se este app já foi coletado em outro
      // lugar (ex.: Chat / Experimentos) — evita refazer fetch das mesmas reviews.
      const cached = getDatasetEntry(app.store, app.id);
      if (cached) {
        updated = cached.app;
        revs = cached.reviews;
      } else if (app.store === "google") {
        const details = await fetchGooglePlayAppDetails(app.id, region);
        if (details) updated = { ...app, ...details, id: app.id };
        revs = await fetchGooglePlayReviews(app.id, app.name, region, settings.reviewLimit, settings.reviewSort);
        // Persist so other surfaces see it as collected.
        upsertDataset({ app: updated, reviews: revs, collectedAt: Date.now() });
      } else {
        const details = await lookupApp(app.id, region);
        if (details) updated = { ...app, ...details, id: app.id };
        revs = await fetchReviews(app.id, app.name, region, settings.reviewLimit, settings.reviewSort);
        upsertDataset({ app: updated, reviews: revs, collectedAt: Date.now() });
      }
      setEntries(prev => prev.map(e =>
        e.app.id === app.id && e.app.store === app.store ? { app: updated, reviews: revs, loading: false } : e
      ));
    } catch {
      setEntries(prev => prev.map(e =>
        e.app.id === app.id && e.app.store === app.store ? { ...e, loading: false } : e
      ));
    }
  }, [entries, remove, region, settings.reviewLimit, settings.reviewSort]);

  const clear = useCallback(() => { setEntries([]); setOpen(false); }, []);

  return (
    <Ctx.Provider value={{ entries, open, setOpen, pickerOpen, setPickerOpen, toggle, remove, clear, isSelected }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCompare() { return useContext(Ctx); }
