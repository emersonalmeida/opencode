import { useParams } from "react-router-dom";
import { ExperimentDetail } from "@/components/lab/ExperimentDetail";

/** Rota /lab/experiments/:id — wrapper fino sobre ExperimentDetail. */
export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Experimento inválido.
      </div>
    );
  }
  return <ExperimentDetail experimentId={id} />;
}
