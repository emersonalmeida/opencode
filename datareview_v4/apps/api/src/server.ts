/**
 * App Express — composição das rotas com as deps injetadas.
 * Dividido de `index.ts` para o teste subir o server sem bootstrap de IO.
 */
import express from "express";
import type { Express } from "express";
import { createRouter } from "./routes.js";
import type { AppDeps } from "./deps.js";
import type { AIPort } from "@v4/domain";

export function createApp(deps: AppDeps, ai?: AIPort): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createRouter(deps, ai ? { ai } : {}));

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "recurso não encontrado" });
  });

  return app;
}