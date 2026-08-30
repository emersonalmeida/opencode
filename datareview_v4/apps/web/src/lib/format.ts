/** Helpers de formatação do front (puros — testáveis sem DOM). */

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatScore(n?: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return formatCount(n);
}

export function formatDateTime(epoch: number): string {
  if (!Number.isFinite(epoch) || epoch <= 0) return "—";
  return new Date(epoch).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rótulo legível de status do catálogo (dados de docs/SOURCES.md). */
export function statusLabel(status: string): string {
  switch (status) {
    case "implemented":
      return "PRONTO";
    case "bridge":
      return "PONTE(v1)";
    case "planned":
      return "PLANEJADO";
    default:
      return status.toUpperCase();
  }
}

/** Turno do dia (saudação contextual — mesma lógica da Home do v1). */
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}