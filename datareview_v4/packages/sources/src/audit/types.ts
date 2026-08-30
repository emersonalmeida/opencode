import type { SourceCapability } from "@v4/contracts";

export type AuditStatus = "audited" | "in-progress" | "pending";

export interface AuditEntry {
  id: string;
  order: number;
  name: string;
  category: string;
  status: AuditStatus;
  implemented: boolean;
  sourceId: string;
  summary: string;
  capabilities: SourceCapability[];
}
