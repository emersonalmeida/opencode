import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FlaskConical, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AppHeader } from "@/components/AppHeader";
import { LabKpiCards } from "@/components/lab/LabKpiCards";
import { LabPipeline } from "@/components/lab/LabPipeline";
import { ExperimentCard } from "@/components/lab/ExperimentCard";
import { ExperimentDialog } from "@/components/lab/ExperimentDialog";
import { LabEmptyState } from "@/components/lab/LabEmptyState";
import { FindingCard } from "@/components/lab/FindingCard";
import { DiscoveryBoard } from "@/components/lab/DiscoveryBoard";
import { ProductCandidateDialog } from "@/components/lab/ProductCandidateDialog";
import { LabKnowledge } from "@/components/lab/LabKnowledge";
import { useLabExperiments, useLabFindings, useLabProductCandidates, useLabDatasets } from "@/lib/lab/hooks";
import { useDataset } from "@/hooks/useDataset";
import { EXAMPLE_EXPERIMENT } from "@/lib/lab/examples";
import { saveExperiment, saveFinding, saveLabDataset } from "@/lib/lab/repository";

/**
 * Lab — laboratório de descoberta, experimentação e incubação de produtos.
 * Camada de orquestração sobre dataset, IA e Canvas. Local-first.
 */
export default function Lab({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const experiments = useLabExperiments();
  const findings = useLabFindings();
  const products = useLabProductCandidates();
  const datasets = useLabDatasets();
  const { entries } = useDataset();
  const [expDialog, setExpDialog] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [tab, setTab] = useState("overview");

  const isFirstTime = experiments.length === 0 && products.length === 0;
  const findingByExp = (id: string) => findings.filter((f) => f.experimentId === id).length;

  const loadExample = () => {
    const { experiment, findings: exFindings } = EXAMPLE_EXPERIMENT();
    saveExperiment(experiment);
    for (const f of exFindings) saveFinding(f);
    navigate(`/lab/experiments/${experiment.id}`);
  };

  const openExperiment = (id: string) => navigate(`/lab/experiments/${id}`);

  const pipelineCounts = {
    dataset: datasets.length,
    experiment: experiments.length,
    finding: findings.length,
    validation: findings.filter((f) => f.status === "validated").length,
    product: products.length,
  };

  return (
    <div className="h-full flex flex-col">
      {!embedded && <AppHeader title="Lab" crumb="Experimentação → Descoberta → Produtos" />}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="content-fluid w-full space-y-4">
          {/* Hero actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                <FlaskConical className="h-5 w-5 text-primary" /> Lab
              </h1>
              <p className="text-xs text-muted-foreground">
                Um espaço para testar hipóteses, descobrir padrões e incubar novos produtos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setExpDialog(true)}>
                <Plus className="h-3.5 w-3.5" /> Novo experimento
              </Button>
              <Button size="sm" variant="outline" onClick={() => setProductDialog(true)}>
                <Package className="h-3.5 w-3.5" /> Product Candidate
              </Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="experiments">
                Experimentos <TabCount n={experiments.length} />
              </TabsTrigger>
              <TabsTrigger value="discoveries">
                Descobertas <TabCount n={findings.length} />
              </TabsTrigger>
              <TabsTrigger value="products">
                Produtos <TabCount n={products.length} />
              </TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {isFirstTime ? (
                <LabEmptyState
                  variant="first"
                  title="App Data Review Lab"
                  description="Um espaço para testar hipóteses, descobrir padrões e incubar novos produtos."
                  action={<Button size="sm" onClick={() => setExpDialog(true)}><Plus className="h-3.5 w-3.5" /> Criar primeiro experimento</Button>}
                  secondary={<Button size="sm" variant="outline" onClick={loadExample}>Ver exemplo</Button>}
                />
              ) : (
                <>
                  <LabKpiCards experiments={experiments} findings={findings} products={products} />
                  <LabPipeline
                    counts={pipelineCounts}
                    onStageClick={(stage) => {
                      if (stage === "experiment") setTab("experiments");
                      else if (stage === "finding" || stage === "validation") setTab("discoveries");
                      else if (stage === "product") setTab("products");
                    }}
                  />
                  <div>
                    <h2 className="text-xs font-semibold text-foreground mb-2">Experimentos recentes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {experiments.slice(0, 6).map((e) => (
                        <ExperimentCard
                          key={e.id}
                          experiment={e}
                          datasets={datasets}
                          findingCount={findingByExp(e.id)}
                          onClick={() => openExperiment(e.id)}
                        />
                      ))}
                    </div>
                  </div>
                  {products.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold text-foreground mb-2">Product Candidates</h2>
                      <DiscoveryBoard products={products} onCreate={() => setProductDialog(true)} />
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Experiments */}
            <TabsContent value="experiments" className="mt-4">
              {experiments.length === 0 ? (
                <LabEmptyState
                  title="Seu laboratório está vazio"
                  description="Crie uma hipótese e transforme-a em seu primeiro experimento."
                  action={<Button size="sm" onClick={() => setExpDialog(true)}><Plus className="h-3.5 w-3.5" /> Novo experimento</Button>}
                  secondary={<Button size="sm" variant="outline" onClick={loadExample}>Ver exemplo</Button>}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {experiments.map((e) => (
                    <ExperimentCard
                      key={e.id}
                      experiment={e}
                      datasets={datasets}
                      findingCount={findingByExp(e.id)}
                      onClick={() => openExperiment(e.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Discoveries */}
            <TabsContent value="discoveries" className="mt-4">
              {findings.length === 0 ? (
                <LabEmptyState
                  title="Ainda não existem descobertas validadas"
                  description="Execute um experimento para começar a acumular conhecimento."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {findings.map((f) => (
                    <FindingCard key={f.id} finding={f} onOpenExperiment={openExperiment} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Products */}
            <TabsContent value="products" className="mt-4">
              <DiscoveryBoard products={products} onCreate={() => setProductDialog(true)} />
            </TabsContent>

            {/* Knowledge */}
            <TabsContent value="knowledge" className="mt-4">
              <LabKnowledge onOpenExperiment={openExperiment} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ExperimentDialog
        open={expDialog}
        onOpenChange={setExpDialog}
        dataset={entries}
        onCreated={(exp) => navigate(`/lab/experiments/${exp.id}`)}
      />
      <ProductCandidateDialog open={productDialog} onOpenChange={setProductDialog} />
    </div>
  );
}

/** Contagem compacta exibida dentro das tabs (oculta quando zero). */
function TabCount({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-secondary text-[9px] font-semibold text-foreground/70">
      {n}
    </span>
  );
}
