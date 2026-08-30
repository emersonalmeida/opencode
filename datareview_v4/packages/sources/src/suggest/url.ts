const DEFAULT_SUGGEST_URL = "http://localhost:8787";

export function apiSuggestUrl(path: string): string {
  const base = (globalThis as { VITE_SUGGEST_URL?: string }).VITE_SUGGEST_URL ?? DEFAULT_SUGGEST_URL;
  return `${base}${path}`;
}