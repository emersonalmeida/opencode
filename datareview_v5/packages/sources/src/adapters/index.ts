// Adaptadores ativos do núcleo v5 — portados verbatim da v4 (base/http/uni/
// infraSources = helpers; os 8 = fontes ativas). Interface uniforme SourcePort.

export { parseFeed } from "./infraSources.js";
export type { FeedEntry } from "./infraSources.js";
export { SuggestSource, normalizeVertical } from "./suggest.js";
export { trends } from "./trends.js";
export { serpFactory, serpSources } from "./serp.js";
export { youtube } from "./youtube.js";
export { reclameaqui, reclameaquiSources } from "./reclameaqui.js";
export { apple, appleSources } from "./apple.js";
export { googleplay, googleplaySources } from "./googleplay.js";
export { producthunt } from "./producthunt.js";