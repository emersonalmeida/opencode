import { useSyncExternalStore, useRef } from "react";
import {
  listSessions,
  subscribe,
  type ChatSession,
} from "@/lib/chatHistoryStore";

/**
 * Assina o store de histórico de chats; re-renderiza quando muda.
 *
 * IMPORTANT: `listSessions()` returns a freshly-allocated array on every call
 * (it sorts a copy). Passing that directly to `useSyncExternalStore` makes
 * the snapshot differ every render → infinite update loop. We memoize the last
 * snapshot and only replace it (with a new reference) when the underlying list
 * actually changed, detected by comparing the sorted id+updatedAt fingerprint.
 */
export function useChatHistory(): ChatSession[] {
  const lastRef = useRef<ChatSession[]>([]);
  const fpRef = useRef<string>("");

  const getSnapshot = (): ChatSession[] => {
    const fresh = listSessions();
    // Cheap fingerprint: ids + updatedAt. Identical content → same ref.
    const fp = fresh.map((s) => `${s.id}@${s.updatedAt}`).join("|");
    if (fp !== fpRef.current) {
      fpRef.current = fp;
      lastRef.current = fresh;
    }
    return lastRef.current;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
