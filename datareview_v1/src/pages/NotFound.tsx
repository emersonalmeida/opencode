import { Link, useLocation } from "react-router-dom";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md anim-slide-up">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-card/60">
          <Compass className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <p className="text-5xl font-bold tracking-tight text-foreground">404</p>
        <h1 className="mt-2 text-lg font-semibold text-foreground">Página não encontrada</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          O endereço <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">{location.pathname}</code> não
          existe ou foi movido. Verifique a URL ou volte para o início.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button asChild>
            <Link to="/" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao início
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/configuracoes">Configurações</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
