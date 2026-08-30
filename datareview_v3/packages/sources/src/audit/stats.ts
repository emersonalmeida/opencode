import type { AuditEntry } from "./types";

export interface AuditStats {
  sources: number;
  audited: number;
  inProgress: number;
  pending: number;
  implemented: number;
}

export function sourceStats(sources: readonly AuditEntry[]): AuditStats {
  let audited =0;
  let inProgress =0;
  let pending =0;
  let implemented =0;
  for (const src of sources) {
    if (src.status === "audited") audited +=1;
    else if (src.status === "in-progress") inProgress +=1;
    else pending +=1;
    if (src.implemented) implemented +=1;
  }
  return { sources: sources.length, audited, inProgress, pending, implemented };
}

export function categoryCounts(sources: readonly AuditEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sources) {
    m.set(s.category,(m.get(s.category) ?? 0) + 1);
  }
  return m;
}
