import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EXPERIMENT_TYPES } from "@/lib/lab/constants";
import { newExperiment, saveExperiment } from "@/lib/lab/repository";
import { createLabDatasetFromEntries as mkDataset } from "@/lib/lab/datasets";
import type { DatasetEntry } from "@/lib/datasetStore";
import { entryKey } from "@/context/SelectionContext";
import type { ExperimentType, LabExperiment } from "@/lib/lab/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dataset: DatasetEntry[];
  onCreated: (experiment: LabExperiment) => void;
}

const TYPES = Object.entries(EXPERIMENT_TYPES) as [ExperimentType, typeof EXPERIMENT_TYPES[ExperimentType]][];

export function ExperimentDialog({ open, onOpenChange, dataset, onCreated }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ExperimentType>("intelligence");
  const [question, setQuestion] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setName("");
      setType("intelligence");
      setQuestion("");
      setHypothesis("");
      setScope("all");
      setSelectedKeys(new Set());
    }
  }, [open]);

  const toggleApp = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canCreate = name.trim().length > 0 && (scope === "all" || selectedKeys.size > 0);

  const handleCreate = () => {
    if (!canCreate) return;
    const scopedEntries =
      scope === "all"
        ? dataset
        : dataset.filter((e) => selectedKeys.has(entryKey(e.app.store, e.app.id)));

    // Cria um LabDataset referenciando os apps (não duplica reviews)
    const labDs =
      scopedEntries.length > 0
        ? mkDataset(scopedEntries, `Dataset — ${name.trim()}`, "Apps selecionados para o experimento.")
        : undefined;

    const exp = newExperiment({
      name: name.trim(),
      type,
      question: question.trim() || undefined,
      hypothesis: hypothesis.trim() || undefined,
      datasetIds: labDs ? [labDs.id] : [],
    });
    saveExperiment(exp);
    onCreated(exp);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Novo experimento</DialogTitle>
          <DialogDescription>
            Formule uma hipótese testável sobre os dados coletados. O experimento
            será executado pela IA sobre o dataset selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="exp-name">Nome</Label>
            <Input
              id="exp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Detecção de regressão após release"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de experimento</Label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                    type === key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  <meta.icon className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground">{meta.label}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2">{meta.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-question">Pergunta (opcional)</Label>
            <Input
              id="exp-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex.: Conseguimos detectar regressões após releases?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-hyp">Hipótese</Label>
            <Textarea
              id="exp-hyp"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="Ex.: Mudanças abruptas nos temas negativos dos reviews podem revelar regressões após uma nova versão."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Dataset</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  scope === "all" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                Todo o dataset ({dataset.length} apps)
              </button>
              <button
                type="button"
                onClick={() => setScope("selected")}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  scope === "selected" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                Selecionar apps{selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ""}
              </button>
            </div>

            {scope === "selected" && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {dataset.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">
                    Nenhum app coletado ainda. Colete apps na aba "Apps" ou em "Início".
                  </p>
                )}
                {dataset.map((e) => {
                  const key = entryKey(e.app.store, e.app.id);
                  const checked = selectedKeys.has(key);
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2.5 p-2.5 hover:bg-secondary/40 cursor-pointer"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleApp(key)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-foreground truncate">{e.app.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {e.app.store} · {e.reviews.length} reviews
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {scope === "all" && dataset.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {dataset.length} apps ·{" "}
                {dataset.reduce((s, e) => s + e.reviews.length, 0).toLocaleString("pt-BR")} reviews
                disponíveis
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            Criar experimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
