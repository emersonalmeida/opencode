/**
 * Página Chaves API (/chaves): adicione chaves das fontes e da IA via API
 * (BYOK do navegador). As chaves ficam no localStorage do usuário e são
 * enviadas ao servidor somente quando a coleta roda.
 */
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KEY_SPECS, type KeySpec } from "@/lib/apiKeysCatalog";
import { CheckCircle2, ExternalLink, Eye, EyeOff, Key, Save, Trash2 } from "lucide-react";

const STORAGE_KEY = "aso:api-keys:v1";
const useLocalStorage = (key: string, initial: string) => {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      if (value === initial) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch { /* quota */ }
  }, [key, value, initial]);
  return [value, setValue] as const;
};

function KeyRow({ spec, value, setValue }: { spec: KeySpec; value: string; setValue: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-1 items-center border-b border-border py-2 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={spec.group === "ai" ? "bg-violet-500/10 text-violet-300" : "bg-sky-500/10 text-sky-300"}>
            {spec.group === "ai" ? "IA" : "Fonte"}
          </Badge>
          <span className="font-medium">{spec.label}</span>
          {spec.usedIn && <span className="text-xs text-muted-foreground">· {spec.usedIn}</span>}
          {value && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-label="com chave" />}
          {spec.href && (
            <a href={spec.href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              criar chave <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex gap-1 items-center">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={spec.hint}
            className="font-mono text-xs h-8"
            aria-label={`Chave ${spec.label}`}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShow(!show)} aria-label={show ? "ocultar" : "mostrar"}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function KeysPage() {
  const specs = useMemo(() => KEY_SPECS, []);
  const [values, setValues] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [saved, setSaved] = useState(false);

  const setValue = (id: string, value: string) =>
    setValues((prev) => ({ ...prev, [id]: value }));

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* quota */ }
  };
  const clearAll = () => {
    setValues({});
    try { localStorage.removeItem(STORAGE_KEY); } catch { /**/ }
  };

  const count = Object.values(values).filter(Boolean).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader title="Chaves API" crumb="Fontes e IA" />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="content-fluid space-y-4 py-6">
          {/* Hero */}
          <section className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Chaves API</h1>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">{count} configuradas</Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Chaves das <strong>fontes</strong> (servidor consome para coletas) e da <strong>IA via API</strong> (BYOK: só no navegador). Elas ficam em <code>localStorage</code> e são enviadas ao servidor somente durante uma coleta.
            </p>
          </section>

          {/* Ações */}
          <section className="flex flex-wrap gap-2">
            <Button onClick={save} className="gap-1"><Save className="h-4 w-4" /> Salvar</Button>
            <Button variant="outline" onClick={clearAll}><Trash2 className="h-4 w-4" /> Limpar tudo</Button>
            {saved && <Badge variant="outline" className="bg-emerald-500/10">Salvo</Badge>}
          </section>

          {/* Fontes */}
          <section id="keys-fontes" className="space-y-1 scroll-mt-20">
            <h2 className="text-sm font-semibold">Fontes (podem desbloquear coletas)</h2>
            <div className="rounded-lg border">
              {specs.filter((s) => s.group === "sources").map((s) => (
                <KeyRow key={s.id} spec={s} value={values[s.id] ?? ""} setValue={(v) => setValue(s.id, v)} />
              ))}
            </div>
          </section>

          {/* IA */}
          <section id="keys-ia" className="space-y-1 scroll-mt-20">
            <h2 className="text-sm font-semibold">IA via API (BYOK)</h2>
            <div className="rounded-lg border">
              {specs.filter((s) => s.group === "ai").map((s) => (
                <KeyRow key={s.id} spec={s} value={values[s.id] ?? ""} setValue={(v) => setValue(s.id, v)} />
              ))}
            </div>
          </section>

          {/* Nota */}
          <section className="rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
            <p>
              <strong>Boas práticas</strong>: as chaves de IA (BYOK) nunca são enviadas ao
              servidor; o cliente envia o modo/modelo, e o servidor usa as chaves do seu
              <code>.env</code> para autenticar. As de fonte (<code>BRAVE_API_KEY</code>,
              <code>PRODUCT_HUNT_TOKEN</code> etc.) são lidas pelo servidor a cada coleta.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
