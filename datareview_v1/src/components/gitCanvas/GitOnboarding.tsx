/**
 * GitOnboarding — primeira experiência (spec §36).
 *
 * Três entradas honestas: conectar GitHub (tenta o servidor local; falha vira
 * "Conexão necessária" com o que fazer), repositório local (arquitetura
 * preparada — spec §12: um app web NÃO acessa o filesystem arbitrariamente)
 * e o modo demo determinístico (§37).
 */
import { useState } from "react";
import { Cloud, Laptop, Sparkles, Loader2, TriangleAlert, Upload, RefreshCw } from "lucide-react";
import { checkGitHubStatus } from "@/lib/gitCanvas/githubClient";
import type { ProviderStatus } from "@/lib/gitCanvas/providers";
import { GitUploadZone } from "./GitUploadZone";
import type { GitUploadResult } from "@/lib/gitCanvas/gitUpload";

export interface GitOnboardingProps {
  onDemo(): void;
  /** Chamado quando o GitHub responde conectado; retornar false = mapa não carregou (honesto). */
  onGitHubConnected?(status: ProviderStatus): void | boolean | Promise<void | boolean>;
  /** Chamado quando o usuário envia arquivos git com sucesso. */
  onUpload?(result: GitUploadResult): void;
}

export function GitOnboarding({ onDemo, onGitHubConnected, onUpload }: GitOnboardingProps) {
  const [checking, setChecking] = useState(false);
  const [ghStatus, setGhStatus] = useState<ProviderStatus | null>(null);
  const [showLocal, setShowLocal] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localSnapshotLoading, setLocalSnapshotLoading] = useState(false);
  const [localSnapshotError, setLocalSnapshotError] = useState<string | null>(null);

  async function connectGitHub() {
    setChecking(true);
    const status = await checkGitHubStatus();
    setGhStatus(status);
    if (status.connected) {
      const ok = await onGitHubConnected?.(status);
      if (ok === false) {
        setGhStatus({
          ...status,
          connected: false,
          message: "Conexão OK, mas o mapa do projeto não carregou. Verifique o repositório (GITHUB_REPO) e as permissões do token.",
        });
      }
    }
    setChecking(false);
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-lg" role="dialog" aria-label="Bem-vindo ao Project Canvas">
        <h1 className="text-lg font-semibold">Bem-vindo ao Project Canvas.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Um sistema operacional visual para desenvolvimento baseado em Git.
          Conecte um repositório para construir o mapa vivo do projeto.
        </p>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={connectGitHub}
            disabled={checking}
            className="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Cloud className="h-4 w-4 shrink-0 text-sky-500" />
            <span className="flex-1">
              <span className="block text-sm font-medium">Conectar GitHub</span>
              <span className="block text-xs text-muted-foreground">via servidor local (token nunca sai da sua máquina)</span>
            </span>
            {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </button>

          {ghStatus && !ghStatus.connected && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3" role="alert">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="text-xs">
                  <p className="font-medium text-amber-600 dark:text-amber-400">Conexão necessária</p>
                  <p className="mt-0.5 text-muted-foreground">{ghStatus.message}</p>
                  <p className="mt-1.5 text-muted-foreground">
                    O que fazer: rode <code className="rounded bg-muted px-1 font-mono">npm run dev:server</code> e defina{" "}
                    <code className="rounded bg-muted px-1 font-mono">GITHUB_TOKEN</code> no <code className="rounded bg-muted px-1 font-mono">.env</code> do servidor.
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowLocal((v) => !v)}
            aria-expanded={showLocal}
            className="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Laptop className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="flex-1">
              <span className="block text-sm font-medium">Abrir repositório local</span>
              <span className="block text-xs text-muted-foreground">sincronizar com a sua máquina</span>
            </span>
          </button>

          {showLocal && (
            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 space-y-3" role="note">
              <button
                type="button"
                disabled={localSnapshotLoading}
                onClick={async () => {
                  setLocalSnapshotLoading(true);
                  setLocalSnapshotError(null);
                  const { fetchLocalSnapshotMap } = await import("@/lib/gitCanvas/gitLocalClient");
                  const r = await fetchLocalSnapshotMap();
                  setLocalSnapshotLoading(false);
                  if (r.ok && r.map) {
                    const { useGitCanvas } = await import("@/lib/gitCanvas/store");
                    useGitCanvas.getState().loadUpload(r.map, r.map.uploadMeta ?? null);
                  } else {
                    setLocalSnapshotError(r.message);
                  }
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">Servidor local (snapshot automático)</span>
                  <span className="block text-xs text-muted-foreground">
                    o servidor lê o repositório agora — sempre atualizado, sem arquivos
                  </span>
                </span>
                {localSnapshotLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </button>
              {localSnapshotError && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400" role="alert">
                  {localSnapshotError}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Ou duas mitigações diretas:</strong>
              </p>

              <button
                type="button"
                onClick={async () => {
                  const { tryLocalFolder } = await import("@/lib/gitCanvas/gitCanvasBridge");
                  const r = await tryLocalFolder();
                  if (r.ok && r.map) {
                    // usa o mapa direto — o loadUpload do store aceita ProjectMap
                    const { useGitCanvas } = await import("@/lib/gitCanvas/store");
                    useGitCanvas.getState().loadUpload(r.map, r.map.uploadMeta ?? null);
                  } else {
                    alert(r.message);
                  }
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Laptop className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">Selecionar pasta do repositório</span>
                  <span className="block text-xs text-muted-foreground">Lê o .git diretamente (Chromium, read-only)</span>
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const { tryLocalBridge } = await import("@/lib/gitCanvas/gitCanvasBridge");
                  const r = await tryLocalBridge();
                  alert(r.message);
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Laptop className="h-4 w-4 shrink-0 text-blue-500" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">Serviço local (WebSocket)</span>
                  <span className="block text-xs text-muted-foreground">Detecta app companion na porta 8765 — em breve</span>
                </span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setShowUpload((v) => !v); setUploadError(null); }}
            aria-expanded={showUpload}
            className="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Upload className="h-4 w-4 shrink-0 text-violet-500" />
            <span className="flex-1">
              <span className="block text-sm font-medium">Enviar arquivos do Git</span>
              <span className="block text-xs text-muted-foreground">git log, reflog, stash, tags — gera o canvas sem conexão</span>
            </span>
          </button>

          {showUpload && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <GitUploadZone
                onParsed={(result) => {
                  setUploadError(null);
                  onUpload?.(result);
                }}
                onError={(msg) => setUploadError(msg)}
              />
              {uploadError && (
                <p className="mt-2 text-xs text-destructive" role="alert">{uploadError}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={onDemo}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1">
              <span className="block text-sm font-medium">Explorar modo demo</span>
              <span className="block text-xs text-muted-foreground">dataset determinístico — marcado como DEMO, nunca misturado com dados reais</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
