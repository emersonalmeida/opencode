/**
 * Git Canvas — abstração de providers (spec §24).
 *
 * O Canvas consome `ProjectMap` normalizado. Providers traduzem o mundo real
 * (GitHub, Git local, agentes, CI, deploy) para esse modelo. Novos providers
 * entram no registry sem reconstruir o Canvas.
 *
 * Regra fundamental: quando um provider NÃO está implementado/conectado, o
 * status diz isso claramente ("Conexão necessária" / "Disponível em breve") —
 * nunca fingimos dados.
 */
import type { ConnectionState, ProjectMap } from "./types";

export type GitProviderKind = "github" | "gitlab" | "bitbucket" | "gitea" | "local";
export type AgentProviderKind = "openhands" | "codex" | "claude-code" | "cursor" | "copilot";
export type CIProviderKind = "github-actions" | "gitlab-ci" | "circleci";
export type DeploymentProviderKind = "vercel" | "netlify" | "cloudflare";

export type ProviderCapability = "functional" | "partial" | "planned";

export interface ProviderMeta {
  kind: string;
  label: string;
  capability: ProviderCapability;
  /** Mensagem honesta quando não está funcional. */
  unavailableMessage?: string;
}

export interface ProviderStatus {
  kind: string;
  state: ConnectionState;
  connected: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// Registries (extensíveis — spec §54)
// ---------------------------------------------------------------------------

export const GIT_PROVIDERS: ProviderMeta[] = [
  { kind: "github", label: "GitHub", capability: "partial" },
  { kind: "gitlab", label: "GitLab", capability: "planned", unavailableMessage: "Disponível em breve" },
  { kind: "bitbucket", label: "Bitbucket", capability: "planned", unavailableMessage: "Disponível em breve" },
  { kind: "gitea", label: "Gitea", capability: "planned", unavailableMessage: "Disponível em breve" },
  { kind: "local", label: "Git local", capability: "partial" },
];

export const AGENT_PROVIDERS: ProviderMeta[] = [
  { kind: "openhands", label: "OpenHands", capability: "partial" },
  { kind: "codex", label: "Codex", capability: "planned", unavailableMessage: "Disponível em breve" },
  { kind: "claude-code", label: "Claude Code", capability: "planned", unavailableMessage: "Disponível em breve" },
  { kind: "cursor", label: "Cursor", capability: "planned", unavailableMessage: "Disponível em breve" },
  { kind: "copilot", label: "GitHub Copilot", capability: "planned", unavailableMessage: "Disponível em breve" },
];

export const CI_PROVIDERS: ProviderMeta[] = [
  { kind: "github-actions", label: "GitHub Actions", capability: "partial" },
  { kind: "gitlab-ci", label: "GitLab CI", capability: "planned", unavailableMessage: "Disponível em breve" },
  { kind: "circleci", label: "CircleCI", capability: "planned", unavailableMessage: "Disponível em breve" },
];

export const DEPLOYMENT_PROVIDERS: ProviderMeta[] = [
  { kind: "vercel", label: "Vercel", capability: "planned", unavailableMessage: "Disponível em breve" },
  { kind: "netlify", label: "Netlify", capability: "planned", unavailableMessage: "Disponível em breve" },
  { kind: "cloudflare", label: "Cloudflare", capability: "planned", unavailableMessage: "Disponível em breve" },
];

// ---------------------------------------------------------------------------
// Contratos de provider
// ---------------------------------------------------------------------------

export interface RepoRef {
  owner: string;
  name: string;
}

/** Provider de Git/GitHub: busca o mapa do projeto normalizado. */
export interface GitProvider {
  meta: ProviderMeta;
  status(): Promise<ProviderStatus>;
  /** Implementado apenas quando o provider é funcional. */
  fetchProjectMap?(repo: RepoRef): Promise<ProjectMap>;
}

/** Provider de agentes de IA (spec §13). */
export interface AgentProvider {
  meta: ProviderMeta;
  status(): Promise<ProviderStatus>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function providerMeta(list: ProviderMeta[], kind: string): ProviderMeta | undefined {
  return list.find((p) => p.kind === kind);
}

/** Status honesto padrão para providers planejados. */
export function plannedStatus(meta: ProviderMeta): ProviderStatus {
  return {
    kind: meta.kind,
    state: "disconnected",
    connected: false,
    message: meta.unavailableMessage ?? "Disponível em breve",
  };
}

/** Repositório padrão do primeiro usuário (spec: o próprio appdatareview). */
export const DEFAULT_REPO: RepoRef = { owner: "emersonalmeida", name: "appdatareview" };
