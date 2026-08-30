/**
 * Git Canvas — dados para a visão Blocos (cards expansíveis em colunas).
 *
 * Lib pura: transforma o ProjectMap em seções de cards com os MESMOS dados
 * reais do canvas — sem inventar nada. Seção sem dados não é renderizada.
 */
import type { ProjectMap } from "./types";

export interface BlockItem {
  id: string;
  label: string;
  sub?: string;
  badges?: string[];
}

export interface BlockSection {
  id: string;
  title: string;
  items: BlockItem[];
}

function shortDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** Monta as seções de blocos a partir de dados REAIS do mapa. */
export function buildBlocksData(map: ProjectMap): BlockSection[] {
  const sections: BlockSection[] = [];

  if (map.branches.length > 0) {
    sections.push({
      id: "branches",
      title: "Branches",
      items: map.branches.map((b) => ({
        id: b.name,
        label: b.name,
        sub: [
          b.headSha.slice(0, 8),
          b.isDefault ? "padrão" : "",
          b.ahead ? `+${b.ahead}` : "",
          b.behind ? `−${b.behind}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        badges: b.isDefault ? ["padrão"] : undefined,
      })),
    });
  }

  if (map.commits.length > 0) {
    sections.push({
      id: "commits",
      title: "Commits",
      items: map.commits.slice(0, 100).map((c) => ({
        id: `${c.sha}@${c.date}`,
        label: c.message,
        sub: `${c.sha.slice(0, 8)} · ${c.author} · ${shortDate(c.date) ?? c.date}`,
        badges: [
          c.filesChanged ? `${c.filesChanged} arq.` : "",
          c.additions ? `+${c.additions}` : "",
          c.deletions ? `−${c.deletions}` : "",
        ].filter(Boolean),
      })),
    });
  }

  if (map.refs?.tags?.length) {
    sections.push({
      id: "tags",
      title: "Tags",
      items: map.refs.tags.map((t) => ({
        id: t.name,
        label: t.name,
        sub: `${t.sha.slice(0, 8)}${t.date ? ` · ${shortDate(t.date)}` : ""}`,
        badges: t.message ? ["anotada"] : undefined,
      })),
    });
  }

  if (map.refs?.reflog?.length) {
    sections.push({
      id: "reflog",
      title: "Reflog",
      items: map.refs.reflog.slice(0, 100).map((r, i) => ({
        id: `${r.sha}@${i}`,
        label: r.action,
        sub: `${r.sha.slice(0, 8)}${r.message ? ` · ${r.message}` : ""}`,
      })),
    });
  }

  if (map.refs?.stash?.length) {
    sections.push({
      id: "stash",
      title: "Stash",
      items: map.refs.stash.map((s, i) => ({
        id: `stash@{${i}}`,
        label: s.message,
        sub: [s.branch ? `branch ${s.branch}` : "", s.author ?? "", s.date ? shortDate(s.date) : ""]
          .filter(Boolean)
          .join(" · ") || undefined,
      })),
    });
  }

  if (map.uploadMeta?.gaps?.length) {
    sections.push({
      id: "gaps",
      title: "Gaps (dados ausentes)",
      items: map.uploadMeta.gaps.map((g, i) => ({ id: `gap-${i}`, label: g })),
    });
  }

  return sections;
}

/** Texto de export (JSON serializado das seções) para o ExpandableBlock. */
export function blocksExport(section: BlockSection): unknown {
  return section.items;
}

// ---------------------------------------------------------------------------
// Layout Árvore — commits aninhados sob suas branches (quando o commit
// declara `branch`); commits sem branch vão para uma seção própria honesta.
// ---------------------------------------------------------------------------

export interface TreeNode {
  id: string;
  label: string;
  sub?: string;
  badges?: string[];
  children: TreeNode[];
}

export function buildBlocksTreeData(map: ProjectMap): TreeNode[] {
  const roots: TreeNode[] = [];

  if (map.branches.length > 0 || map.commits.length > 0) {
    const byBranch = new Map<string, TreeNode[]>();
    const orphans: TreeNode[] = [];
    for (const c of map.commits) {
      const node: TreeNode = {
        id: `commit:${c.sha}@${c.date}`,
        label: c.message,
        sub: `${c.sha.slice(0, 8)} · ${c.author} · ${shortDate(c.date) ?? c.date}`,
        badges: [c.filesChanged ? `${c.filesChanged} arq.` : "", c.additions ? `+${c.additions}` : "", c.deletions ? `−${c.deletions}` : ""].filter(Boolean),
        children: [],
      };
      if (c.branch) {
        const list = byBranch.get(c.branch) ?? [];
        list.push(node);
        byBranch.set(c.branch, list);
      } else {
        orphans.push(node);
      }
    }
    const branchNodes: TreeNode[] = map.branches.map((b) => ({
      id: `branch:${b.name}`,
      label: b.name,
      sub: [b.headSha.slice(0, 8), b.isDefault ? "padrão" : "", b.ahead ? `+${b.ahead}` : "", b.behind ? `−${b.behind}` : ""].filter(Boolean).join(" · "),
      badges: b.isDefault ? ["padrão"] : undefined,
      children: byBranch.get(b.name) ?? [],
    }));
    if (orphans.length > 0) {
      branchNodes.push({ id: "orphans", label: "Commits sem branch declarada", children: orphans });
    }
    roots.push({ id: "repo", label: map.project.name, sub: `${map.branches.length} branches · ${map.commits.length} commits`, children: branchNodes });
  }

  if (map.refs?.tags?.length) {
    roots.push({
      id: "tags",
      label: "Tags",
      sub: `${map.refs.tags.length}`,
      children: map.refs.tags.map((t) => ({
        id: `tag:${t.name}`,
        label: t.name,
        sub: t.sha.slice(0, 8),
        children: [],
      })),
    });
  }

  if (map.refs?.stash?.length) {
    roots.push({
      id: "stash",
      label: "Stash",
      sub: `${map.refs.stash.length}`,
      children: map.refs.stash.map((s, i) => ({ id: `stash:${i}`, label: s.message, children: [] })),
    });
  }

  return roots;
}

