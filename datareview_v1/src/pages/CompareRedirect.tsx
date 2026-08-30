/**
 * Legacy /compare route — unified into AppDetail. This component loads the
 * requested apps into the global CompareContext and redirects to the first
 * app's detail page, where the side-by-side comparison view renders inline.
 */
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLoader } from "@/components/shared/PageLoader";
import { useCompare } from "@/context/CompareContext";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { getUserRegion } from "@/lib/region";
import { collectCompareGroup } from "@/lib/collect";
import type { AppInfo } from "@/lib/appStoreApi";

function parseAppsParam(value: string | null): { store: "apple" | "google"; id: string }[] {
  if (!value) return [];
  return value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(token => {
      const [store, ...rest] = token.split(":");
      const id = rest.join(":");
      if ((store === "apple" || store === "google") && id) return { store, id };
      return null;
    })
    .filter((v): v is { store: "apple" | "google"; id: string } => !!v);
}

export default function CompareRedirect() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { entries, toggle } = useCompare();
  const { settings } = useCollectionSettings();
  const region = getUserRegion();

  useEffect(() => {
    const tokens = parseAppsParam(params.get("apps"));
    if (tokens.length === 0) { navigate("/", { replace: true }); return; }

    // Hydrate any missing tokens into the compare tray via toggle (fetches details itself).
    const existing = new Set(entries.map(e => `${e.app.store}:${e.app.id}`));
    const shells: AppInfo[] = [];
    for (const t of tokens) {
      const key = `${t.store}:${t.id}`;
      const shell: AppInfo = {
        id: t.id, store: t.store, name: `${t.store}:${t.id}`, icon: "",
        developer: "", rating: 0, ratingCount: 0, price: "", url: "",
        genre: "", version: "", size: "", contentRating: "", description: "", screenshots: [],
      } as unknown as AppInfo;
      shells.push(shell);
      if (existing.has(key)) continue;
      toggle(shell);
    }
    // Persiste o grupo no dataset + sidebar de histórico (fire-and-forget).
    void collectCompareGroup(shells, region, settings.reviewLimit, settings.reviewSort);

    const first = tokens[0];
    navigate(`/app/${first.store}/${first.id}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <PageLoader label="Preparando comparação…" />
    </div>
  );
}
