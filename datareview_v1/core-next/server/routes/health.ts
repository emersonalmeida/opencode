/** GET /api/v1/health — health check do servidor. */
import { json, type Handler } from "../router.js";

export const health: Handler = (_req, res) => {
  json(res, 200, { ok: true, service: "core-next", ts: Date.now() });
};
