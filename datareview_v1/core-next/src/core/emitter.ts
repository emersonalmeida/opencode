/**
 * Pub/sub mínimo — o padrão de store usado por toda a camada de dados do
 * cliente (dataset store, configurações de IA…). ~30 linhas, sem dependência.
 *
 * Uso: stores do sistema não sobem por React; página lê via `useSyncExternalStore`
 * ou vincula a um componente.
 */
export type Listener = () => void;

export class Emitter {
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Chame após qualquer write — acorda todos os ouvintes. */
  notify(): void {
    for (const listener of this.listeners) listener();
  }
}

/** Store completa: get/set com normalização + persistência opcional na chave
 *  fornecida. Substitui o padrão de singletons/super-singletons (regra #16). */
export class Store<T> extends Emitter {
  private value: T;
  private storageKey?: string;

  constructor(initial: T, storageKey?: string) {
    super();
    this.value = initial;
    this.storageKey = storageKey;
    if (storageKey && typeof localStorage !== "undefined") {
      const raw = safeLocalStorageGet(storageKey);
      if (raw !== null) {
        try {
          this.value = JSON.parse(raw) as T;
        } catch {
          // Conteúdo corrompido — mantém initial (tolerante, não quebra o boot).
        }
      }
    }
  }

  get(): T {
    return this.value;
  }

  set(next: T): void {
    this.value = next;
    if (this.storageKey) safeLocalStorageSet(this.storageKey, safeStringify(next));
    this.notify();
  }
}

/** JSON.stringify tolerante (funções/circulares passam por toJSON padrão). */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return "null";
  }
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota excedida — silencia (ações que modificam continuam na memória).
  }
}
