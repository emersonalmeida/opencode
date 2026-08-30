import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initDatasetStore } from "./lib/datasetStore";
import { requestPersistence } from "./lib/datasetDb";
import { runDatasetHygiene } from "./lib/datasetHygiene";

// Boot (Onda 3.1): reidrata o dataset do IndexedDB quando o localStorage
// está vazio (eviction/limpeza) e pede persistência durável ao navegador.
// Fire-and-forget: a UI sobe imediatamente com o cache síncrono; os
// consumidores são notificados quando a reidratação completa.
void initDatasetStore().then(() => {
  // Higiene P0: remove entries sintéticas de testes antigos (ex.: ids fake
  // com autores "UserN"). Roda após a reidratação do IDB para varrer o
  // dataset final, idempotente e sem rede.
  runDatasetHygiene();
});
void requestPersistence();

createRoot(document.getElementById("root")!).render(<App />);
