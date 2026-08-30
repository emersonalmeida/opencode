/**
 * Snapshot do repositório git local — núcleo compartilhado servidor↔script.
 *
 * Gera os MESMOS conteúdos de texto que o parser de upload do cliente
 * (`src/lib/gitCanvas/gitUpload.ts`) consome. Fonte única de verdade: o
 * servidor/script executa os comandos git (somente-leitura) e devolve os
 * textos; o cliente parseia com o parser já testado. Nada é inventado: se
 * um comando falha, o arquivo correspondente é omitido e listado em
 * `failed`.
 *
 * Injeção de dependência (`execFn`) torna o módulo testável sem git real.
 */

export type GitExecFn = (args: string[]) => Promise<string>;

export interface GitSnapshotFile {
  /** nome lógico do arquivo (ex.: "git-log.txt") — o que o parser detecta. */
  name: string;
  /** conteúdo textual do comando. */
  text: string;
}

export interface GitSnapshot {
  ok: boolean;
  /** nome do diretório do repositório (basename do top-level). */
  repoName?: string;
  files: GitSnapshotFile[];
  /** comandos que falharam (ex.: stash vazio NÃO é falha; repo sem reflog é). */
  failed: string[];
  /** mensagem honesta quando ok=false (não é repo git, etc.). */
  message?: string;
  generatedAt: string;
}

/** Comandos somente-leitura que alimentam o canvas. Ordem = ordem de prioridade. */
export const SNAPSHOT_COMMANDS: ReadonlyArray<{ name: string; args: string[] }> = [
  { name: "git-log.txt", args: ["log", "--format=%H\u001FP\u001F%an\u001FaI\u001F%s", "--numstat", "--all", "-n", "500"] },
  { name: "git-reflog.txt", args: ["reflog", "--date=iso", "-n", "200"] },
  { name: "git-stash.txt", args: ["stash", "list", "--date=iso"] },
  { name: "git-tags.txt", args: ["for-each-ref", "refs/tags", "--format=%(objectname:short) %(refname) %(creatordate:iso)"] },
  { name: "git-branches.txt", args: ["branch", "-a"] },
  { name: "git-status.txt", args: ["status", "--porcelain"] },
  { name: "git-diff.txt", args: ["diff", "--shortstat", "HEAD"] },
  { name: "git-tree.txt", args: ["ls-tree", "-r", "HEAD", "--long"] },
];

/** Coleta o snapshot executando cada comando via execFn. Nunca lança. */
export async function collectGitSnapshot(execFn: GitExecFn): Promise<GitSnapshot> {
  const generatedAt = new Date().toISOString();
  try {
    const inside = (await execFn(["rev-parse", "--is-inside-work-tree"])).trim();
    if (inside !== "true") {
      return { ok: false, files: [], failed: [], generatedAt, message: "O diretório do servidor não é um repositório git." };
    }
  } catch (e) {
    return {
      ok: false,
      files: [],
      failed: [],
      generatedAt,
      message: `git indisponível: ${e instanceof Error ? e.message : "erro"}.`,
    };
  }

  let repoName: string | undefined;
  try {
    const top = (await execFn(["rev-parse", "--show-toplevel"])).trim();
    repoName = top.split("/").filter(Boolean).pop() || undefined;
  } catch { /* nome fica undefined — o parser cai no fallback */ }

  const files: GitSnapshotFile[] = [];
  const failed: string[] = [];
  for (const cmd of SNAPSHOT_COMMANDS) {
    try {
      const text = await execFn(cmd.args);
      // status/diff/stash vazios são resultados VÁLIDOS (working tree limpo)
      files.push({ name: cmd.name, text });
    } catch {
      failed.push(cmd.name);
    }
  }
  return { ok: true, repoName, files, failed, generatedAt };
}
