/**
 * Página Home (`/`) — a nova página inicial mobile-first, com conteúdo REAL
 * e as melhores práticas de UX/UI/usabilidade:
 *   saudação contextual · KPIs ao vivo · empty state honesto com coleta
 *   embutida · ações rápidas tocáveis · seções de navegação por área —
 *   tudo em coluna única no celular.

 * A implementação vive em `src/components/home/HomeMobileFirst.tsx` e o modelo
 * puro em `src/lib/home/homeMobileFirst.ts`. O modelo estrutural anterior
 * (`HomeShell`) continua no repositório, coberto por testes, como referência.

 * Mobile-first container-relacional: coluna única no telefone, grids
 * responsivos em telas maiores — sem sacrificar alvos de toque, contraste
 * ou hierarquia..
 */
import { HomeMobileFirst } from "@/components/home/HomeMobileFirst";

export default function HomePage() {
  return (
    <div className="h-full min-h-0 w-full">
      <HomeMobileFirst />
    </div>
  );
}
