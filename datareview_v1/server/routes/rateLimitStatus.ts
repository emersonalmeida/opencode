import type { RequestHandler } from "express";
import { getTelemetry, isDegraded } from "../lib/rateLimitTelemetry.js";

export const rateLimitStatus: RequestHandler = (_req, res) => {
  const telemetry = getTelemetry();
  return res.json({
    ...telemetry,
    degraded: {
      amp: isDegraded(telemetry.sources.amp),
      ssr: isDegraded(telemetry.sources.ssr),
      rss: isDegraded(telemetry.sources.rss),
    },
  });
};
