/**
 * Arquivos do usuário — store pub/sub (localStorage) dos arquivos enviados
 * pelo usuário para enriquecer conversas com a IA (CSV, TXT, MD, JSON…).
 *
 * Princípios:
 * - Dado do usuário (origem "user") — nunca misturado com gerações de IA.
 * - Arquivos de texto têm o conteúdo extraído (truncado) para a IA ler;
 *   binários ficam como dataUrl com nota honesta ("sem extração de texto").
 * - Nada sai do navegador sem ação explícita do usuário (local-first).
 */
import { useEffect, useState } from "react";

export interface UserFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** Texto extraído (truncado em MAX_TEXT_CHARS) — presente p/ text/*, csv, json, md. */
  text?: string;
  /** dataUrl (arquivos pequenos) para download posterior. */
  dataUrl?: string;
  /** Nota honesta (ex.: "binário sem extração de texto"). */
  note?: string;
  addedAt: number;
}

const KEY = "aso:user-files:v1";
const MAX_FILES = 50;
/** Limite de texto extraído por arquivo (protege quota do localStorage). */
export const MAX_TEXT_CHARS = 20_000;
/** Limite de dataUrl persistida (2MB). */
export const MAX_DATAURL_BYTES = 2 * 1024 * 1024;

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): UserFile[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function write(list: UserFile[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    try {
      // Quota: remove os mais antigos até caber.
      const slim = list.slice(-20).map((f) => ({ ...f, dataUrl: undefined, note: f.note }));
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* desiste silenciosamente */
    }
  }
  listeners.forEach((l) => l());
}

export function listUserFiles(): UserFile[] {
  return read().sort((a, b) => b.addedAt - a.addedAt);
}

export function subscribeUserFiles(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addUserFile(file: Omit<UserFile, "id" | "addedAt">): UserFile {
  const entry: UserFile = { ...file, id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, addedAt: Date.now() };
  write([...read(), entry].slice(-MAX_FILES));
  return entry;
}

export function removeUserFile(id: string): void {
  write(read().filter((f) => f.id !== id));
}

export function clearUserFiles(): void {
  write([]);
}

/** Hook reativo (padrão useDataset — useState + subscribe, sem loop). */
export function useUserFiles(): UserFile[] {
  const [files, setFiles] = useState<UserFile[]>(() => listUserFiles());
  useEffect(() => subscribeUserFiles(() => setFiles(listUserFiles())), []);
  return files;
}

/** Extensões/MIME cujo conteúdo é legível como texto para a IA. */
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|log|yaml|yml|xml|html?)$/i;
const TEXT_MIME = /^(text\/|application\/(json|xml|x-yaml))/i;

/** Decide se o conteúdo do arquivo pode ser lido como texto. */
export function isTextExtractable(name: string, mime: string): boolean {
  return TEXT_EXT.test(name) || TEXT_MIME.test(mime);
}

/**
 * Extrai o conteúdo de um File do navegador para um UserFile persistível:
 * texto (truncado) quando legível; senão dataUrl (se pequeno) + nota honesta.
 */
export async function fileToUserFile(file: File): Promise<Omit<UserFile, "id" | "addedAt">> {
  const base = { name: file.name, mime: file.type || "application/octet-stream", size: file.size };
  if (isTextExtractable(file.name, file.type)) {
    const raw = await file.text();
    const text = raw.length > MAX_TEXT_CHARS ? raw.slice(0, MAX_TEXT_CHARS) : raw;
    return {
      ...base,
      text,
      note: raw.length > MAX_TEXT_CHARS ? `Texto truncado em ${MAX_TEXT_CHARS.toLocaleString("pt-BR")} caracteres.` : undefined,
    };
  }
  if (file.size <= MAX_DATAURL_BYTES) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("falha ao ler arquivo"));
      r.readAsDataURL(file);
    });
    return { ...base, dataUrl, note: "Arquivo binário — sem extração de texto (a IA não lê o conteúdo)." };
  }
  return { ...base, note: "Arquivo grande demais para guardar localmente — só o nome foi registrado." };
}

/**
 * Bloco de contexto com os arquivos do usuário para a IA — cada arquivo vira
 * uma seção delimitada (nome + conteúdo truncado). Arquivos sem texto entram
 * só como menção. Total limitado (budget) para não explodir o contexto.
 */
export function filesContextBlock(files: UserFile[], budget = 12_000): string {
  if (files.length === 0) return "";
  const parts: string[] = [];
  let used = 0;
  for (const f of files) {
    const header = `### Arquivo do usuário: ${f.name} (${f.mime}, ${Math.round(f.size / 1024)} KB)`;
    const body = f.text ? `\n\`\`\`\n${f.text}\n\`\`\`` : `\n(sem texto extraível — ${f.note ?? "binário"})`;
    const chunk = header + body;
    if (used + chunk.length > budget && parts.length > 0) break;
    parts.push(chunk);
    used += chunk.length;
  }
  return `## ARQUIVOS DO USUÁRIO (contexto anexado)\nUse estes arquivos como fonte primária ao responder.\n\n${parts.join("\n\n")}`;
}
