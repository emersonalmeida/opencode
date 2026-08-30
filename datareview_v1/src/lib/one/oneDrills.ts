/**
 * One Page — drill-downs PUROS: resolvem o alvo do drill a partir do item
 * selecionado (o id real vive em meta.* de cada fetcher da Uni). Sem React
 * aqui — a camada de efeito (fetch) fica em oneFetchers.fetchOneDrill.
 */
import type { UniItem } from "@/lib/uni/types";

export type DrillKind = "comments" | "article" | "answers" | "reviews" | "issues";

export interface DrillTarget {
  kind: DrillKind;
  /** id real do alvo (videoId, postId, storyId, questionId, appId, pageid). */
  target: string;
  label: string;
}

/** Resolve o alvo do drill para uma seção + item, ou null se não houver. */
export function resolveDrill(sectionId: string, item: UniItem): DrillTarget | null {
  const m = item.meta ?? {};
  switch (sectionId) {
    case "youtube": {
      const videoId = String(m.videoId ?? "");
      return videoId ? { kind: "comments", target: videoId, label: "Comentários do vídeo" } : null;
    }
    case "reddit": {
      // o id do post é o sufixo do uniItemId ("reddit:<id>") ou o link.
      const postId = String(m.postId ?? item.id.split(":").pop() ?? "");
      const sub = String(m.subreddit ?? "all");
      return postId ? { kind: "comments", target: `${sub}/${postId}`, label: "Comentários do post" } : null;
    }
    case "hackernews": {
      const storyId = String(m.hnId ?? m.storyId ?? "");
      return storyId ? { kind: "comments", target: storyId, label: "Comentários da história" } : null;
    }
    case "wikipedia": {
      const pageid = Number(m.pageid ?? 0);
      return pageid ? { kind: "article", target: String(pageid), label: "Artigo completo" } : null;
    }
    case "stackexchange": {
      const qid = String(m.questionId ?? "");
      const site = String(m.site ?? "stackoverflow");
      return qid ? { kind: "answers", target: `${site}/${qid}`, label: "Respostas da pergunta" } : null;
    }
    case "steam": {
      const appId = String(m.appId ?? "");
      return appId ? { kind: "reviews", target: appId, label: "Reviews do jogo" } : null;
    }
    default:
      return null;
  }
}
