import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { OpportunityScore } from "./OpportunityScore";
import { newProductCandidate, saveProductCandidate, getProductCandidate } from "@/lib/lab/repository";
import { recomputeScore } from "@/lib/lab/runner";
import type { ProductCandidate, ProductScores } from "@/lib/lab/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fromExperimentId?: string;
  /** Quando fornecido, edita o candidato existente. */
  productId?: string;
}

export function ProductCandidateDialog({ open, onOpenChange, fromExperimentId, productId }: Props) {
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState("");
  const [problem, setProblem] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<ProductScores>({});

  useEffect(() => {
    if (!open) return;
    if (productId) {
      const existing = getProductCandidate(productId);
      if (existing) {
        setName(existing.name);
        setVertical(existing.vertical || "");
        setProblem(existing.problem);
        setTargetUser(existing.targetUser || "");
        setNotes(existing.notes || "");
        setScores(existing.scores || {});
        return;
      }
    }
    setName("");
    setVertical("");
    setProblem("");
    setTargetUser("");
    setNotes("");
    setScores({});
  }, [open, productId]);

  const computedScore = recomputeScore(scores);
  const canSave = name.trim() && problem.trim();

  const handleSave = () => {
    if (!canSave) return;
    const base: Partial<ProductCandidate> = {
      name: name.trim(),
      vertical: vertical.trim() || undefined,
      problem: problem.trim(),
      targetUser: targetUser.trim() || undefined,
      notes: notes.trim() || undefined,
      scores,
      opportunityScore: computedScore,
    };
    if (productId) {
      const existing = getProductCandidate(productId);
      if (existing) saveProductCandidate({ ...existing, ...base });
    } else {
      const p = newProductCandidate({
        ...base,
        evidence: fromExperimentId
          ? { experimentIds: [fromExperimentId], findingIds: [], datasetIds: [] }
          : { experimentIds: [], findingIds: [], datasetIds: [] },
      });
      saveProductCandidate(p);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{productId ? "Editar Product Candidate" : "Novo Product Candidate"}</DialogTitle>
          <DialogDescription>
            Incube um produto derivado de experimentos validados. O Opportunity
            Score é experimental — não é verdade objetiva.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="pc-name">Nome</Label>
            <Input id="pc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Fintech Voice" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pc-vertical">Nicho / vertical</Label>
              <Input id="pc-vertical" value={vertical} onChange={(e) => setVertical(e.target.value)} placeholder="Ex.: Fintech" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-target">Usuário-alvo</Label>
              <Input id="pc-target" value={targetUser} onChange={(e) => setTargetUser(e.target.value)} placeholder="Ex.: Equipes de produto" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pc-problem">Problema</Label>
            <Textarea id="pc-problem" value={problem} onChange={(e) => setProblem(e.target.value)} rows={3}
              placeholder="Qual problema este produto resolve? Baseie em evidências dos experimentos." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pc-notes">Notas (opcional)</Label>
            <Textarea id="pc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <OpportunityScore scores={scores} value={computedScore ?? undefined} onChange={setScores} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
