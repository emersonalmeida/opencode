import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";

// Commit git no start/build do Vite — o cliente compara com o commit que o
// servidor reporta em /health para detectar "página aberta de código antigo".
const gitCommit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { timeout: 3000, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
})();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
  },
  server: {
    host: "::",
    port: 8080,
    // Falha alto se a 8080 já estiver ocupada — sem strictPort o Vite subiria
    // na 8081 em silêncio e o usuário continuaria vendo o app ANTIGO na 8080
    // (causa raiz do "corrigi mas o erro continua").
    strictPort: true,
    // Permite acessar o dev server pelos hosts de preview do ambiente remoto.
    allowedHosts: [".prod-runtime.all-hands.dev"],
    // Proxy do backend local: navegadores remotos (preview) não alcançam
    // localhost:8787 — o dev server repassa /functions para o Express.
    // /health também precisa de proxy: sem ele, com VITE_SUPABASE_URL vazio
    // (modo relativo) a sonda de saúde recebe o index.html (HTML) e marca
    // o servidor como offline mesmo com ele rodando.
    proxy: {
      "/functions": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors into their own long-lived cacheable chunks so
        // route-level code splitting actually shrinks the initial load.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-charts": ["recharts"],
          "vendor-flow": ["@xyflow/react"],
          "vendor-markdown": ["react-markdown", "remark-gfm", "rehype-raw"],
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
