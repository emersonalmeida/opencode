import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Portas separadas do projeto original (vite 8080 / server 8787): as duas
// versões podem executar simultaneamente para comparação.
export default defineConfig({
  plugins: [react()],
  // O vite descobriria o postcss.config.js da raiz (Tailwind da versão antiga)
  // ao subir pelo filesystem. Desligamos explicitamente para o núcleo novo.
  css: {
    postcss: {},
  },
  server: {
    port: 8081,
    proxy: {
      "/api": "http://localhost:8788",
    },
  },
  build: {
    outDir: "dist",
  },
});
