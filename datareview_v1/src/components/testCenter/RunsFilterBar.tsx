/** Bar de filtros de resultados (status + busca por testId/nome). Acessível
 * e reutilizável na page do test center. */
import { useMemo } from "react";
import { Search } from "lucide-react";
import type { TestResult } from "@/lib/testCenter/types";

interface Props {
  results: TestResult[];
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
}

const ALL_STATUSES: TestResult["status"][] = ["pass", "fail", "warning", "skipped", "not-configured", "error"];
const STATUS_TONE: Partial<Record<TestResult["status"], string>> = {
  pass: "text-green-600",
  fail: "text-red-600",
  warning: "text-amber-600",
  skipped: "text-muted-foreground",
  "not-configured": "text-muted-foreground",
  error: "text-red-600",
  blocked: "text-muted-foreground",
  "not-implemented": "text-muted-foreground",
  timeout: "text-red-600",
};

export function RunsFilterBar({ results, statusFilter, onStatusFilter, query, onQueryChange }: Props) {
  const counts = useMemo(() => {
    const c: Partial<Record<TestResult["status"], number>> = {
      pass: 0, fail: 0, warning: 0, skipped: 0, "not-configured": 0,
      error: 0, blocked: 0, "not-implemented": 0, timeout: 0,
    };
    for (const r of results) if (r.testId) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [results]);

  function match(r: TestResult): boolean {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!query) return true;
    return r.testId.toLowerCase().includes(query.toLowerCase());
  }
  const filtered = results.filter(match);
  return (
    <div className="flex flex-wrap gap-2 items-center" role="search">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar testId..."
          className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-sm"
          aria-label="Buscar testes"
        />
      </div>
      <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Status">
        <button
          role="tab"
          aria-selected={statusFilter === "all"}
          onClick={() => onStatusFilter("all")}
          className={`rounded-md border px-2 py-1 text-xs ${statusFilter === "all" ? "bg-primary text-primary-foreground" : ""}`}
        >
          Todos ({results.length})
        </button>
        {ALL_STATUSES.map((status) => (
          <button
            key={status}
            role="tab"
            aria-selected={statusFilter === status}
            onClick={() => onStatusFilter(status)}
            className={`rounded-md border px-2 py-1 text-xs ${statusFilter === status ? "bg-primary text-primary-foreground" : ""}`}
          >
            {status} <span className={STATUS_TONE[status] ?? ""}>({counts[status] ?? 0})</span>
          </button>
        ))}
      </div>
      <div className="text-xs text-muted-foreground" role="status">
        {filtered.length} resultados
      </div>
    </div>
  );
}
