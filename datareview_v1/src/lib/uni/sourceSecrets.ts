/**
 * Vault local de segredos de fontes customizadas (Onda 4.3): guarda o VALOR
 * da credencial (API key/token) separado da definição da fonte — assim a def
 * pode ser exportada/compartilhada sem vazar o segredo, e o vault NUNCA
 * entra em exportações (marcado sensitive em outputs.ts).
 *
 * Mesmo padrão da apiKey de IA cloud: o valor fica só no navegador do
 * usuário e viaja no body da requisição ao servidor local (que o usa para
 * montar o header/param de autenticação e não o persiste).
 */

export type SourceAuthType = "header" | "query" | "bearer";

export interface SourceAuth {
  /** header = nome do header HTTP; query = nome do parâmetro; bearer = Authorization: Bearer <value>. */
  type: SourceAuthType;
  /** Nome da chave (header/param). Ignorado quando type=bearer. */
  key: string;
}

const KEY = "aso:uni-source-secrets:v1";

type Vault = Record<string, string>; // sourceId -> valor do segredo

function load(): Vault {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Vault) : {};
  } catch {
    return {};
  }
}

let vault: Vault = typeof localStorage !== "undefined" ? load() : {};

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(vault));
  } catch {
    // storage cheio/bloqueado — o segredo fica só em memória nesta sessão
  }
}

/** Lê o segredo de uma fonte (string vazia quando não existe). */
export function getSourceSecret(sourceId: string): string {
  return vault[sourceId] ?? "";
}

/** Define/remove o segredo de uma fonte (valor vazio = remove). */
export function setSourceSecret(sourceId: string, value: string): void {
  const v = value.trim();
  if (v) vault = { ...vault, [sourceId]: v };
  else {
    const { [sourceId]: _drop, ...rest } = vault;
    vault = rest;
  }
  persist();
}

/** Remove o segredo (ex.: fonte excluída). */
export function deleteSourceSecret(sourceId: string): void {
  setSourceSecret(sourceId, "");
}

/** True se a fonte tem segredo guardado. */
export function hasSourceSecret(sourceId: string): boolean {
  return Boolean(vault[sourceId]);
}

/** Monta o objeto de auth enviado ao servidor (segredo nunca persistido lá). */
export function buildAuthPayload(sourceId: string, auth?: SourceAuth): (SourceAuth & { value: string }) | undefined {
  if (!auth) return undefined;
  const value = getSourceSecret(sourceId);
  if (!value) return undefined;
  return { ...auth, value };
}
