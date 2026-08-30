/**
 * Git Canvas — mitigações de sincronização com o repositório local.
 *
 * Spec §12/§40: um app web NÃO acessa o filesystem arbitrariamente. Estas
 * funções são as alternativas viáveis que o browser realmente oferece —
 * cada uma honesta sobre o que consegue e o que não consegue fazer.
 */

// ---------------------------------------------------------------------------
// Mitigação A — File System Access API (pasta → dados git, read-only)
// ---------------------------------------------------------------------------

export interface LocalFolderResult {
  ok: boolean;
  message: string;
  /** quando ok, o ProjectMap parcial para loadUpload */
  map?: import("./types").ProjectMap;
}

/**
 * Tenta ler uma pasta .git via File System Access API.
 * Limitações honestas: só funciona em Chromium; sem suporte a submódulos;
 * só lê o que o usuário explicitamente autorizar.
 */
export async function tryLocalFolder(): Promise<LocalFolderResult> {
  if (!("showDirectoryPicker" in window)) {
    return {
      ok: false,
      message: "Este navegador não suporta acesso a pastas (File System Access API). Use Chrome, Edge ou Brave.",
    };
  }
  try {
    const dirHandle = await (window as unknown as { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    const name = dirHandle.name;
    const files: { name: string; relativePath: string; text: string }[] = [];

    // Percorre a pasta buscando arquivos .git conhecidos
    const gitDir = await findGitDir(dirHandle);
    if (!gitDir) {
      return {
        ok: false,
        message: `Pasta "${name}" não contém um diretório .git. Selecione a raiz de um repositório git.`,
      };
    }

    // Lê os arquivos-chave do .git que o parser entende
    const targets = ["HEAD", "packed-refs", "logs/HEAD", "refs/stash"];
    for (const path of targets) {
      const file = await readGitFile(gitDir, path);
      if (file) files.push(file);
    }

    // Lê refs soltas
    await collectRefs(gitDir, "refs/heads", files);
    await collectRefs(gitDir, "refs/tags", files);

    if (files.length === 0) {
      return {
        ok: false,
        message: `Encontrei .git em "${name}" mas não consegui ler nenhum dado (HEAD, refs, logs).`,
      };
    }

    const { buildProjectMapFromUpload, uploadResultToMap } = await import("./gitUpload");
    const result = buildProjectMapFromUpload(files);
    if (name) result.name = name;
    const map = uploadResultToMap(result, "pasta local (File System Access API)", "local-folder");
    return {
      ok: true,
      message: `Lidos ${result.filesRead} arquivos do .git de "${name}".`,
      map,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    if (msg.includes("aborted") || msg.includes("cancelled")) {
      return { ok: false, message: "Seleção cancelada." };
    }
    return { ok: false, message: `Erro ao ler pasta: ${msg}` };
  }
}

async function findGitDir(dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle | null> {
  try {
    const git = await dir.getDirectoryHandle(".git");
    return git;
  } catch {
    return null;
  }
}

async function readGitFile(gitDir: FileSystemDirectoryHandle, path: string): Promise<{ name: string; relativePath: string; text: string } | null> {
  try {
    const parts = path.split("/");
    let current: FileSystemDirectoryHandle = gitDir;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return { name: parts[parts.length - 1], relativePath: path, text };
  } catch {
    return null;
  }
}

async function collectRefs(gitDir: FileSystemDirectoryHandle, prefix: string, out: { name: string; relativePath: string; text: string }[]) {
  try {
    let current = gitDir;
    for (const part of prefix.split("/")) {
      current = await current.getDirectoryHandle(part);
    }
    for await (const entry of (current as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }).values()) {
      if (entry.kind === "file") {
        const file = await (entry as FileSystemFileHandle).getFile();
        const text = await file.text();
        out.push({ name: entry.name, relativePath: `${prefix}/${entry.name}`, text });
      }
    }
  } catch {
    // ignora se o diretório não existe
  }
}

// ---------------------------------------------------------------------------
// Mitigação B — WebSocket local (app companion futuro)
// ---------------------------------------------------------------------------

/**
 * Tenta conectar a um serviço local na porta 8765 (convenção).
 * Hoje: apenas detecta se algo responde; a especificação do protocolo
 * fica para a Parte 7 (spec §12 — app companion).
 */
export async function tryLocalBridge(): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ ok: false, message: "Nenhum serviço local respondeu na porta 8765 (2s timeout)." }), 2000);
    try {
      const ws = new WebSocket("ws://localhost:8765/git-bridge");
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({ ok: true, message: "Serviço local encontrado na porta 8765. Protocolo de sincronização: em breve (Parte 7)." });
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({ ok: false, message: "Nenhum serviço local na porta 8765. Instale o app companion (Parte 7)." });
      };
    } catch {
      clearTimeout(timeout);
      resolve({ ok: false, message: "WebSocket não suportado neste ambiente." });
    }
  });
}

// ---------------------------------------------------------------------------
// Mitigação C — colar output do git (sem arquivo)
// ---------------------------------------------------------------------------

import { buildProjectMapFromUpload } from "./gitUpload";

export function parsePastedGitOutput(text: string): import("./gitUpload").GitUploadResult {
  return buildProjectMapFromUpload([{ name: "repositório-colado", text }]);
}
